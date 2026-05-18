import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Ride } from '../rides/entities/ride.entity';
import { Driver } from '../drivers/entities/driver.entity';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/rides',
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RidesGateway.name);

  // Map userId → socketId
  private connectedUsers = new Map<string, string>();
  // Map socketId → userId
  private socketToUser = new Map<string, string>();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      this.connectedUsers.set(payload.sub, client.id);
      this.socketToUser.set(client.id, payload.sub);

      // Join personal room
      client.join(`user:${payload.sub}`);

      this.logger.log(`User ${payload.sub} connected — socket ${client.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      this.connectedUsers.delete(userId);
      this.socketToUser.delete(client.id);
      this.logger.log(`User ${userId} disconnected`);
    }
  }

  // ── Broadcast ride request to nearby driver sockets ───────────────────

  async broadcastRideRequest(ride: Ride, nearbyDrivers: Driver[]) {
    for (const driver of nearbyDrivers) {
      const socketId = this.connectedUsers.get(driver.user_id);
      if (socketId) {
        this.server.to(`user:${driver.user_id}`).emit('new_ride_request', {
          ride_id: ride.id,
          pickup_address: ride.pickup_address,
          dropoff_address: ride.dropoff_address,
          fare: ride.fare,
          distance_km: ride.distance_km,
          ride_type: ride.ride_type,
          pickup_lat: ride.pickup_lat,
          pickup_lng: ride.pickup_lng,
        });
      }
    }
  }

  // ── Notify specific rider ─────────────────────────────────────────────

  notifyRider(riderId: string, event: string, data: any) {
    this.server.to(`user:${riderId}`).emit(event, data);
  }

  // ── Notify specific driver ────────────────────────────────────────────

  notifyDriver(driverUserId: string, event: string, data: any) {
    this.server.to(`user:${driverUserId}`).emit(event, data);
  }

  // ── Client subscribes to ride room ────────────────────────────────────

  @SubscribeMessage('join_ride')
  handleJoinRide(@ConnectedSocket() client: Socket, @MessageBody() data: { ride_id: string }) {
    client.join(`ride:${data.ride_id}`);
    return { event: 'joined', data: { room: `ride:${data.ride_id}` } };
  }

  @SubscribeMessage('leave_ride')
  handleLeaveRide(@ConnectedSocket() client: Socket, @MessageBody() data: { ride_id: string }) {
    client.leave(`ride:${data.ride_id}`);
  }

  // Emit to entire ride room
  broadcastToRide(rideId: string, event: string, data: any) {
    this.server.to(`ride:${rideId}`).emit(event, data);
  }
}
