import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post('register')
  register(@Request() req, @Body() body: any) {
    return this.driversService.registerDriver(req.user.id, body);
  }

  @Get('profile')
  getProfile(@Request() req) {
    return this.driversService.findByUserId(req.user.id);
  }

  @Patch('toggle-online')
  toggleOnline(@Request() req, @Body() body: { is_online: boolean; lat?: number; lng?: number }) {
    return this.driversService.toggleOnlineStatus(
      req.user.id,
      body.is_online,
      body.lat,
      body.lng,
    );
  }

  @Patch('location')
  updateLocation(
    @Request() req,
    @Body() body: { lat: number; lng: number; heading?: number },
  ) {
    return this.driversService.updateLocation(
      req.user.id,
      body.lat,
      body.lng,
      body.heading || 0,
    );
  }

  @Get('stats')
  getStats(@Request() req) {
    return this.driversService.getDriverStats(req.user.id);
  }

  @Get('nearby')
  getNearby(@Body() body: { lat: number; lng: number; radius?: number }) {
    return this.driversService.findNearbyDrivers(body.lat, body.lng, body.radius);
  }
}
