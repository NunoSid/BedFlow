import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards, BadRequestException, ForbiddenException, Patch } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { hashPassword } from './password.utils';

@Controller('auth/users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async listUsers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async createUser(
    @Body('username') username: string,
    @Body('fullName') fullName: string,
    @Body('password') password: string,
    @Body('role') role: string,
  ) {
    if (!username || !password || !fullName || !role) {
      throw new BadRequestException('All fields are required.');
    }
    const normalizedRole = role.toUpperCase();
    if (!['ADMIN', 'NURSE', 'COORDINATOR'].includes(normalizedRole)) {
      throw new BadRequestException('Invalid role.');
    }

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestException('Username already exists.');
    }

    const passwordHash = hashPassword(password);
    const created = await this.prisma.user.create({
      data: { username, fullName, role: normalizedRole, passwordHash },
      select: { id: true, username: true, fullName: true, role: true, createdAt: true },
    });
    return created;
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Request() req: any) {
    if (req.user.id === id) {
      throw new BadRequestException('You cannot remove your own user.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    if (user.role === 'ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Not allowed to remove administrators.');
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        username: `${user.username}#${Date.now()}`,
      },
    });
    return { success: true, softDeleted: true };
  }

  @Patch(':id/password')
  async resetUserPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    const passwordHash = hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    return { success: true };
  }
}
