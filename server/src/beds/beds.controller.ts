import { Controller, Get, Post, Body, Param, UseGuards, Request, Patch, HttpException, HttpStatus, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BedsService } from './beds.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('beds')
export class BedsController {
  constructor(private bedsService: BedsService) {}

  @Get('floors')
  @UseGuards(AuthGuard('jwt'))
  async getFloors() {
    try {
      return await this.bedsService.getFloors();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id/clinical')
  @UseGuards(AuthGuard('jwt'))
  async updateClinical(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { field: string; value: any; reason?: string }
  ) {
    return this.bedsService.updateClinicalState(
      req.user.id,
      req.user.role,
      id,
      body.field,
      body.value,
      body.reason || 'Rotina',
    );
  }

  @Patch(':id/clinical/bulk')
  @UseGuards(AuthGuard('jwt'))
  async updateClinicalBulk(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { updates: Record<string, any>; reason?: string },
  ) {
    return this.bedsService.updateClinicalBulk(req.user.id, req.user.role, id, body?.updates || {}, body?.reason);
  }

  @Post(':id/lock')
  @UseGuards(AuthGuard('jwt'))
  async toggleLock(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string }
  ) {
    return this.bedsService.toggleLock(req.user.id, req.user.role, id, body?.reason);
  }

  @Post(':id/admit')
  @UseGuards(AuthGuard('jwt'))
  async admitPatient(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any
  ) {
    return this.bedsService.admitPatient(req.user.id, id, body);
  }

  @Post(':id/discharge')
  @UseGuards(AuthGuard('jwt'))
  async dischargePatient(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string }
  ) {
    return this.bedsService.dischargePatient(req.user.id, id, body?.reason);
  }

  @Patch(':id/admin')
  @UseGuards(AuthGuard('jwt'))
  async updateAdministrative(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.bedsService.updateAdministrativeData(req.user.id, id, body);
  }

  @Get(':id/history')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async getHistory(@Param('id') id: string) {
    return this.bedsService.getHistory(id);
  }

  @Post(':id/clear')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async clearBed(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.bedsService.clearBed(req.user.id, req.user.role, id, body?.reason);
  }

  @Get('structure')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async getStructure() {
    return this.bedsService.getStructure();
  }

  @Post('units')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async createUnit(
    @Body('name') name: string,
    @Body('type') type: string,
  ) {
    return this.bedsService.createUnit(name, type);
  }

  @Delete('units/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async deleteUnit(@Param('id') id: string) {
    return this.bedsService.deleteUnit(id);
  }

  @Post('rooms')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async createRoom(
    @Body('unitId') unitId: string,
    @Body('name') name: string,
  ) {
    return this.bedsService.createRoom(unitId, name);
  }

  @Delete('rooms/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async deleteRoom(@Param('id') id: string) {
    return this.bedsService.deleteRoom(id);
  }

  @Post('rooms/:id/beds')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async createBed(
    @Param('id') roomId: string,
    @Body('code') code: string,
    @Body('sortOrder') sortOrder?: number,
  ) {
    return this.bedsService.createBed(roomId, code, sortOrder);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  async deleteBed(@Param('id') id: string) {
    return this.bedsService.deleteBed(id);
  }
}
