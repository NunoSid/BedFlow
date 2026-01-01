import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const hospital = await this.prisma.setting.findUnique({ where: { key: 'hospitalName' } });
    return {
      hospitalName: hospital?.value || '',
    };
  }

  async setHospitalName(value: string) {
    const name = String(value || '').trim();
    if (!name) {
      throw new BadRequestException('Nome do hospital inválido.');
    }
    await this.prisma.setting.upsert({
      where: { key: 'hospitalName' },
      update: { value: name },
      create: { key: 'hospitalName', value: name },
    });
    return { hospitalName: name };
  }
}
