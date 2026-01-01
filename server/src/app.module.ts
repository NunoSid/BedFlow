import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';
import { BedsController } from './beds/beds.controller';
import { BedsService } from './beds/beds.service';
import { AuthModule } from './auth/auth.module';
import { JwtStrategy } from './auth/jwt.strategy';
import { UsersController } from './auth/users.controller';
import { PlanningController } from './planning/planning.controller';
import { PlanningService } from './planning/planning.service';
import { RolesGuard } from './auth/roles.guard';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }), // Registo Global Explicito
    AuthModule,
  ],
  controllers: [BedsController, UsersController, PlanningController, AuditController, SettingsController],
  providers: [
    PrismaService,
    AuditService,
    BedsService,
    JwtStrategy,
    PlanningService,
    RolesGuard,
    SettingsService,
  ], // JwtStrategy aqui também
})
export class AppModule {}
