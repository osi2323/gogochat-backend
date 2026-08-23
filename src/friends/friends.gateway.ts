import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3029',
      'http://127.0.0.1:3029',
      'https://ses.akdenizbirlik.com',
      'https://ses.aronodigital.com',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 30 * 1024 * 1024,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class FriendsGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FriendsGateway.name);

  private async emitToUsers(
    tenantId: string | undefined,
    usernames: string[],
    event: string,
    payload: any,
  ) {
    if (!this.server) {
      this.logger.warn('WebSocket server not ready to emit friends event');
      return;
    }

    const normalizedTargets = new Set(
      usernames.map((name) => name?.toLowerCase()).filter(Boolean),
    );
    const connectedSockets = await this.server.fetchSockets();
    const normalizedTenant = tenantId
      ? tenantId.replace(/^tenant_/, '')
      : undefined;

    for (const s of connectedSockets) {
      const socketUsername = (s as any).username?.toLowerCase();
      const socketTenantIdRaw = (s as any).tenantId;
      const socketTenantId = socketTenantIdRaw
        ? String(socketTenantIdRaw).replace(/^tenant_/, '')
        : undefined;
      const isTarget = socketUsername && normalizedTargets.has(socketUsername);
      const sameTenant =
        !normalizedTenant || socketTenantId === normalizedTenant;

      if (isTarget && sameTenant) {
        s.emit(event, payload);
      }
    }
  }

  async emitRequestCreated(
    tenantId: string | undefined,
    usernames: string[],
    payload: any,
  ) {
    await this.emitToUsers(
      tenantId,
      usernames,
      'friends:requestCreated',
      payload,
    );
  }

  async emitRequestUpdated(
    tenantId: string | undefined,
    usernames: string[],
    payload: any,
  ) {
    await this.emitToUsers(
      tenantId,
      usernames,
      'friends:requestUpdated',
      payload,
    );
  }

  async emitRequestRemoved(
    tenantId: string | undefined,
    usernames: string[],
    payload: any,
  ) {
    await this.emitToUsers(
      tenantId,
      usernames,
      'friends:requestRemoved',
      payload,
    );
  }
}
