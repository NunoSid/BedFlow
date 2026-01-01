import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private planning: PlanningService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get(':date')
  async getPlan(@Param('date') date: string) {
    return this.planning.getPlan(date);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  @Post(':date/generate')
  async generatePlan(@Request() req: any, @Param('date') date: string) {
    return this.planning.generatePlan(req.user.id, date);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  @Post(':date/copy')
  async copyPlan(
    @Request() req: any,
    @Param('date') date: string,
    @Body('sourceDate') sourceDate: string,
  ) {
    return this.planning.copyPlan(req.user.id, date, sourceDate);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  @Patch(':date/:bedCode')
  async updateEntry(
    @Request() req: any,
    @Param('date') date: string,
    @Param('bedCode') bedCode: string,
    @Body() body: any
  ) {
    return this.planning.updateEntry(req.user.id, date, bedCode, body);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('NURSE', 'COORDINATOR', 'ADMIN')
  @Post(':date/import')
  async importEntries(
    @Request() req: any,
    @Param('date') date: string,
    @Body('bedCodes') bedCodes: string[],
  ) {
    return this.planning.importEntries(req.user.id, date, bedCodes);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  @Delete(':date/:bedCode')
  async clearEntry(
    @Param('date') date: string,
    @Param('bedCode') bedCode: string,
  ) {
    return this.planning.clearEntry(date, bedCode);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  @Delete(':date')
  async clearPlan(@Param('date') date: string, @Request() req: any) {
    return this.planning.clearPlan(req.user.id, date);
  }
}
