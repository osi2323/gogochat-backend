import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RoomsGateway } from '../rooms/rooms.gateway';

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
export class DirectMessagesGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DirectMessagesGateway.name);

  private getServer(): Server | null {
    return this.server ?? RoomsGateway.getSharedServer();
  }

  private normalizeTenantId(tenantId: string | undefined) {
    return tenantId ? tenantId.replace(/^tenant_/, '') : undefined;
  }

  private getSocketUsername(socket: any): string | undefined {
    return (
      socket?.username ??
      socket?.data?.username ??
      socket?.data?.roomPresenceState?.username
    );
  }

  private getSocketTenantId(socket: any): string | undefined {
    return (
      socket?.tenantId ??
      socket?.data?.tenantId ??
      socket?.data?.roomPresenceState?.tenantId
    );
  }

  private getSocketAgentNickname(socket: any): string | undefined {
    return (
      socket?.agentNickname ??
      socket?.data?.agentNickname ??
      socket?.data?.roomPresenceState?.agentNickname
    );
  }

  private matchesAgentNickname(socket: any, agentNickname?: string | null) {
    if (agentNickname === undefined) {
      return true;
    }

    const requestedNickname = agentNickname?.trim().toLowerCase();
    const socketNickname = this.getSocketAgentNickname(socket)
      ?.trim()
      .toLowerCase();

    if (requestedNickname) {
      return socketNickname === requestedNickname;
    }

    return !socketNickname;
  }

  async isUserOnline(
    tenantId: string | undefined,
    username: string,
    agentNickname?: string | null,
  ): Promise<boolean> {
    const server = this.getServer();
    if (!server) return false;

    const normalizedTarget = username?.toLowerCase();
    if (!normalizedTarget) return false;

    const normalizedTenant = this.normalizeTenantId(tenantId);
    const sockets = await server.fetchSockets();

    for (const s of sockets) {
      const socketUsername = this.getSocketUsername(s)?.toLowerCase();
      const socketTenantIdRaw = this.getSocketTenantId(s);
      const socketTenantId = socketTenantIdRaw
        ? String(socketTenantIdRaw).replace(/^tenant_/, '')
        : undefined;

      const sameTenant =
        !normalizedTenant || socketTenantId === normalizedTenant;
      if (
        socketUsername === normalizedTarget &&
        sameTenant &&
        this.matchesAgentNickname(s, agentNickname)
      ) {
        return true;
      }
    }

    return false;
  }

  private async emitToUser(
    tenantId: string | undefined,
    username: string,
    event: string,
    payload: any,
    agentNickname?: string | null,
  ) {
    const server = this.getServer();
    if (!server) {
      this.logger.warn('WebSocket server not ready to emit dm event');
      return;
    }

    const normalizedTarget = username?.toLowerCase();
    if (!normalizedTarget) return;

    const normalizedTenant = this.normalizeTenantId(tenantId);

    const sockets = await server.fetchSockets();
    for (const s of sockets) {
      const socketUsername = this.getSocketUsername(s)?.toLowerCase();
      const socketTenantIdRaw = this.getSocketTenantId(s);
      const socketTenantId = socketTenantIdRaw
        ? String(socketTenantIdRaw).replace(/^tenant_/, '')
        : undefined;

      const sameTenant =
        !normalizedTenant || socketTenantId === normalizedTenant;
      if (
        socketUsername === normalizedTarget &&
        sameTenant &&
        this.matchesAgentNickname(s, agentNickname)
      ) {
        s.emit(event, payload);
      }
    }
  }

  async emitNewMessage(
    tenantId: string | undefined,
    targetUsername: string,
    payload: any,
    targetAgentNickname?: string | null,
  ) {
    await this.emitToUser(
      tenantId,
      targetUsername,
      'dm:newMessage',
      payload,
      targetAgentNickname,
    );
  }

  async emitRead(
    tenantId: string | undefined,
    targetUsername: string,
    payload: any,
  ) {
    await this.emitToUser(tenantId, targetUsername, 'dm:read', payload);
  }

  async emitBuzz(
    tenantId: string | undefined,
    targetUsername: string,
    payload: any,
    targetAgentNickname?: string | null,
  ) {
    await this.emitToUser(
      tenantId,
      targetUsername,
      'dm:buzz',
      payload,
      targetAgentNickname,
    );
  }
}
