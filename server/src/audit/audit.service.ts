import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Regista uma auditoria. Deve ser chamado dentro de uma transação Prisma sempre que possível,
   * ou logo após a operação.
   */
  async logChange(
    prismaTx: any,
    userId: string,
    action: string,
    targetBedId: string,
    before: any,
    after: any,
    reason: string,
    entity: string = 'Bed',
    entityId: string = 'unknown',
  ) {
    const diff = this.calculateDiff(before, after);
    let bedCode: string | null = null;
    let floorName: string | null = null;

    if (targetBedId) {
      const bed = await prismaTx.bed.findUnique({
        where: { id: targetBedId },
        select: { code: true, floor: { select: { name: true } } },
      });
      bedCode = bed?.code || null;
      floorName = bed?.floor?.name || null;
    }

    await prismaTx.auditLog.create({
      data: {
        userId,
        action,
        targetBedId,
        reason,
        entity,
        entityId,
        bedCode,
        floorName,
        beforeState: before ? JSON.stringify(before) : null,
        afterState: after ? JSON.stringify(after) : null,
        diff: diff && Object.keys(diff).length ? JSON.stringify(diff) : null,
      },
    });
  }

  private calculateDiff(before: any, after: any) {
    const diff: any = {};
    if (!before || !after) return { msg: 'Full change' };

    // Comparação simples de chaves de topo (idealmente seria recursiva profunda)
    // Para este caso, como guardamos JSON string, vamos comparar as chaves do objeto parseado
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    allKeys.forEach(key => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        diff[key] = {
          from: before[key],
          to: after[key]
        };
      }
    });
    return diff;
  }
}
