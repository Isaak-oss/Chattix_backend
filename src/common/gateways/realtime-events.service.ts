import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { AuthenticatedSocket, GatewayUser } from './authenticated.gateway';

type RealtimeHandler = (
  client: AuthenticatedSocket<GatewayUser>,
  body: unknown,
) => Promise<unknown> | unknown;

@Injectable()
export class RealtimeEventsService {
  private server?: Server;
  private readonly handlers = new Map<string, RealtimeHandler>();
  private readonly socketsByUser = new Map<ID, Set<string>>();
  private readonly manuallyOfflineUsers = new Set<ID>();

  bindServer(server: Server) {
    this.server = server;
  }

  registerHandler(event: string, handler: RealtimeHandler) {
    this.handlers.set(event, handler);
  }

  handle(event: string, client: AuthenticatedSocket<GatewayUser>, body: unknown) {
    const handler = this.handlers.get(event);

    if (!handler) {
      const payload = { message: `Handler for ${event} not found` };
      client.emit('realtime:error', payload);
      return { error: payload };
    }

    return handler(client, body);
  }

  emitToUser(userId: ID, event: string, payload: unknown) {
    this.server?.to(this.getUserRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: ID[], event: string, payload: unknown) {
    userIds.forEach((userId) => this.emitToUser(userId, event, payload));
  }

  emitSystem(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }

  addUserSocket(userId: ID, socketId: string) {
    const wasOnline = this.isOnline(userId);
    const userSockets = this.socketsByUser.get(userId) ?? new Set<string>();
    userSockets.add(socketId);
    this.socketsByUser.set(userId, userSockets);
    this.manuallyOfflineUsers.delete(userId);

    return !wasOnline && this.isOnline(userId);
  }

  removeUserSocket(userId: ID, socketId: string) {
    const wasOnline = this.isOnline(userId);
    const userSockets = this.socketsByUser.get(userId);
    if (!userSockets) return false;

    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      this.socketsByUser.delete(userId);
      this.manuallyOfflineUsers.delete(userId);
    }

    return wasOnline && !this.isOnline(userId);
  }

  setUserOnline(userId: ID, isOnline: boolean) {
    const wasOnline = this.isOnline(userId);

    if (isOnline) {
      this.manuallyOfflineUsers.delete(userId);
    } else {
      this.manuallyOfflineUsers.add(userId);
    }

    return wasOnline !== this.isOnline(userId);
  }

  isOnline(userId: ID) {
    return this.socketsByUser.has(userId) && !this.manuallyOfflineUsers.has(userId);
  }

  private getUserRoom(userId: ID) {
    return `user:${userId}`;
  }
}
