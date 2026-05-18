import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RidesService } from './rides.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RideStatus } from './entities/ride.entity';

@UseGuards(JwtAuthGuard)
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post('request')
  requestRide(@Request() req, @Body() body: any) {
    return this.ridesService.requestRide(req.user.id, body);
  }

  @Get('estimate')
  estimateFare(@Query() query: any) {
    return this.ridesService.estimateFare(
      parseFloat(query.pickup_lat),
      parseFloat(query.pickup_lng),
      parseFloat(query.dropoff_lat),
      parseFloat(query.dropoff_lng),
    );
  }

  @Get('active')
  getActiveRide(@Request() req) {
    return this.ridesService.getActiveRide(req.user.id);
  }

  @Get('history')
  getHistory(@Request() req) {
    return this.ridesService.getRideHistory(req.user.id, req.user.role);
  }

  @Get(':id')
  getRide(@Param('id') id: string) {
    return this.ridesService.findById(id);
  }

  @Patch(':id/accept')
  acceptRide(@Request() req, @Param('id') id: string) {
    return this.ridesService.acceptRide(req.user.id, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body('status') status: RideStatus,
  ) {
    return this.ridesService.updateStatus(req.user.id, id, status);
  }

  @Patch(':id/cancel')
  cancelRide(
    @Request() req,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.ridesService.cancelRide(req.user.id, id, reason);
  }

  @Post(':id/rate')
  rateRide(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { score: number; comment?: string },
  ) {
    return this.ridesService.rateRide(req.user.id, id, body.score, body.comment);
  }
}
