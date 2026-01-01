import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // Clamp legacy sortOrder values that exceed 32-bit int range.
    await this.$executeRaw`UPDATE Bed SET sortOrder = CAST(sortOrder / 1000 AS INTEGER) WHERE sortOrder > 2147483647`;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
