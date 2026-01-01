import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get('logs')
  @Roles('COORDINATOR', 'ADMIN')
  async getLogs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('bedCode') bedCode?: string,
    @Query('patient') patient?: string,
    @Query('processNumber') processNumber?: string,
    @Query('take') takeParam?: string,
    @Query('floor') floorName?: string,
  ) {
    const take = Math.min(Math.max(Number(takeParam) || 200, 1), 500);
    const where: any = {};

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        const until = new Date(endDate);
        until.setHours(23, 59, 59, 999);
        where.timestamp.lte = until;
      }
    }

    if (bedCode) {
      const normalized = bedCode.trim();
      if (normalized) {
        where.OR = [
          { bedCode: { contains: normalized, mode: 'insensitive' } },
          { targetBed: { code: { contains: normalized, mode: 'insensitive' } } },
        ];
      }
    }

    if (floorName) {
      const normalizedFloor = floorName.trim();
      if (normalizedFloor) {
        where.floorName = normalizedFloor;
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      take,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        targetBed: {
          select: {
            id: true,
            code: true,
            floor: { select: { name: true } },
            admissions: {
              where: { isActive: true },
              select: { id: true, utente: { select: { name: true, processNumber: true } } },
              take: 1,
            },
          },
        },
      },
    });

    const admissionIds = Array.from(
      new Set(
        logs
          .filter(log => log.entity === 'Admission' && log.entityId)
          .map(log => log.entityId),
      ),
    );

    let admissionMap = new Map<string, { name?: string | null; processNumber?: string | null }>();
    if (admissionIds.length > 0) {
      const admissions = await this.prisma.admission.findMany({
        where: { id: { in: admissionIds } },
        select: { id: true, utente: { select: { name: true, processNumber: true } } },
      });
      admissionMap = new Map(
        admissions.map(item => [item.id, { name: item.utente?.name, processNumber: item.utente?.processNumber }]),
      );
    }

    const parseJson = (value?: string | null) => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const patientCache = new Map<string, { name?: string | null; processNumber?: string | null }>();

    const getPatientSnapshot = (log: any) => {
      if (patientCache.has(log.id)) {
        return patientCache.get(log.id);
      }
      let snapshot: { name?: string | null; processNumber?: string | null } | null = null;
      if (log.entity === 'Admission' && log.entityId) {
        snapshot = admissionMap.get(log.entityId) || null;
      }
      if (!snapshot) {
        const states = [parseJson(log.afterState), parseJson(log.beforeState)];
        for (const state of states) {
          if (!state) continue;
          const utente = state?.utente || state?.admission?.utente;
          if (utente?.name || utente?.processNumber) {
            snapshot = { name: utente.name, processNumber: utente.processNumber };
            break;
          }
          if (state?.meta?.patientName) {
            snapshot = {
              name: state.meta.patientName,
              processNumber: state.meta.processNumber,
            };
            break;
          }
        }
      }
      if (!snapshot) {
        const activeAdmission = log.targetBed?.admissions?.[0];
        if (activeAdmission?.utente) {
          snapshot = {
            name: activeAdmission.utente.name,
            processNumber: activeAdmission.utente.processNumber,
          };
        }
      }
      patientCache.set(log.id, snapshot || {});
      return snapshot || {};
    };

    const patientFilter = patient?.trim().toLowerCase() || '';
    const processFilter = processNumber?.trim().toLowerCase() || '';

    const filteredLogs = logs.filter(log => {
      const snapshot = getPatientSnapshot(log);
      const matchesPatient = patientFilter
        ? snapshot?.name?.toLowerCase().includes(patientFilter)
        : true;
      const matchesProcess = processFilter
        ? snapshot?.processNumber?.toLowerCase().includes(processFilter)
        : true;
      return matchesPatient && matchesProcess;
    });

    return filteredLogs.map(log => {
      const snapshot = getPatientSnapshot(log);
      return {
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        reason: log.reason,
        entity: log.entity,
        bedCode: log.bedCode || log.targetBed?.code || null,
        floorName: log.floorName || log.targetBed?.floor?.name || null,
        user: log.user,
        patientName: snapshot?.name || null,
        patientProcessNumber: snapshot?.processNumber || null,
        diff: parseJson(log.diff),
        beforeState: parseJson(log.beforeState),
        afterState: parseJson(log.afterState),
      };
    });
  }
}
