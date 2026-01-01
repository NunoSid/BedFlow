import { Injectable, ForbiddenException, NotFoundException, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BedsService {
  private readonly logger = new Logger(BedsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private normalizeText(value?: string | null) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
  }

  private clampSortOrder(value: number) {
    const maxInt = 2147483647;
    if (!Number.isFinite(value) || value <= 0) return Math.floor(Date.now() / 1000);
    return value > maxInt ? Math.floor(Date.now() / 1000) : value;
  }

  private computeSortOrder(code?: string | null) {
    if (!code) return Math.floor(Date.now() / 1000);
    const normalized = code.toString();
    if (normalized.includes('QP')) {
      const floor = normalized.split('.')[0] || '0';
      const floorNum = Number.parseInt(floor, 10) || 0;
      return this.clampSortOrder(floorNum * 10000 + 9999);
    }
    const digits = normalized.match(/\d+/g);
    if (!digits || digits.length === 0) return Math.floor(Date.now() / 1000);
    const padded = digits.map((d) => d.padStart(2, '0')).join('');
    const parsed = Number.parseInt(padded, 10);
    return this.clampSortOrder(Number.isNaN(parsed) ? Math.floor(Date.now() / 1000) : parsed);
  }

  async getFloors() {
    const floors = await this.prisma.floor.findMany({
      include: {
        beds: {
          orderBy: { sortOrder: 'asc' },
          include: {
            room: true,
            clinicalState: true,
            admissions: {
              where: { isActive: true },
              include: {
                utente: true,
                notes: {
                  where: { type: 'ADMISSION_META' },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return floors.map((floor) => ({
      ...floor,
      beds: floor.beds.map((bed) => ({
        ...bed,
        admissions: bed.admissions.map((admission: any) => {
          const meta = this.extractAdmissionMeta(admission.notes?.[0]?.content);
          const { notes, ...rest } = admission;
          return { ...rest, meta };
        }),
      })),
    }));
  }

  async getStructure() {
    return this.prisma.floor.findMany({
      orderBy: { name: 'asc' },
      include: {
        rooms: {
          orderBy: { name: 'asc' },
          include: {
            beds: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, code: true, sortOrder: true, isLocked: true },
            },
          },
        },
      },
    });
  }

  // ATUALIZAÇÃO CLÍNICA (Drenos, etc)
  async updateClinicalState(userId: string, userRole: string, bedId: string, field: string, value: any, reason: string) {
    return this.updateClinicalBulk(userId, userRole, bedId, { [field]: value }, reason);
  }

  async updateClinicalBulk(userId: string, userRole: string, bedId: string, updates: Record<string, any>, reason?: string) {
    if (!updates || Object.keys(updates).length === 0) {
      throw new BadRequestException('Sem alterações a aplicar.');
    }

    this.logger.log(`Update Clinical Bulk: Bed ${bedId}, Fields ${Object.keys(updates).join(', ')}`);

    return this.prisma.$transaction(async (tx) => {
      const bed = await tx.bed.findUnique({
        where: { id: bedId },
        include: { clinicalState: true },
      });

      if (!bed) throw new NotFoundException('Cama não encontrada');
      if (bed.isLocked && userRole !== 'ADMIN') throw new ForbiddenException('Cama bloqueada.');

      let currentRecord = bed.clinicalState;
      if (!currentRecord) {
        currentRecord = await tx.bedClinicalState.upsert({
          where: { bedId },
          create: { bedId },
          update: {},
        });
      }

      try {
        const before: Record<string, any> = {};
        Object.keys(updates).forEach((key) => {
          before[key] = (currentRecord as any)[key] ?? null;
        });

        const newState = await tx.bedClinicalState.update({
          where: { bedId },
          data: updates,
        });

        await this.audit.logChange(
          tx,
          userId,
          'UPDATE_CLINICAL',
          bedId,
          before,
          updates,
          reason || 'Clinical update',
          'BedClinicalState',
          currentRecord.id,
        );

        return newState;
      } catch (e: any) {
        this.logger.error(`Failed to update clinical bulk: ${e.message}`);
        throw new HttpException(`Erro ao gravar dados clínicos: ${e.message}`, HttpStatus.BAD_REQUEST);
      }
    });
  }

  // ADMISSÃO (Internar)
  async admitPatient(userId: string, bedId: string, data: any) {
      this.logger.log(`Admiting patient to bed ${bedId}: ${JSON.stringify(data)}`);

      return this.prisma.$transaction(async (tx) => {
          let birthDate = null;
          if (data.birthDate) {
              const d = new Date(data.birthDate);
              if (!isNaN(d.getTime())) birthDate = d;
          }

          await tx.admission.updateMany({
              where: { bedId, isActive: true },
              data: { isActive: false, dischargeDate: new Date() }
          });

          let utente = null;
          if (data.processNumber && data.processNumber.trim().length > 0) {
             utente = await tx.utente.findFirst({ where: { processNumber: data.processNumber } });
          }

          if (!utente) {
              utente = await tx.utente.create({
                  data: {
                      name: data.name,
                      birthDate: birthDate,
                      processNumber: data.processNumber || null,
                      subsystem: data.subsystem || null
                  }
              });
          } else if (data.subsystem) {
              await tx.utente.update({
                  where: { id: utente.id },
                  data: { subsystem: data.subsystem }
              });
          }

          const resolveDate = (input?: any) => {
              if (!input) return null;
              const parsed = new Date(input);
              return isNaN(parsed.getTime()) ? null : parsed;
          };

          const dischargeAt = resolveDate(data.dischargeDate);
          const admissionPayload: any = {
              bedId,
              utenteId: utente.id,
              surgeon: data.surgeon || 'N/A',
              surgery: data.surgery || 'N/A',
              entryDate: resolveDate(data.entryDate) || new Date(),
              dischargeDate: dischargeAt || null,
              isActive: true,
          };

          if (data.ageYears !== undefined && data.ageYears !== null && data.ageYears !== '') {
              const parsed = parseInt(data.ageYears, 10);
              admissionPayload.ageYears = isNaN(parsed) ? null : parsed;
          }
          if (data.sex !== undefined) {
              admissionPayload.sex = typeof data.sex === 'string' && data.sex.trim().length ? data.sex.trim() : null;
          }

          const admission = await tx.admission.create({ data: admissionPayload });

          if (data.specialty || data.observations || data.allergies) {
              await tx.clinicalNote.create({
                  data: {
                      admissionId: admission.id,
                      content: JSON.stringify({
                          specialty: data.specialty || '',
                          observations: data.observations || '',
                          allergies: data.allergies || '',
                      }),
                      type: 'ADMISSION_META',
                      createdBy: userId,
                  }
              });
          }

          await this.audit.logChange(tx, userId, 'ADMIT_PATIENT', bedId, {}, admission, 'Admission', 'Admission', admission.id);
          return admission;
      });
  }

  async dischargePatient(userId: string, bedId: string, reason: string) {
      // (Lógica inalterada, estava correta)
      return this.prisma.$transaction(async (tx) => {
          const admission = await tx.admission.findFirst({ where: { bedId, isActive: true } });
          if (!admission) throw new NotFoundException('Sem internamento ativo.');
          
          await tx.admission.update({
              where: { id: admission.id },
              data: { isActive: false, dischargeDate: new Date() }
          });
          
          await this.audit.logChange(tx, userId, 'DISCHARGE', bedId, {}, {}, reason, 'Admission', admission.id);
      });
  }

  async toggleLock(userId: string, userRole: string, bedId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const bed = await tx.bed.findUnique({ where: { id: bedId } });
      if (!bed) throw new NotFoundException('Cama não encontrada');
      
      const isLocking = !bed.isLocked;
      const updated = await tx.bed.update({
        where: { id: bedId },
        data: { isLocked: isLocking, lockedByUserId: userId, lockReason: reason || (isLocking ? 'Manual lock' : 'Manual unlock'), lockedAt: new Date() }
      });
      await this.audit.logChange(tx, userId, isLocking ? 'LOCK' : 'UNLOCK', bedId, {}, {}, reason || 'Manual operation', 'Bed', bedId);
      return updated;
    });
  }
  
  async getHistory(bedId: string) {
      // Buscar logs da cama
      const logs = await this.prisma.auditLog.findMany({
          where: { 
              OR: [
                  { targetBedId: bedId }, // Se tiver ID direto
                  // Podíamos buscar pelo código também se tivéssemos o código
              ]
          },
          include: { user: { select: { fullName: true, role: true } } },
          orderBy: { timestamp: 'desc' },
      });

      return logs.map(l => ({
          ...l,
          beforeState: l.beforeState ? JSON.parse(l.beforeState) : null,
          afterState: l.afterState ? JSON.parse(l.afterState) : null,
          diff: l.diff ? JSON.parse(l.diff) : null,
      }));
  }

  async updateAdministrativeData(userId: string, bedId: string, dto: any) {
      return this.prisma.$transaction(async (tx) => {
          const bed = await tx.bed.findUnique({
              where: { id: bedId },
              include: {
                  admissions: {
                      where: { isActive: true },
                      include: {
                          utente: true,
                          notes: {
                              where: { type: 'ADMISSION_META' },
                              orderBy: { createdAt: 'desc' },
                              take: 1,
                          },
                      },
                  },
              },
          });

          if (!bed) throw new NotFoundException('Cama não encontrada');
          const admission = bed.admissions?.[0];
          if (!admission) throw new NotFoundException('Sem internamento ativo.');

          const currentMeta = this.extractAdmissionMeta(admission.notes?.[0]?.content);
          const beforeState = {
              utente: {
                  name: admission.utente.name,
                  processNumber: admission.utente.processNumber,
                  subsystem: admission.utente.subsystem,
                  birthDate: admission.utente.birthDate,
              },
              admission: {
                  surgeon: admission.surgeon,
                  surgery: admission.surgery,
                  ageYears: admission.ageYears,
                  sex: admission.sex,
                  entryDate: admission.entryDate,
                  dischargeDate: admission.dischargeDate,
              },
              meta: currentMeta,
          };
          const updatedUtente: any = { ...beforeState.utente };
          const updatedAdmission: any = { ...beforeState.admission };

          const sanitizeString = (value: any) => {
              if (value === undefined) return undefined;
              if (value === null) return null;
              if (typeof value !== 'string') return value;
              const trimmed = value.trim();
              return trimmed.length ? trimmed : null;
          };

          const parseInteger = (value: any, label: string) => {
              if (value === undefined) return undefined;
              if (value === null || value === '') return null;
              const parsed = parseInt(value, 10);
              if (isNaN(parsed) || parsed < 0 || parsed > 130) {
                  throw new BadRequestException(`${label} inválida.`);
              }
              return parsed;
          };

          const parseDateField = (value: any, label: string) => {
              if (value === undefined) return undefined;
              if (!value) return null;
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                  throw new BadRequestException(`${label} inválida.`);
              }
              return date;
          };

          const utenteData: any = {};
          if (dto.name !== undefined) {
              const value = sanitizeString(dto.name) || admission.utente.name;
              utenteData.name = value;
              updatedUtente.name = value;
          }
          if (dto.processNumber !== undefined) {
              const value = sanitizeString(dto.processNumber);
              utenteData.processNumber = value;
              updatedUtente.processNumber = value;
          }
          if (dto.subsystem !== undefined) {
              const value = sanitizeString(dto.subsystem);
              utenteData.subsystem = value;
              updatedUtente.subsystem = value;
          }
          if (dto.birthDate !== undefined) {
              if (!dto.birthDate) {
                  utenteData.birthDate = null;
                  updatedUtente.birthDate = null;
              } else {
                  const bDate = new Date(dto.birthDate);
                  if (isNaN(bDate.getTime())) {
                      throw new BadRequestException('Data de nascimento inválida.');
                  }
                  utenteData.birthDate = bDate;
                  updatedUtente.birthDate = bDate;
              }
          }

          if (Object.keys(utenteData).length > 0) {
              await tx.utente.update({
                  where: { id: admission.utente.id },
                  data: utenteData,
              });
          }

          const admissionData: any = {};
          if (dto.surgeon !== undefined) {
              const value = sanitizeString(dto.surgeon) || 'N/A';
              admissionData.surgeon = value;
              updatedAdmission.surgeon = value;
          }
          if (dto.surgery !== undefined) {
              const value = sanitizeString(dto.surgery) || 'N/A';
              admissionData.surgery = value;
              updatedAdmission.surgery = value;
          }
          const ageParsed = parseInteger(dto.ageYears, 'Idade');
          if (ageParsed !== undefined) {
              admissionData.ageYears = ageParsed;
              updatedAdmission.ageYears = ageParsed;
          }
          if (dto.sex !== undefined) {
              const value = sanitizeString(dto.sex);
              admissionData.sex = value;
              updatedAdmission.sex = value;
          }
          const entryDate = parseDateField(dto.entryDate, 'Data de entrada');
          if (entryDate !== undefined) {
              admissionData.entryDate = entryDate;
              updatedAdmission.entryDate = entryDate;
          }
          const dischargeDate = parseDateField(dto.dischargeDate, 'Data de alta');
          if (dischargeDate !== undefined) {
              admissionData.dischargeDate = dischargeDate;
              updatedAdmission.dischargeDate = dischargeDate;
          }

          if (Object.keys(admissionData).length > 0) {
              await tx.admission.update({
                  where: { id: admission.id },
                  data: admissionData,
              });
          }

          let metaChanged = false;
          const updatedMeta = { ...currentMeta };
          if (dto.specialty !== undefined) {
              updatedMeta.specialty = sanitizeString(dto.specialty);
              metaChanged = true;
          }
          if (dto.observations !== undefined) {
              updatedMeta.observations = sanitizeString(dto.observations);
              metaChanged = true;
          }
          if (dto.allergies !== undefined) {
              updatedMeta.allergies = sanitizeString(dto.allergies);
              metaChanged = true;
          }

          const existingMetaNote = admission.notes?.[0];
          if (metaChanged) {
              if (existingMetaNote) {
                  await tx.clinicalNote.update({
                      where: { id: existingMetaNote.id },
                      data: {
                          content: JSON.stringify(updatedMeta),
                          createdBy: userId,
                      },
                  });
              } else {
                  await tx.clinicalNote.create({
                      data: {
                          admissionId: admission.id,
                          content: JSON.stringify(updatedMeta),
                          type: 'ADMISSION_META',
                          createdBy: userId,
                      },
                  });
              }
          }

          const afterState = {
              utente: updatedUtente,
              admission: updatedAdmission,
              meta: updatedMeta,
          };

          await this.audit.logChange(
              tx,
              userId,
              'UPDATE_ADMIN',
              bedId,
              beforeState,
              afterState,
              dto.reason?.trim() || 'Administrative update',
              'Admission',
              admission.id,
          );

          return afterState;
      });
  }

  private extractAdmissionMeta(content?: string | null) {
      if (!content) return { specialty: null, observations: null, allergies: null };
      try {
          const parsed = JSON.parse(content);
          return {
              specialty: parsed?.specialty || null,
              observations: parsed?.observations || null,
              allergies: parsed?.allergies || null,
          };
      } catch {
          return { specialty: null, observations: null, allergies: null };
      }
  }


  async clearBed(userId: string, userRole: string, bedId: string, reason?: string) {
      return this.prisma.$transaction(async (tx) => {
          const bed = await tx.bed.findUnique({
              where: { id: bedId },
              include: {
                  clinicalState: true,
                  admissions: {
                      where: { isActive: true },
                      include: {
                          utente: true,
                          notes: {
                              where: { type: 'ADMISSION_META' },
                              orderBy: { createdAt: 'desc' },
                              take: 1,
                          },
                      },
                  },
              },
          });
          if (!bed) throw new NotFoundException('Cama não encontrada.');
          if (bed.isLocked && userRole !== 'ADMIN') {
              throw new ForbiddenException('Cama bloqueada. Apenas administradores podem limpar.');
          }

          const activeAdmission = bed.admissions[0] || null;
          const currentMeta = activeAdmission ? this.extractAdmissionMeta(activeAdmission.notes?.[0]?.content) : null;
          const beforeState: any = {
              admission: activeAdmission
                  ? {
                        utente: {
                            name: activeAdmission.utente?.name,
                            processNumber: activeAdmission.utente?.processNumber,
                            subsystem: activeAdmission.utente?.subsystem,
                        },
                        surgeon: activeAdmission.surgeon,
                        surgery: activeAdmission.surgery,
                        entryDate: activeAdmission.entryDate,
                        dischargeDate: activeAdmission.dischargeDate,
                        meta: currentMeta,
                    }
                  : null,
              clinicalState: bed.clinicalState || null,
          };

          if (activeAdmission) {
              await tx.admission.update({
                  where: { id: activeAdmission.id },
                  data: { isActive: false, dischargeDate: new Date() },
              });
          }

          const resetClinicalState = {
              cvp_exists: false,
              therapy_exists: false,
              dib_exists: false,
              drains_exists: false,
              drains_location: null,
              drains_volume: null,
              drains_aspect: null,
              drains_obs: null,
              output_exists: false,
              output_count: null,
              output_consistency: null,
              output_obs: null,
              urination_exists: false,
              urination_volume: null,
              urination_obs: null,
              dressings_location: null,
              dressings_type: null,
              dressings_status: null,
              dressings_lastChange: null,
              dressings_obs: null,
          };

          if (bed.clinicalState) {
              await tx.bedClinicalState.update({
                  where: { bedId },
                  data: resetClinicalState,
              });
          } else {
              await tx.bedClinicalState.create({
                  data: {
                      bedId,
                      ...resetClinicalState,
                  },
              });
          }

          await this.audit.logChange(
              tx,
              userId,
              'CLEAR_BED',
              bedId,
              beforeState,
              { cleared: true },
              reason?.trim() || 'Full bed clean',
              'Bed',
              bedId,
          );

          return {
              clearedAdmission: !!activeAdmission,
              clinicalStateReset: true,
          };
      });
  }

  async createUnit(name: string, type?: string) {
    const unitName = this.normalizeText(name);
    if (!unitName) {
      throw new BadRequestException('Nome inválido.');
    }
    const normalizedType = (type || 'FLOOR').toUpperCase();
    if (!['FLOOR', 'SERVICE'].includes(normalizedType)) {
      throw new BadRequestException('Tipo inválido.');
    }
    return this.prisma.floor.create({
      data: { name: unitName, type: normalizedType },
    });
  }

  async deleteUnit(unitId: string) {
    const unit = await this.prisma.floor.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unidade não encontrada.');
    const beds = await this.prisma.bed.findMany({
      where: { floorId: unitId },
      select: { id: true },
    });
    const bedIds = beds.map((bed) => bed.id);
    await this.prisma.$transaction(async (tx) => {
      if (bedIds.length) {
        await tx.auditLog.deleteMany({ where: { targetBedId: { in: bedIds } } });
        await tx.planningEntry.deleteMany({ where: { bedId: { in: bedIds } } });
        await tx.clinicalNote.deleteMany({ where: { admission: { bedId: { in: bedIds } } } });
        await tx.admission.deleteMany({ where: { bedId: { in: bedIds } } });
        await tx.bedClinicalState.deleteMany({ where: { bedId: { in: bedIds } } });
        await tx.bed.deleteMany({ where: { id: { in: bedIds } } });
      }
      await tx.room.deleteMany({ where: { floorId: unitId } });
      await tx.floor.delete({ where: { id: unitId } });
    });
    return { deleted: true };
  }

  async createRoom(unitId: string, name: string) {
    const unit = await this.prisma.floor.findUnique({ where: { id: unitId } });
    if (!unit) throw new BadRequestException('Unidade não encontrada.');
    const roomName = this.normalizeText(name);
    if (!roomName) throw new BadRequestException('Nome inválido.');
    return this.prisma.room.create({
      data: { name: roomName, floorId: unitId },
    });
  }

  async deleteRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Quarto não encontrado.');
    const beds = await this.prisma.bed.findMany({
      where: { roomId },
      select: { id: true },
    });
    const bedIds = beds.map((bed) => bed.id);
    await this.prisma.$transaction(async (tx) => {
      if (bedIds.length) {
        await tx.auditLog.deleteMany({ where: { targetBedId: { in: bedIds } } });
        await tx.planningEntry.deleteMany({ where: { bedId: { in: bedIds } } });
        await tx.clinicalNote.deleteMany({ where: { admission: { bedId: { in: bedIds } } } });
        await tx.admission.deleteMany({ where: { bedId: { in: bedIds } } });
        await tx.bedClinicalState.deleteMany({ where: { bedId: { in: bedIds } } });
        await tx.bed.deleteMany({ where: { id: { in: bedIds } } });
      }
      await tx.room.delete({ where: { id: roomId } });
    });
    return { deleted: true };
  }

  async createBed(roomId: string, code: string, sortOrder?: number) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new BadRequestException('Quarto não encontrado.');
    const bedCode = this.normalizeText(code);
    if (!bedCode) throw new BadRequestException('Código inválido.');
    const computedSortOrder = typeof sortOrder === 'number' ? sortOrder : this.computeSortOrder(bedCode);
    const bed = await this.prisma.bed.create({
      data: {
        roomId,
        floorId: room.floorId,
        code: bedCode,
        sortOrder: computedSortOrder,
        isLocked: false,
      },
    });
    await this.prisma.bedClinicalState.create({ data: { bedId: bed.id } });
    return bed;
  }

  async deleteBed(bedId: string) {
    const bed = await this.prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) throw new NotFoundException('Cama não encontrada.');
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { targetBedId: bedId } });
      await tx.planningEntry.deleteMany({ where: { bedId } });
      await tx.clinicalNote.deleteMany({ where: { admission: { bedId } } });
      await tx.admission.deleteMany({ where: { bedId } });
      await tx.bedClinicalState.deleteMany({ where: { bedId } });
      await tx.bed.delete({ where: { id: bedId } });
    });
    return { deleted: true };
  }
}
