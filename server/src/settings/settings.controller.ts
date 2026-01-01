import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  getSettings() {
    return this.settings.getSettings();
  }

  @Put('hospital-name')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('COORDINATOR', 'ADMIN')
  updateHospitalName(@Body() body: { value?: string }) {
    return this.settings.setHospitalName(body?.value || '');
  }
}
