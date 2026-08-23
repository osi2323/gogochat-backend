import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UserBan } from './entities/user-ban.entity';

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
export class ModerationGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ModerationGateway.name);

  async emitUserBanned(
    ban: UserBan & {
      username?: string;
      bannedByUsername?: string;
      isGuest?: boolean;
      actorStarCount?: number;
    },
  ) {
    if (!this.server) {
      this.logger.warn('WebSocket server not ready to emit ban event');
      return;
    }

    const payload = {
      userId: ban.userId,
      username: ban.username ?? null,
      bannedById: ban.bannedById ?? null,
      bannedByUsername: ban.bannedByUsername ?? null,
      reason: ban.reason ?? null,
      expiresAt: ban.expiresAt ?? null,
      createdAt: ban.createdAt,
      isGuest: ban.isGuest ?? false,
    };

    const actorStarCount = ban.actorStarCount || 0;
    const connectedSockets = await this.server.fetchSockets();

    for (const s of connectedSockets) {
      const userStarCount = (s as any).roleStarCount || 0;
      const socketUsername = (s as any).username?.toLowerCase();
      const isTarget = socketUsername === payload.username?.toLowerCase();

      // Only show to users with >= actor's stars, or ROOT, or the target user themselves
      if (
        userStarCount >= actorStarCount ||
        socketUsername === 'root' ||
        isTarget
      ) {
        s.emit('moderation:userBanned', payload);
      }
    }

    this.logger.log(
      `moderation:userBanned emitted (filtered) for user ${payload.userId} by ${payload.bannedById}`,
    );
  }

  async emitUserKicked(payload: {
    username: string;
    kickedByUsername: string;
    reason?: string;
    actorStarCount?: number;
  }) {
    if (!this.server) {
      this.logger.warn('WebSocket server not ready to emit kick event');
      return;
    }

    const actorStarCount = payload.actorStarCount || 0;
    const connectedSockets = await this.server.fetchSockets();

    for (const s of connectedSockets) {
      const userStarCount = (s as any).roleStarCount || 0;
      const socketUsername = (s as any).username?.toLowerCase();
      const isTarget = socketUsername === payload.username?.toLowerCase();

      // Only show to users with >= actor's stars, or ROOT, or the target user themselves
      if (
        userStarCount >= actorStarCount ||
        socketUsername === 'root' ||
        isTarget
      ) {
        s.emit('moderation:kick', payload);
      }
    }

    this.logger.log(
      `moderation:kick emitted (filtered) for user ${payload.username} by ${payload.kickedByUsername}`,
    );
  }

  async emitMicBanToggled(payload: {
    userId?: number | null;
    username: string;
    micBanned: boolean;
    bannedByUsername: string;
    actorStarCount?: number;
  }) {
    if (!this.server) {
      this.logger.warn(
        'WebSocket server not ready to emit mic ban toggle event',
      );
      return;
    }

    // Broadcast to all users to keep icons in sync
    this.server.emit('moderation:micBanToggled', payload);

    this.logger.log(
      `moderation:micBanToggled emitted (filtered) for user ${payload.username} (status: ${payload.micBanned}) by ${payload.bannedByUsername}`,
    );
  }

  async emitCameraBanToggled(payload: {
    userId?: number | null;
    username: string;
    cameraBanned: boolean;
    bannedByUsername: string;
    actorStarCount?: number;
  }) {
    if (!this.server) {
      this.logger.warn(
        'WebSocket server not ready to emit camera ban toggle event',
      );
      return;
    }

    this.server.emit('moderation:cameraBanToggled', payload);

    this.logger.log(
      `moderation:cameraBanToggled emitted (filtered) for user ${payload.username} (status: ${payload.cameraBanned}) by ${payload.bannedByUsername}`,
    );
  }

  emitMuteStateChanged(payload: {
    username: string;
    scope: 'room' | 'global';
    room?: string;
    roomName?: string;
    roomMuted?: boolean;
    globalMuted?: boolean;
    mutedByUsername: string;
  }) {
    if (!this.server) {
      this.logger.warn(
        'WebSocket server not ready to emit mute state changed event',
      );
      return;
    }

    this.server.emit('moderation:muteStateChanged', payload);
  }

  emitMuteActionDenied(payload: {
    username: string;
    scope: 'room' | 'global';
    reason: 'room_muted' | 'global_muted';
    room?: string;
    roomName?: string;
  }) {
    if (!this.server) {
      this.logger.warn(
        'WebSocket server not ready to emit mute action denied event',
      );
      return;
    }

    this.server.emit('moderation:muteActionDenied', payload);
  }
}
