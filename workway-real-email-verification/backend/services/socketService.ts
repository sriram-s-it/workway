import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
        (socket as any).user = decoded;
      } catch {
        // Allow unauthenticated connection for public status views if needed
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (user) {
      // Join personal room for private notifications
      socket.join(`user:${user.id}`);
      socket.join(`role:${user.role}`);
      if (user.department_id) {
        socket.join(`department:${user.department_id}`);
      }
      console.log(`[Socket] User connected: ${user.email} (${user.role})`);
    }

    // Join specific booking room
    socket.on('join_booking', (bookingId: string) => {
      if (bookingId) {
        socket.join(`booking:${bookingId}`);
      }
    });

    socket.on('leave_booking', (bookingId: string) => {
      if (bookingId) {
        socket.leave(`booking:${bookingId}`);
      }
    });

    socket.on('disconnect', () => {
      // Disconnected
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: string | number, event: string, data: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToRole(role: string, event: string, data: any) {
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
}

export function emitToDepartment(departmentId: number | string, event: string, data: any) {
  if (io) {
    io.to(`department:${departmentId}`).emit(event, data);
  }
}

export function emitBookingUpdate(bookingId: string, event: string, data: any) {
  if (io) {
    io.to(`booking:${bookingId}`).emit(event, data);
    // Also broadcast to public if listening
    io.emit(`booking_update:${bookingId}`, { event, ...data });
  }
}
