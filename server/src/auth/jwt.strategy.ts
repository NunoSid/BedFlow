import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'bedflow-dev-secret',
    });
  }

  async validate(payload: any) {
    // Validar se o user ainda existe na BD e está ativo
    const user = await this.prisma.user.findUnique({
        where: { id: payload.sub }
    });
    
    if (!user || !user.isActive) {
        return null; // Rejeita o token
    }

    return { id: user.id, username: user.username, role: user.role, fullName: user.fullName };
  }
}
