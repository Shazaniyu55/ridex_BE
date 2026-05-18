import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentMethod } from './entities/payment.entity';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  initializePayment(
    @Request() req,
    @Body() body: { ride_id: string; email: string; method?: PaymentMethod },
  ) {
    return this.paymentsService.initializePayment(
      req.user.id,
      body.ride_id,
      body.email,
      body.method,
    );
  }

  // Paystack webhook/callback — no auth required
  @Get('verify')
  verifyPayment(@Query('reference') reference: string) {
    return this.paymentsService.verifyPayment(reference);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ride/:rideId')
  getPaymentForRide(@Param('rideId') rideId: string) {
    return this.paymentsService.getPaymentForRide(rideId);
  }
}
