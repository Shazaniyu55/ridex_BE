import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { Ride, RideStatus } from '../rides/entities/ride.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackBaseUrl = 'https://api.paystack.co';

  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Ride) private rideRepo: Repository<Ride>,
    private config: ConfigService,
  ) {}

  private get paystackHeaders() {
    return {
      Authorization: `Bearer ${this.config.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    };
  }

  // Initialize Paystack payment for a ride
  async initializePayment(
    riderId: string,
    rideId: string,
    email: string,
    method: PaymentMethod = PaymentMethod.CARD,
  ) {
    const ride = await this.rideRepo.findOne({ where: { id: rideId, rider_id: riderId } });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Can only pay for completed rides');
    }

    if (method === PaymentMethod.CASH) {
      // Record cash payment directly
      const payment = this.paymentRepo.create({
        ride_id: rideId,
        rider_id: riderId,
        amount: ride.fare,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
      });
      return this.paymentRepo.save(payment);
    }

    // Paystack card payment
    try {
      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/initialize`,
        {
          email,
          amount: Math.round(ride.fare * 100), // convert to kobo
          reference: `UBER_${rideId}_${Date.now()}`,
          metadata: { ride_id: rideId, rider_id: riderId },
          callback_url: `${this.config.get('API_URL', 'http://localhost:3000')}/api/v1/payments/verify`,
        },
        { headers: this.paystackHeaders },
      );

      const payment = this.paymentRepo.create({
        ride_id: rideId,
        rider_id: riderId,
        amount: ride.fare,
        method,
        status: PaymentStatus.PENDING,
        gateway_reference: response.data.data.reference,
      });

      await this.paymentRepo.save(payment);

      return {
        authorization_url: response.data.data.authorization_url,
        reference: response.data.data.reference,
        payment_id: payment.id,
      };
    } catch (error) {
      this.logger.error('Paystack init error', error.message);
      throw new BadRequestException('Payment initialization failed');
    }
  }

  // Verify Paystack payment callback
  async verifyPayment(reference: string): Promise<Payment> {
    try {
      const response = await axios.get(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        { headers: this.paystackHeaders },
      );

      const { status, gateway_response } = response.data.data;
      const payment = await this.paymentRepo.findOne({
        where: { gateway_reference: reference },
      });
      if (!payment) throw new NotFoundException('Payment record not found');

      payment.status =
        status === 'success' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
      payment.gateway_response = gateway_response;

      return this.paymentRepo.save(payment);
    } catch (error) {
      this.logger.error('Paystack verify error', error.message);
      throw new BadRequestException('Payment verification failed');
    }
  }

  async getPaymentForRide(rideId: string): Promise<Payment> {
    return this.paymentRepo.findOne({ where: { ride_id: rideId } });
  }
}
