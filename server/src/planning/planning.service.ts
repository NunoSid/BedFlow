import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BedsService } from '../beds/beds.service';

@Injectable()
export class PlanningService {
  constructor(
    private prisma: PrismaService,
    private bedsService: BedsService,
  ) {}

  private normalizeDate(dateStr: string): Date {
    if (!dateStr) {
      throw new BadRequestException('Data inválida.');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Data inválida.');
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private sanitize(value?: string | null, maxLength = 255): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
  }

  private parseOptionalDate(input: any, label = 'Data'): Date | null | undefined {
    if (input === undefined) return undefined;
    if (input === null || input === '') return null;
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`${label} inválida.`);
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private parseOptionalAge(input: any): number | null | undefined {
    if (input === undefined) return undefined;
    if (input === null || input === '') return null;
    const parsed = Number(input);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 130) {
      throw new BadRequestException('Idade inválida.');
    }
    return parsed;
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

  private formatDateIso(value?: Date | null) {
    if (!value) return null;
    return value.toISOString();
  }

  private buildEmptyPlanRow(bed: any) {
    return {
      id: `empty-${bed.id}`,
      bedId: bed.id,
      bedCode: bed.code,
      floorName: bed.floor?.name || null,
      utenteName: null,
      utenteProcessNumber: null,
      ageYears: null,
      sex: null,
      surgeon: null,
      specialty: null,
      surgery: null,
      subsystem: null,
      allergies: null,
      observations: null,
      entryDate: null,
      dischargeDate: null,
      origin: 'EMPTY',
    };
  }

  private normalizePlanningEntry(entry: any, fallbackBed?: any) {
    return {
      id: entry.id,
      bedCode: entry.bedCode,
      bedId: entry.bedId || entry.bed?.id || fallbackBed?.id || null,
      floorName: entry.bed?.floor?.name || fallbackBed?.floor?.name || null,
      utenteName: entry.utenteName || null,
      utenteProcessNumber: entry.utenteProcessNumber || null,
      ageYears: entry.ageYears ?? null,
      sex: entry.sex || null,
      surgeon: entry.surgeon || null,
      specialty: entry.specialty || null,
      surgery: entry.surgery || null,
      subsystem: entry.subsystem || null,
      allergies: entry.allergies || null,
      observations: entry.observations || null,
      entryDate: this.formatDateIso(entry.entryDate),
      dischargeDate: this.formatDateIso(entry.dischargeDate),
      origin: entry.origin || 'PLAN',
    };
  }

  async getPlan(dateStr: string) {
    const planDate = this.normalizeDate(dateStr);
    const [entries, beds, predictiveAdmissions] = await Promise.all([
      this.prisma.planningEntry.findMany({
        where: { planDate },
        include: {
          bed: {
            select: {
              id: true,
              code: true,
              floor: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.bed.findMany({
        include: { floor: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.admission.findMany({
        where: {
          isActive: true,
          entryDate: { lte: planDate },
          OR: [{ dischargeDate: null }, { dischargeDate: { gte: planDate } }],
        },
        include: {
          utente: true,
          bed: { include: { floor: true } },
          notes: {
            where: { type: 'ADMISSION_META' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const entryMap = new Map<string, any>();
    entries.forEach((entry) => entryMap.set(entry.bedCode, entry));

    const predictedMap = new Map<string, any>();
    for (const admission of predictiveAdmissions) {
      const bedCode = admission.bed?.code;
      if (!bedCode) continue;
      if (entryMap.has(bedCode) || predictedMap.has(bedCode)) continue;
      const meta = this.extractAdmissionMeta(admission.notes?.[0]?.content);
      predictedMap.set(bedCode, {
        id: `prediction-${admission.id}`,
        bedCode,
        bedId: admission.bed?.id || null,
        floorName: admission.bed?.floor?.name || null,
        utenteName: admission.utente?.name || null,
        utenteProcessNumber: admission.utente?.processNumber || null,
        ageYears: admission.ageYears ?? null,
        sex: admission.sex || null,
        surgeon: admission.surgeon || null,
        specialty: meta.specialty || null,
        surgery: admission.surgery || null,
        subsystem: admission.utente?.subsystem || null,
        allergies: meta.allergies || null,
        observations:
          meta.observations ||
          `Internado desde ${admission.entryDate.toISOString().substring(0, 10)}`,
        entryDate: this.formatDateIso(admission.entryDate),
        dischargeDate: this.formatDateIso(admission.dischargeDate),
        origin: 'PREDICTION',
      });
    }

    const rows: any[] = [];
    for (const bed of beds) {
      const stored = entryMap.get(bed.code);
      if (stored) {
        rows.push(this.normalizePlanningEntry(stored, bed));
        entryMap.delete(bed.code);
        continue;
      }
      const predicted = predictedMap.get(bed.code);
      if (predicted) {
        rows.push({
          ...predicted,
          bedCode: bed.code,
          bedId: bed.id,
          floorName: bed.floor?.name || null,
        });
        predictedMap.delete(bed.code);
        continue;
      }
      rows.push(this.buildEmptyPlanRow(bed));
    }

    const orphanEntries = Array.from(entryMap.values()).map((entry) =>
      this.normalizePlanningEntry(entry),
    );
    orphanEntries.sort((a, b) => (a.bedCode || '').localeCompare(b.bedCode || ''));
    rows.push(...orphanEntries);

    const extraPredicted = Array.from(predictedMap.values()).map((row) => row);
    extraPredicted.sort((a, b) => (a.bedCode || '').localeCompare(b.bedCode || ''));
    rows.push(...extraPredicted);

    return rows;
  }

  async generatePlan(userId: string, dateStr: string) {
    const planDate = this.normalizeDate(dateStr);
    const beds = await this.prisma.bed.findMany({
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
        floor: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return this.prisma.$transaction(async (tx) => {
      const entries = [];
      for (const bed of beds) {
        const admission = bed.admissions?.[0];
        const meta = this.extractAdmissionMeta(admission?.notes?.[0]?.content);
        const payload = {
          bedId: bed.id,
          bedCode: bed.code,
          utenteName: admission?.utente?.name ?? null,
          utenteProcessNumber: admission?.utente?.processNumber ?? null,
          ageYears: admission?.ageYears ?? null,
          sex: admission?.sex ?? null,
          surgeon: admission?.surgeon ?? null,
          specialty: meta.specialty ?? null,
          surgery: admission?.surgery ?? null,
          subsystem: admission?.utente?.subsystem ?? null,
          allergies: meta.allergies ?? null,
          observations: meta.observations ?? (admission ? `Internado desde ${admission.entryDate.toISOString().substring(0, 10)}` : null),
          entryDate: admission?.entryDate ?? null,
          dischargeDate: admission?.dischargeDate ?? null,
          createdByUserId: userId,
          planDate,
        };

        const entry = await tx.planningEntry.upsert({
          where: { planDate_bedCode: { planDate, bedCode: bed.code } },
          update: payload,
          create: payload,
        });
        entries.push(entry);
      }
      return entries;
    });
  }

  async updateEntry(userId: string, dateStr: string, bedCode: string, dto: any) {
    const planDate = this.normalizeDate(dateStr);
    const bed = await this.prisma.bed.findUnique({
      where: { code: bedCode },
      select: { id: true, code: true, floor: { select: { id: true, name: true } } },
    });

    const payload: any = {
      utenteName: this.sanitize(dto.utenteName),
      utenteProcessNumber: this.sanitize(dto.utenteProcessNumber),
      ageYears: this.parseOptionalAge(dto.ageYears),
      sex: this.sanitize(dto.sex),
      surgeon: this.sanitize(dto.surgeon),
      specialty: this.sanitize(dto.specialty),
      surgery: this.sanitize(dto.surgery),
      subsystem: this.sanitize(dto.subsystem),
      allergies: this.sanitize(dto.allergies, 255),
      observations: this.sanitize(dto.observations, 500),
      bedId: bed?.id ?? null,
      createdByUserId: userId,
    };

    const entryDate = this.parseOptionalDate(dto.entryDate, 'Data de entrada');
    if (entryDate !== undefined) {
      payload.entryDate = entryDate;
    }
    const dischargeDate = this.parseOptionalDate(dto.dischargeDate, 'Data de alta');
    if (dischargeDate !== undefined) {
      payload.dischargeDate = dischargeDate;
    }

    const entry = await this.prisma.planningEntry.upsert({
      where: { planDate_bedCode: { planDate, bedCode } },
      update: payload,
      create: {
        ...payload,
        planDate,
        bedCode,
      },
      include: {
        bed: {
          select: {
            id: true,
            code: true,
            floor: { select: { id: true, name: true } },
          },
        },
      },
    });
    return entry;
  }

  async importEntries(userId: string, dateStr: string, bedCodes: string[]) {
    if (!Array.isArray(bedCodes) || bedCodes.length === 0) {
      throw new BadRequestException('Selecione pelo menos uma cama.');
    }
    const planDate = this.normalizeDate(dateStr);
    const entries = await this.prisma.planningEntry.findMany({
      where: { planDate, bedCode: { in: bedCodes } },
      include: { bed: true },
    });

    const results: any[] = [];
    for (const code of bedCodes) {
      const entry = entries.find((item) => item.bedCode === code);
      if (!entry) {
        results.push({ bedCode: code, status: 'error', message: 'Não existe planeamento para esta cama.' });
        continue;
      }
      const bed = entry.bed ?? (await this.prisma.bed.findUnique({ where: { code } }));
      if (!bed) {
        results.push({ bedCode: code, status: 'error', message: 'Cama não encontrada.' });
        continue;
      }
      if (!entry.utenteName) {
        results.push({ bedCode: code, status: 'error', message: 'Planeamento sem nome de utente.' });
        continue;
      }
      try {
        const extendedEntry: any = entry;
        await this.bedsService.admitPatient(userId, bed.id, {
          name: entry.utenteName,
          processNumber: entry.utenteProcessNumber,
          ageYears: extendedEntry.ageYears,
          sex: extendedEntry.sex,
          surgeon: entry.surgeon,
          surgery: entry.surgery,
          specialty: entry.specialty,
          subsystem: entry.subsystem,
          observations: entry.observations,
          allergies: extendedEntry.allergies,
          entryDate: entry.entryDate?.toISOString(),
          dischargeDate: entry.dischargeDate?.toISOString(),
        });
        results.push({ bedCode: code, status: 'success' });
      } catch (error: any) {
        results.push({ bedCode: code, status: 'error', message: error?.message || 'Erro ao importar.' });
      }
    }

    return { date: planDate.toISOString(), results };
  }

  async copyPlan(userId: string, targetDateStr: string, sourceDateStr?: string) {
    if (!sourceDateStr) {
      throw new BadRequestException('Selecione a data de origem.');
    }
    const targetDate = this.normalizeDate(targetDateStr);
    const sourceDate = this.normalizeDate(sourceDateStr);
    const entries = await this.prisma.planningEntry.findMany({
      where: { planDate: sourceDate },
    });
    if (!entries.length) {
      throw new BadRequestException('Não existe planeamento para a data de origem.');
    }
    return this.prisma.$transaction(async (tx) => {
      const saved = [];
      for (const entry of entries) {
        const typedEntry: any = entry;
        const baseData = {
          bedId: entry.bedId,
          utenteName: entry.utenteName,
          utenteProcessNumber: entry.utenteProcessNumber,
          ageYears: typedEntry.ageYears ?? null,
          sex: typedEntry.sex ?? null,
          surgeon: entry.surgeon,
          specialty: entry.specialty,
          surgery: entry.surgery,
          subsystem: entry.subsystem,
          allergies: typedEntry.allergies ?? null,
          observations: entry.observations,
          entryDate: entry.entryDate,
          dischargeDate: entry.dischargeDate,
        };
        const upserted = await tx.planningEntry.upsert({
          where: { planDate_bedCode: { planDate: targetDate, bedCode: entry.bedCode } },
          update: {
            ...baseData,
            createdByUserId: userId,
          },
          create: {
            ...baseData,
            bedCode: entry.bedCode,
            planDate: targetDate,
            createdByUserId: userId,
          },
        });
        saved.push(upserted);
      }
      return saved;
    });
  }

  async clearEntry(dateStr: string, bedCode: string) {
    if (!bedCode) {
      throw new BadRequestException('Código de cama inválido.');
    }
    const planDate = this.normalizeDate(dateStr);
    const existing = await this.prisma.planningEntry.findUnique({
      where: { planDate_bedCode: { planDate, bedCode } },
    });
    if (!existing) {
      return { cleared: false };
    }
    await this.prisma.planningEntry.delete({
      where: { planDate_bedCode: { planDate, bedCode } },
    });
    return { cleared: true };
  }

  async clearPlan(userId: string, dateStr: string) {
    if (!userId) {
      throw new BadRequestException('Utilizador inválido.');
    }
    const planDate = this.normalizeDate(dateStr);
    const deleted = await this.prisma.planningEntry.deleteMany({
      where: { planDate },
    });
    return { date: planDate.toISOString(), removed: deleted.count };
  }
}
