import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password.utils';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Inactive user');

    const pwMatches = verifyPassword(dto.password, user.passwordHash);
    if (!pwMatches) throw new UnauthorizedException('Invalid credentials');

    return this.signToken(user.id, user.username, user.role, user.fullName);
  }

  async signToken(userId: string, username: string, role: string, fullName?: string) {
    const payload = { sub: userId, username, role, fullName };
    const expiresIn = process.env.JWT_EXPIRES || '2h';
    const token = await this.jwt.signAsync(payload, {
      expiresIn,
      secret: process.env.JWT_SECRET || 'bedflow-dev-secret',
    });
    return { access_token: token, user: { id: userId, username, role, fullName } };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Provide current and new password.');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    const matches = verifyPassword(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    const passwordHash = hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { success: true };
  }
}
