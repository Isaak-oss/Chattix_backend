import { OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthTokenService } from '@modules/auth/auth-token.service';

export interface GatewayUser {
  id: ID;
  email: Email;
}

export type AuthenticatedSocket<TUser extends GatewayUser = GatewayUser> = Socket & {
  user?: TUser;
};

export abstract class AuthenticatedGateway<TUser extends GatewayUser = GatewayUser>
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  protected server: Server;

  private readonly socketsByUser = new Map<ID, Set<string>>();

  protected constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly eventPrefix: string,
  ) {}

  async handleConnection(client: AuthenticatedSocket<TUser>) {
    try {
      const user = (await this.authenticate(client)) as TUser;
      client.user = user;
      await client.join(this.getUserRoom(user.id));
      this.addUserSocket(user.id, client.id);

      client.emit(`${this.eventPrefix}:connected`, { userId: user.id });
    } catch (error) {
      client.emit(`${this.eventPrefix}:error`, {
        message: error instanceof Error ? error.message : 'Unauthorized',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket<TUser>) {
    const userId = client.user?.id;
    if (!userId) return;

    this.removeUserSocket(userId, client.id);
  }

  protected emitGatewayEventToUser(userId: ID, event: string, payload: unknown) {
    this.server.to(this.getUserRoom(userId)).emit(event, payload);
  }

  protected emitGatewayEventToUsers(userIds: ID[], event: string, payload: unknown) {
    userIds.forEach((userId) => this.emitGatewayEventToUser(userId, event, payload));
  }

  protected emitGatewayEventSystem(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }

  protected isUserOnline(userId: ID) {
    return this.socketsByUser.has(userId);
  }

  protected getUserRoom(userId: ID) {
    return `user:${userId}`;
  }

  private async authenticate(client: Socket): Promise<GatewayUser> {
    const token = this.authTokenService.extractSocketToken({
      authToken: client.handshake.auth?.token,
      authorization: client.handshake.headers.authorization,
      cookieHeader: client.handshake.headers.cookie,
    });

    return this.authTokenService.authenticateToken(token);
  }

  private addUserSocket(userId: ID, socketId: string) {
    const userSockets = this.socketsByUser.get(userId) ?? new Set<string>();
    userSockets.add(socketId);
    this.socketsByUser.set(userId, userSockets);
  }

  private removeUserSocket(userId: ID, socketId: string) {
    const userSockets = this.socketsByUser.get(userId);
    if (!userSockets) return;

    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      this.socketsByUser.delete(userId);
    }
  }
}
