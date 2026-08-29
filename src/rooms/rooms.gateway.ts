import { Inject, Logger, Optional, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Brackets, DataSource, IsNull, Repository } from 'typeorm';
import { MessageResponseDto } from '../messages/dto/message-response.dto';
import {
  FriendRequest,
  FriendRequestStatus,
} from '../friends/entities/friend-request.entity';
import { Room } from './entities/room.entity';
import { User } from '../user/entities/user.entity';
import { Bot } from '../bot/entities/bot.entity';
import { Role } from '../role/entities/role.entity';
import { Message } from '../messages/entities/message.entity';
import { RoomMessageVisibilitySession } from '../messages/entities/room-message-visibility-session.entity';
import { MessageType } from '../messages/enums/message-type.enum';
import { SystemSettingsService } from '../settings/system-settings.service';
import { SecuritySettingsService } from '../settings/security-settings.service';
import {
  VoiceOfferPayload,
  VoiceAnswerPayload,
  VoiceIceCandidatePayload,
  VoiceSeatPayload,
  VoiceToggleMutePayload,
  VoiceUserStatePayload,
} from './dto/voice-chat.dto';
import { RoomsStateService } from './rooms-state.service';
import { isProtectedActionBlocked } from '../common/utils/protection-access.util';
import { buildIdentity } from '../common/agent-identity.util';
import {
  hasPermissionForUser,
  isMeetingRoomName,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

type CallRequestPayload = {
  targetUsername: string;
  targetAgentNickname?: string | null;
  callerUsername: string;
  callerAgentNickname?: string | null;
  callerIsGuest?: boolean;
  tenantId?: string;
  callId: string;
  callType?: 'voice' | 'video';
};

type CallAcceptPayload = {
  callId: string;
};

type CallRejectPayload = {
  callId: string;
  reason: 'rejected' | 'busy' | 'not_allowed';
  code?:
    | 'target_rejects_incoming_calls'
    | 'system_voice_call_disabled'
    | 'member_voice_call_disabled'
    | 'guest_voice_call_disabled'
    | 'blocked_user';
};

type CallCancelPayload = {
  callId: string;
};

type CallEndPayload = {
  callId: string;
  durationSec?: number;
};

type ActiveCallRecord = {
  callId: string;
  callType: 'voice' | 'video';
  tenantId: string;
  callerUsername: string;
  callerAgentNickname?: string | null;
  targetUsername: string;
  targetAgentNickname?: string | null;
  callerSocketId: string;
  targetSocketId: string;
  status: 'ringing' | 'active' | 'ended';
  createdAt: number;
  acceptedAt?: number;
  timeoutId?: NodeJS.Timeout;
};

type PendingRoomInviteRecord = {
  inviteId: string;
  inviterSocketId: string;
  inviterUsername: string;
  inviterTenantId: string;
  targetSocketId: string;
  targetUsername: string;
  roomName: string;
  createdAt: number;
};

type PendingMicInviteRecord = {
  inviteId: string;
  inviterSocketId: string;
  inviterUsername: string;
  inviterTenantId: string;
  targetSocketId: string;
  targetUsername: string;
  room: string;
  roomName?: string;
  createdAt: number;
};

type TemporaryOperatorRecord = {
  username: string;
  tenantId: string;
  socketId: string;
  createdAt: number;
};

type RoleVisualOverride = {
  roleName?: string;
  roleStarColor?: string;
  roleStarCount?: number;
  roleIcon?: string;
};

type RoomMember = {
  socketId: string;
  userId?: number;
  roomId?: number;
  username: string;
  loginHistoryId?: number;
  gender: 'male' | 'female';
  isGuest: boolean;
  guestAlias?: string;
  guestAliasReleased?: boolean;
  guestFirstMessageDelayStartedAt?: number;
  tenantId?: string;
  isInVoiceChat?: boolean;
  isMuted?: boolean;
  isInVoiceSeat?: boolean;
  voiceSeatJoinedAt?: number;
  voiceSeatIndex?: number;
  isHandRaised?: boolean;
  isCameraOn?: boolean;
  handRaisedAt?: number;
  statusModeId?: number;
  statusModeName?: string;
  roleName?: string;
  roleStarColor?: string;
  roleStarCount?: number;
  roleIcon?: string;
  frame?: string;
  icon?: string;
  fontName?: string;
  granite?: string;
  nickColor?: string;
  userGif?: string;
  flashNick?: string | null;
  joinEffect?: string;
  agentNickname?: string;
  deviceType?: string;
  device?: string;
  clientType?: string;
  isBot?: boolean;
  isAI?: boolean;
  micBanned?: boolean;
  micBannedByStarCount?: number;
  cameraBanned?: boolean;
  cameraBannedByStarCount?: number;
  roomMuted?: boolean;
  roomMutedByStarCount?: number;
  globalMuted?: boolean;
  globalMutedByStarCount?: number;
  rejectIncomingCalls?: boolean;
  rejectRoomInvites?: boolean;
  ipAddress?: string;
};

type SocketPresenceState = Omit<RoomMember, 'socketId'> & {
  socketId?: string;
  normalizedUsername?: string;
};

type RoomsStore = Map<string, Map<string, RoomMember>>;

type JoinRoomPayload = {
  room: string;
  roomId?: number | string;
  roomName?: string;
  username: string;
  loginHistoryId?: number;
  guest?: boolean;
  tenantId?: string;
  gender?: string;
  roleName?: string;
  agentNickname?: string;
  role?: {
    name?: string;
    starColor?: string;
    starCount?: number;
    icon?: string;
  };
  roleStarColor?: string;
  roleStarCount?: number;
  roleIcon?: string;
  statusModeId?: number | string;
  statusModeName?: string;
  frame?: string;
  icon?: string;
  fontName?: string;
  granite?: string;
  nickColor?: string;
  userGif?: string;
  flashNick?: string;
  joinEffect?: string;
  deviceType?: string;
  device?: string;
  clientType?: string;
  micBanned?: boolean;
  cameraBanned?: boolean;
  globalMuted?: boolean;
  rejectIncomingCalls?: boolean;
  rejectRoomInvites?: boolean;
  isTeleport?: boolean;
};

type LeaveRoomPayload = {
  room?: string;
  roomId?: string;
  username?: string;
};

type SendMessagePayload = {
  room: string;
  username: string;
  message: string;
  messageId?: number;
  type?: 'normal' | 'reply';
  fontColor?: string;
  targetGroup?: string;
  replyTo?: {
    sender: string;
    content: string;
    messageId?: number;
  };
};

type SendImagePayload = {
  room: string;
  username: string;
  image: string;
  message?: string;
  gender?: string;
  isGuest?: boolean;
  fontColor?: string;
  targetGroup?: string;
  messageId?: number;
};

type SendAudioPayload = {
  room: string;
  username: string;
  audio: string;
  audioFileName?: string;
  message?: string;
  gender?: string;
  isGuest?: boolean;
  fontColor?: string;
  targetGroup?: string;
  messageId?: number;
};

type SendYouTubePayload = {
  room: string;
  username: string;
  videoUrl: string;
  videoTitle: string;
  videoThumbnail: string;
  videoId: string;
  message?: string;
  gender?: string;
  isGuest?: boolean;
  fontColor?: string;
  targetGroup?: string;
  messageId?: number;
};

type UpdateStatusModePayload = {
  room: string;
  username: string;
  statusModeId?: number | string;
  statusModeName?: string;
  joinEffect?: string | null;
};

type UpdateChatPreferencesPayload = {
  username: string;
  rejectIncomingCalls?: boolean;
  rejectRoomInvites?: boolean;
};

type RoomJoinAccessResult =
  | {
      allowed: true;
      roomEntity: Room | null;
      effectiveStarCount: number;
      canUseRoofMode: boolean;
      roleName?: string;
      persistedUser?: User | null;
      persistedModerationState?: {
        globalMuted: boolean;
        globalMutedByStarCount: number;
        micBanned: boolean;
        micBannedByStarCount: number;
        cameraBanned: boolean;
        cameraBannedByStarCount: number;
      };
    }
  | {
      allowed: false;
      code: 'minimum_star_required' | 'meeting_permission_required';
      message: string;
      requiredMinStar: number;
      effectiveStarCount: number;
      roomEntity: Room | null;
    };

type RoomInvitePayload = {
  targetUsername: string;
  roomName: string;
};

type RoomInviteRespondPayload = {
  inviteId: string;
  accepted: boolean;
};

type ModerationUserInfoRequestPayload = {
  targetUsername: string;
};

type ModerationWarnUserPayload = {
  targetUsername: string;
  message: string;
};

type ModerationMicInvitePayload = {
  targetUsername: string;
  room: string;
  roomName?: string;
};

type ModerationMicInviteRespondPayload = {
  inviteId: string;
  accepted: boolean;
};

type ModerationTempOperatorGrantPayload = {
  targetUsername: string;
};

type ModerationTempOperatorRevokePayload = {
  targetUsername: string;
};

type UpdateFramePayload = {
  room: string;
  username: string;
  frame?: string;
};

type UpdateIconPayload = {
  room: string;
  username: string;
  icon?: string;
};

type UpdateFlashNickPayload = {
  room?: string;
  username: string;
  flashNick?: string | null;
};

type UpdateJoinEffectPayload = {
  room?: string;
  username: string;
  joinEffect?: string | null;
};

type TriggerJoinEffectPayload = {
  room?: string;
  username: string;
  joinEffect?: string | null;
};

type UpdateHandPayload = {
  room: string;
  username: string;
  isRaised: boolean;
};

type UpdateCameraPayload = {
  room: string;
  username: string;
  isCameraOn: boolean;
};

type BotStateUpdatePayload = {
  username: string;
  isInVoiceChat?: boolean;
  isMuted?: boolean;
  isHandRaised?: boolean;
  handRaisedAt?: number | null;
  isCameraOn?: boolean;
};

type StyleUpdatePayload = {
  room: string;
  username: string;
  fontName?: string;
  granite?: string;
  nickColor?: string;
  userGif?: string;
  flashNick?: string | null;
};

type ModerationToggleRoomMutePayload = {
  room: string;
  targetUsername: string;
};

type ModerationDropFromMicPayload = {
  room: string;
  targetUsername: string;
};

type ModerationToggleGlobalMutePayload = {
  targetUsername: string;
};

type ModerationGuestAliasReleasePayload = {
  room: string;
  targetUsername: string;
};

type RoomUser = {
  id: string;
  userId?: number;
  username: string;
  loginHistoryId?: number;
  displayUsername?: string;
  gender: 'male' | 'female';
  isGuest: boolean;
  guestAlias?: string;
  guestAliasReleased?: boolean;
  tenantId?: string;
  rooms?: Array<{ roomKey: string; roomName: string }>;
  isInVoiceChat?: boolean;
  isMuted?: boolean;
  isInVoiceSeat?: boolean;
  voiceSeatJoinedAt?: number;
  voiceSeatIndex?: number;
  isHandRaised?: boolean;
  handRaisedAt?: number | null;
  isCameraOn?: boolean;
  isBot?: boolean;
  isAI?: boolean;
  deviceType?: string;
  device?: string;
  clientType?: string;
  statusModeId?: number;
  statusModeName?: string;
  roleName?: string;
  roleStarColor?: string;
  roleStarCount?: number;
  roleIcon?: string;
  frame?: string;
  icon?: string;
  fontName?: string;
  granite?: string;
  nickColor?: string;
  userGif?: string;
  flashNick?: string | null;
  joinEffect?: string;
  agentNickname?: string;
  micBanned?: boolean;
  micBannedByStarCount?: number;
  cameraBanned?: boolean;
  cameraBannedByStarCount?: number;
  roomMuted?: boolean;
  roomMutedByStarCount?: number;
  globalMuted?: boolean;
  globalMutedByStarCount?: number;
  rejectIncomingCalls?: boolean;
};

type ActiveSystemResetState = {
  countdownSeconds: number;
  message: string;
  startedAtMs: number;
  endsAtMs: number;
  joinBlockedUntilMs: number;
};

const socketPayloadLimitBytes = 100 * 1024 * 1024;

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
  transports: ['websocket', 'polling'], // Windows compatibility
  maxHttpBufferSize: socketPayloadLimitBytes, // büyük görsel/ses/animasyon payload'ları için limit artırıldı
  pingTimeout: 60000, 
  pingInterval: 25000,
})
export class RoomsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomsGateway.name);
  private static sharedServer: Server | null = null;
  private static readonly fallbackRooms: RoomsStore = new Map();
  private static readonly fallbackRoomNames = new Map<string, string>();
  private static readonly fallbackSocketRooms = new Map<string, Set<string>>();
  private static readonly fallbackActiveCalls = new Map<
    string,
    ActiveCallRecord
  >();
  private static readonly fallbackUserActiveCalls = new Map<string, string>();
  private static readonly fallbackRoomInvites = new Map<
    string,
    PendingRoomInviteRecord
  >();
  private static readonly fallbackMicInvites = new Map<
    string,
    PendingMicInviteRecord
  >();
  private static readonly fallbackTemporaryOperators = new Map<
    string,
    TemporaryOperatorRecord
  >();
  private static readonly fallbackRoleVisualOverrides = new Map<
    string,
    RoleVisualOverride
  >();
  private static readonly fallbackPersistentBots = new Map<
    string,
    RoomMember & { roomKey: string }
  >();
  private static readonly recentRoomLeaves = new Map<
    string,
    { roomKey: string; leftAt: number; socketId: string; loginHistoryId?: number }
  >();
  private static activeSystemResetState: ActiveSystemResetState | null = null;
  private static systemResetDisconnectTimer: NodeJS.Timeout | null = null;
  private static readonly AI_WELCOME_SESSION_TTL_MS = 5_000;
  private static readonly LOBBY_ROOM_ALIASES = new Set(['lobby', 'lobi']);
  private static readonly RECENT_ROOM_LEAVE_TTL_MS = 30_000;
  private readonly aiWelcomeSessionKeys = new Map<string, number>();
  private pendingServerEmits: Array<{
    eventName: string;
    payload: unknown;
    contextLabel: string;
  }> = [];
  private roleHydrationRepositoryWarned = false;
  private visibilitySessionTableReady?: Promise<void>;
  private readonly sorubazGames = new Map<string, { answer: string; question: string; points: number; expiresAt: number }>();
  private readonly sorubazTimers = new Map<string, NodeJS.Timeout>();
  private readonly wordHuntGames = new Map<string, { answer: string; scrambled: string; points: number; expiresAt: number }>();
  private readonly duelGames = new Map<string, { challenger: RoomMember; expiresAt: number }>();
  private readonly wordHuntWords = ['istanbul','merhaba','bilgisayar','arkadaş','sohbet','yıldız','oyuncu','vietnam','ankara','telefon','müzik','kahve'];
  private readonly sorubazQuestions = [
    { q: 'Türkiye’nin başkenti neresidir?', a: 'ankara', p: 10 },
    { q: 'Dünyanın en büyük okyanusu hangisidir?', a: 'pasifik', p: 10 },
    { q: '5 × 8 kaçtır?', a: '40', p: 8 },
    { q: 'Ay’a ilk ayak basan insanın soyadı nedir?', a: 'armstrong', p: 15 },
    { q: 'İstanbul hangi iki kıta üzerinde yer alır?', a: 'avrupa asya', p: 15 },
    { q: 'Suyun kimyasal formülü nedir?', a: 'h2o', p: 10 },
    { q: 'Bir yılda kaç ay vardır?', a: '12', p: 5 },
    { q: 'Vietnam’ın başkenti neresidir?', a: 'hanoi', p: 10 },
  ];

  @InjectRepository(User)
  private readonly injectedUserRepository?: Repository<User>;

  @InjectRepository(Bot)
  private readonly injectedBotRepository?: Repository<Bot>;

  @InjectRepository(Role)
  private readonly injectedRoleRepository?: Repository<Role>;

  constructor(
    @Inject(forwardRef(() => SystemSettingsService))
    private readonly systemSettingsService: SystemSettingsService,
    private readonly roomsState: RoomsStateService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(FriendRequest)
    private readonly friendRequestRepository: Repository<FriendRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @Optional()
    @Inject(forwardRef(() => SecuritySettingsService))
    private readonly securitySettingsService?: SecuritySettingsService,
    @Optional()
    @InjectRepository(RoomMessageVisibilitySession)
    private readonly visibilitySessionRepository?: Repository<RoomMessageVisibilitySession>,
  ) {
    const proto = Object.getPrototypeOf(this);
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;
      const value = (this as any)[key];
      if (typeof value === 'function') {
        (this as any)[key] = value.bind(this);
      }
    }
  }

  private getRoomsStore(): RoomsStore {
    return this.roomsState?.rooms ?? RoomsGateway.fallbackRooms;
  }

  private readonly visibilitySessionTableName = `"${(
    process.env.POSTGRES_SCHEMA || 'public'
  ).replace(/"/g, '""')}"."room_message_visibility_sessions"`;

  private async getLatestRoomMessageId(roomId: number): Promise<number> {
    if (!Number.isFinite(roomId) || !this.messageRepository?.findOne) {
      return 0;
    }

    const lastMessage = await this.messageRepository.findOne({
      where: { roomId },
      order: { id: 'DESC' },
      select: ['id'],
    });

    return lastMessage?.id ?? 0;
  }

  private async ensureVisibilitySessionTable(): Promise<void> {
    if (!this.visibilitySessionRepository?.query) return;
    if (!this.visibilitySessionTableReady) {
      this.visibilitySessionTableReady = (async () => {
        await this.visibilitySessionRepository!.query(`
          CREATE TABLE IF NOT EXISTS ${this.visibilitySessionTableName} (
            "id" SERIAL NOT NULL,
            "userId" integer NOT NULL,
            "identityKey" character varying(255) NOT NULL DEFAULT '',
            "roomId" integer NOT NULL,
            "joinedAt" TIMESTAMP NOT NULL,
            "leftAt" TIMESTAMP,
            "joinedAfterMessageId" integer NOT NULL DEFAULT 0,
            "leftMessageId" integer,
            "socketId" character varying(255),
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_room_message_visibility_sessions" PRIMARY KEY ("id")
          )
        `);
        await this.visibilitySessionRepository!.query(`
          CREATE INDEX IF NOT EXISTS "IDX_room_visibility_identity_room"
          ON ${this.visibilitySessionTableName} ("userId", "identityKey", "roomId")
        `);
        await this.visibilitySessionRepository!.query(`
          CREATE INDEX IF NOT EXISTS "IDX_room_visibility_socket"
          ON ${this.visibilitySessionTableName} ("socketId")
        `);
      })();
    }

    await this.visibilitySessionTableReady;
  }

  private async closeVisibilitySessions(
    params:
      | {
          userId: number;
          identityKey: string;
          roomId: number;
          socketId?: string | null;
          closeInactiveSocketsAtJoinBoundary?: boolean;
        }
      | { socketId: string },
  ): Promise<void> {
    if (!this.visibilitySessionRepository?.find) {
      return;
    }
    await this.ensureVisibilitySessionTable();

    const where: any =
      'userId' in params
        ? {
            userId: params.userId,
            identityKey: params.identityKey,
            roomId: params.roomId,
            leftAt: IsNull(),
          }
        : { socketId: params.socketId, leftAt: IsNull() };
    const sessions = await this.visibilitySessionRepository.find({ where });
    if (sessions.length === 0) return;

    const now = new Date();
    for (const session of sessions) {
      const shouldCloseAtJoinBoundary =
        'userId' in params &&
        params.closeInactiveSocketsAtJoinBoundary === true &&
        typeof session.socketId === 'string' &&
        session.socketId.trim().length > 0 &&
        !this.server?.sockets?.sockets?.has(session.socketId);

      session.leftAt = now;
      session.leftMessageId = shouldCloseAtJoinBoundary
        ? session.joinedAfterMessageId
        : await this.getLatestRoomMessageId(session.roomId);
    }

    await this.visibilitySessionRepository.save(sessions);
  }

  private async startVisibilitySession(params: {
    userId?: number | null;
    agentNickname?: string | null;
    roomId?: number | null;
    socketId: string;
  }): Promise<void> {
    const { userId, roomId, socketId, agentNickname } = params;
    if (
      !userId ||
      !roomId ||
      !Number.isFinite(userId) ||
      !Number.isFinite(roomId) ||
      !this.visibilitySessionRepository?.create
    ) {
      return;
    }
    await this.ensureVisibilitySessionTable();

    const identityKey = buildIdentity(userId, agentNickname).identityKey;
    await this.closeVisibilitySessions({
      userId,
      identityKey,
      roomId,
      socketId,
      closeInactiveSocketsAtJoinBoundary: true,
    });

    const joinedAfterMessageId = await this.getLatestRoomMessageId(roomId);
    await this.visibilitySessionRepository.save(
      this.visibilitySessionRepository.create({
        userId,
        identityKey,
        roomId,
        socketId,
        joinedAt: new Date(),
        leftAt: null,
        joinedAfterMessageId,
        leftMessageId: null,
      }),
    );
  }

  private logWarn(message: string) {
    if (this.logger?.warn) {
      this.logger.warn(message);
      return;
    }
    console.warn(`[${RoomsGateway.name}] ${message}`);
  }

  private logError(message: string) {
    if (this.logger?.error) {
      this.logger.error(message);
      return;
    }
    console.error(`[${RoomsGateway.name}] ${message}`);
  }

  private getUserRepository(): Repository<User> | null {
    if (this.injectedUserRepository?.createQueryBuilder) {
      return this.injectedUserRepository;
    }

    const injectedUserRepository = this.userRepository as
      | Repository<User>
      | undefined
      | null;
    if (injectedUserRepository?.createQueryBuilder) {
      return this.userRepository;
    }

    const repositoryCandidates = [
      this.dataSource,
      this.roomRepository,
      this.friendRequestRepository,
      this.userRepository,
    ] as Array<
      | DataSource
      | Repository<Room>
      | Repository<FriendRequest>
      | Repository<User>
      | undefined
      | null
    >;

    for (const candidate of repositoryCandidates) {
      const directRepository = (candidate as any)?.getRepository?.(User);
      if (directRepository?.createQueryBuilder) {
        return directRepository;
      }

      const managerRepository = candidate?.manager?.getRepository?.(User);
      if (managerRepository?.createQueryBuilder) {
        return managerRepository;
      }
    }

    try {
      return this.dataSource?.getRepository(User) ?? null;
    } catch (error) {
      this.logWarn(
        `User repository fallback resolution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private getBotRepository(): Repository<Bot> | null {
    if (this.injectedBotRepository?.find) {
      return this.injectedBotRepository;
    }

    const injectedBotRepository = this.botRepository as
      | Repository<Bot>
      | undefined
      | null;
    if (injectedBotRepository?.find) {
      return injectedBotRepository;
    }

    const repositoryCandidates = [
      this.dataSource,
      this.roomRepository,
      this.friendRequestRepository,
      this.userRepository,
      this.botRepository,
    ] as Array<
      | DataSource
      | Repository<Room>
      | Repository<FriendRequest>
      | Repository<User>
      | Repository<Bot>
      | undefined
      | null
    >;

    for (const candidate of repositoryCandidates) {
      const directRepository = (candidate as any)?.getRepository?.(Bot);
      if (directRepository?.find) {
        return directRepository;
      }

      const managerRepository = candidate?.manager?.getRepository?.(Bot);
      if (managerRepository?.find) {
        return managerRepository;
      }
    }

    try {
      return this.dataSource?.getRepository(Bot) ?? null;
    } catch (error) {
      this.logWarn(
        `Bot repository fallback resolution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private getRoleRepository(): Repository<Role> | null {
    if (this.injectedRoleRepository?.createQueryBuilder) {
      return this.injectedRoleRepository;
    }

    const repositoryCandidates = [
      this.dataSource,
      this.roomRepository,
      this.friendRequestRepository,
      this.userRepository,
      this.botRepository,
      this.injectedUserRepository,
      this.injectedBotRepository,
      this.injectedRoleRepository,
    ] as Array<
      | DataSource
      | Repository<Room>
      | Repository<FriendRequest>
      | Repository<User>
      | Repository<Bot>
      | Repository<Role>
      | undefined
      | null
    >;

    for (const candidate of repositoryCandidates) {
      const directRepository = (candidate as any)?.getRepository?.(Role);
      if (directRepository?.createQueryBuilder) {
        return directRepository;
      }

      const managerRepository = candidate?.manager?.getRepository?.(Role);
      if (managerRepository?.createQueryBuilder) {
        return managerRepository;
      }
    }

    try {
      return this.dataSource?.getRepository(Role) ?? null;
    } catch (error) {
      this.logWarn(
        `Role repository fallback resolution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async resolveRoleVisualByName(roleName?: string | null): Promise<RoleVisualOverride> {
    const normalizedRole = this.normalize(roleName ?? undefined);
    if (!normalizedRole) return {};

    const roleRepository = this.getRoleRepository();
    if (!roleRepository?.createQueryBuilder) {
      return { roleName: roleName?.trim() || undefined };
    }

    let role: Role | null = null;
    try {
      role = await roleRepository
        .createQueryBuilder('role')
        .where('LOWER(role.name) = :roleName', { roleName: normalizedRole })
        .getOne();
    } catch (error) {
      this.logWarn(
        `Role visual lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { roleName: roleName?.trim() || undefined };
    }

    if (!role) {
      return { roleName: roleName?.trim() || undefined };
    }

    return {
      roleName: role.name,
      roleStarColor: role.starColor || undefined,
      roleStarCount: role.starCount ?? undefined,
      roleIcon: role.icon || undefined,
    };
  }

  private getRoomNamesStore(): Map<string, string> {
    return this.roomsState?.roomNames ?? RoomsGateway.fallbackRoomNames;
  }

  private getPersistentBotsStore(): Map<string, RoomMember & { roomKey: string }> {
    return RoomsGateway.fallbackPersistentBots;
  }

  public registerBotMember(
    roomKey: string,
    member: RoomMember,
    options: { broadcast?: boolean } = {},
  ) {
    const normalizedRoom = this.resolveRoomKey(roomKey);
    const normalizedUsername = this.normalize(member.username);
    if (!normalizedRoom || !normalizedUsername) return;

    const botMember = {
      ...member,
      isBot: true,
      socketId: member.socketId || `bot_${member.username}`,
      roomKey: normalizedRoom,
    };

    this.getPersistentBotsStore().set(normalizedUsername, botMember);
    this.getRoomsStore().forEach((roomMembers) => {
      roomMembers.delete(normalizedUsername);
    });

    if (options.broadcast !== false) {
      void this.emitTenantActiveUserSnapshot(member.tenantId || 'tenant_master');
    }
  }

  public unregisterBotMember(
    roomKey: string,
    username: string,
    options: { broadcast?: boolean } = {},
  ) {
    const normalizedRoom = this.resolveRoomKey(roomKey);
    const normalizedUsername = this.normalize(username);
    if (!normalizedRoom || !normalizedUsername) return;

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    this.getPersistentBotsStore().delete(normalizedUsername);
    if (roomMembers) {
      roomMembers.delete(normalizedUsername);
    }
    if (options.broadcast !== false) {
      void this.emitTenantActiveUserSnapshot('tenant_master');
    }
  }

  public notifyBotPresenceChanged(payload: {
    type: 'created' | 'updated' | 'deleted';
    username: string;
    previousUsername?: string | null;
    roomKey?: string | null;
    previousRoomKey?: string | null;
  }) {
    const server = this.getServer();
    if (!server?.emit) return;

    server.emit('bot:updated', payload);

    const affectedRoomKeys = new Set<string>();
    const currentRoomKey = payload.roomKey
      ? this.resolveRoomKey(payload.roomKey)
      : null;
    const previousRoomKey = payload.previousRoomKey
      ? this.resolveRoomKey(payload.previousRoomKey)
      : null;

    if (currentRoomKey) {
      affectedRoomKeys.add(currentRoomKey);
    }
    if (previousRoomKey) {
      affectedRoomKeys.add(previousRoomKey);
    }
    const previousUsername = payload.previousUsername?.trim();

    if (previousRoomKey && previousRoomKey !== currentRoomKey) {
      void this.emitRoomBotUserChanged(previousRoomKey, payload.username, 'remove');
    }
    if (
      previousUsername &&
      this.normalize(previousUsername) !== this.normalize(payload.username)
    ) {
      const removeRoomKey = previousRoomKey || currentRoomKey;
      if (removeRoomKey) {
        void this.emitRoomBotUserChanged(removeRoomKey, previousUsername, 'remove');
      }
      void this.emitTenantBotUserChanged(previousUsername, 'remove');
    }

    if (currentRoomKey && payload.type !== 'deleted') {
      void this.emitRoomBotUserChanged(currentRoomKey, payload.username, 'upsert');
      void this.emitRoomBotUsers(currentRoomKey);
    }
    if (
      previousRoomKey &&
      previousRoomKey !== currentRoomKey &&
      payload.type !== 'created'
    ) {
      void this.emitRoomBotUsers(previousRoomKey);
    }

    void this.emitTenantBotUserChanged(
      payload.username,
      payload.type === 'deleted' || !currentRoomKey ? 'remove' : 'upsert',
    );
    void this.emitTenantActiveUserSnapshot('tenant_master');
  }

  @SubscribeMessage('bot:stateUpdate')
  async handleBotStateUpdate(@MessageBody() payload: BotStateUpdatePayload) {
    const normalizedUsername = this.normalize(payload?.username);
    if (!normalizedUsername) {
      return { status: 'error', message: 'username is required' };
    }

    let bot = this.getPersistentBotsStore().get(normalizedUsername);
    if (!bot) {
      const botRepository = this.getBotRepository();
      const botEntity = botRepository
        ? await botRepository
            .createQueryBuilder('bot')
            .where('LOWER(bot.username) = :username', {
              username: normalizedUsername,
            })
            .getOne()
        : null;
      const roomKey = botEntity
        ? await this.resolvePersistentBotRoomKey(botEntity.room)
        : null;

      if (botEntity && roomKey) {
        const roleVisual = await this.resolveRoleVisualByName(botEntity.role);
        this.registerBotMember(
          roomKey,
          {
            socketId: `bot_${botEntity.id}`,
            username: botEntity.username,
            gender: botEntity.gender,
            isGuest: false,
            icon: botEntity.avatar ?? undefined,
            roleName: roleVisual.roleName ?? botEntity.role ?? undefined,
            roleStarColor: roleVisual.roleStarColor,
            roleStarCount: roleVisual.roleStarCount,
            roleIcon: roleVisual.roleIcon,
            statusModeName: botEntity.statusMode ?? undefined,
            deviceType: botEntity.loginType ?? undefined,
            device: botEntity.loginType ?? undefined,
            clientType: botEntity.loginType ?? undefined,
            fontName: botEntity.fontName ?? undefined,
            granite: botEntity.granite ?? undefined,
            userGif: botEntity.userGif ?? undefined,
            isBot: true,
            isAI: botEntity.isAI === true,
          },
          { broadcast: false },
        );
        bot = this.getPersistentBotsStore().get(normalizedUsername);
      }
    }

    if (!bot) {
      return { status: 'error', message: 'bot_not_found' };
    }

    if (payload.isInVoiceChat !== undefined) {
      bot.isInVoiceChat = payload.isInVoiceChat;
    }
    if (payload.isMuted !== undefined) {
      bot.isMuted = payload.isMuted;
    }
    if (payload.isHandRaised !== undefined) {
      bot.isHandRaised = payload.isHandRaised;
    }
    if (payload.handRaisedAt !== undefined) {
      bot.handRaisedAt = payload.handRaisedAt ?? undefined;
    }
    if (payload.isCameraOn !== undefined) {
      bot.isCameraOn = payload.isCameraOn;
    }

    this.getPersistentBotsStore().set(normalizedUsername, bot);

    const statePayload = {
      tenantId: bot.tenantId || 'tenant_master',
      socketId: bot.socketId,
      username: bot.username,
      isInVoiceChat: bot.isInVoiceChat ?? false,
      isMuted: bot.isMuted ?? false,
      isHandRaised: bot.isHandRaised ?? false,
      isCameraOn: bot.isCameraOn ?? false,
      handRaisedAt: bot.handRaisedAt ?? null,
    };

    this.getServer()?.emit('tenant:userStateUpdate', statePayload);
    this.getServer()?.to(bot.roomKey).emit('room:botStateUpdate', {
      room: bot.roomKey,
      ...statePayload,
    });
    this.getServer()?.emit('bot:updated', {
      type: 'state',
      username: bot.username,
      roomKey: bot.roomKey,
    });
    void this.emitRoomBotUsers(bot.roomKey);
    void this.emitTenantBotUserChanged(bot.username, 'upsert');

    return { status: 'ok', ...statePayload };
  }

  private getSocketRoomsStore(): Map<string, Set<string>> {
    return this.roomsState?.socketRooms ?? RoomsGateway.fallbackSocketRooms;
  }

  private getSocketPresenceState(socket: Socket): SocketPresenceState {
    return ((socket.data?.roomPresenceState as SocketPresenceState) ?? {});
  }

  private updateSocketPresenceState(
    socket: Socket,
    patch: Partial<SocketPresenceState>,
  ): SocketPresenceState {
    const current = this.getSocketPresenceState(socket);
    const next: SocketPresenceState = {
      ...current,
      ...patch,
      socketId: socket.id,
    };

    if (!socket.data) {
      (socket as any).data = {};
    }
    socket.data.roomPresenceState = next;

    if (typeof next.username === 'string' && next.username.trim()) {
      (socket as any).username = next.username.trim();
      next.normalizedUsername =
        this.normalize(next.username) ?? next.normalizedUsername;
    }
    if (typeof next.tenantId === 'string' && next.tenantId.trim()) {
      (socket as any).tenantId = next.tenantId.trim();
    }
    if (next.roleStarCount !== undefined) {
      (socket as any).roleStarCount = next.roleStarCount ?? 0;
    }

    socket.data.roomPresenceState = next;
    return next;
  }

  private syncSocketPresenceFromMember(
    socketOrId: Socket | string | undefined,
    member: RoomMember,
  ): void {
    const socket =
      typeof socketOrId === 'string'
        ? this.getServer()?.sockets?.sockets?.get(socketOrId)
        : socketOrId;

    if (!socket) {
      return;
    }

    this.updateSocketPresenceState(socket, {
      socketId: member.socketId,
      userId: member.userId,
      username: member.username,
      normalizedUsername: this.normalize(member.username) ?? undefined,
      loginHistoryId: member.loginHistoryId,
      gender: member.gender,
      isGuest: member.isGuest,
      guestAlias: member.guestAlias,
      guestAliasReleased: member.guestAliasReleased,
      guestFirstMessageDelayStartedAt: member.guestFirstMessageDelayStartedAt,
      tenantId: member.tenantId,
      isInVoiceChat: member.isInVoiceChat,
      isMuted: member.isMuted,
      isInVoiceSeat: member.isInVoiceSeat,
      voiceSeatJoinedAt: member.voiceSeatJoinedAt,
      voiceSeatIndex: member.voiceSeatIndex,
      isHandRaised: member.isHandRaised,
      isCameraOn: member.isCameraOn,
      handRaisedAt: member.handRaisedAt,
      statusModeId: member.statusModeId,
      statusModeName: member.statusModeName,
      roleName: member.roleName,
      roleStarColor: member.roleStarColor,
      roleStarCount: member.roleStarCount,
      roleIcon: member.roleIcon,
      frame: member.frame,
      icon: member.icon,
      deviceType: member.deviceType,
      device: member.device,
      clientType: member.clientType,
      fontName: member.fontName,
      granite: member.granite,
      nickColor: member.nickColor,
      userGif: member.userGif,
      flashNick: member.flashNick,
      joinEffect: member.joinEffect,
      agentNickname: member.agentNickname,
      micBanned: member.micBanned,
      micBannedByStarCount: member.micBannedByStarCount,
      cameraBanned: member.cameraBanned,
      cameraBannedByStarCount: member.cameraBannedByStarCount,
      roomMuted: member.roomMuted,
      roomMutedByStarCount: member.roomMutedByStarCount,
      globalMuted: member.globalMuted,
      globalMutedByStarCount: member.globalMutedByStarCount,
      rejectIncomingCalls: member.rejectIncomingCalls,
      rejectRoomInvites: member.rejectRoomInvites,
      ipAddress: member.ipAddress,
    });
  }

  private resolveRoomMessageMember(
    room: string,
    username: string,
    client: Socket,
  ): { roomMembers: Map<string, RoomMember>; member: RoomMember } | null {
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);

    if (!normalizedRoom || !normalizedUsername) {
      return null;
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member) {
      return null;
    }

    if (member.socketId === client.id) {
      return { roomMembers, member };
    }

    const socketState = this.getSocketPresenceState(client);
    const socketUsername =
      this.normalize(socketState.username ?? (client as any).username) ??
      socketState.normalizedUsername;
    const socketRooms = this.getSocketRoomsStore().get(client.id);
    const socketJoinedRoom =
      socketRooms?.has(normalizedRoom) || client.rooms.has(normalizedRoom);

    if (socketUsername === normalizedUsername && socketJoinedRoom) {
      return { roomMembers, member };
    }

    return null;
  }

  private updateSocketPresenceForIdentity(
    params: {
      userId?: number;
      normalizedUsername?: string | null;
    },
    patch: Partial<SocketPresenceState>,
  ): Set<string> {
    const sockets = this.getServer()?.sockets?.sockets;
    const affectedTenantIds = new Set<string>();

    if (!sockets) {
      return affectedTenantIds;
    }

    for (const socket of sockets.values()) {
      const state = this.getSocketPresenceState(socket);
      const stateUsername =
        state.normalizedUsername ??
        this.normalize(state.username ?? (socket as any).username);

      const matchesByUserId =
        typeof params.userId === 'number' &&
        Number.isFinite(params.userId) &&
        state.userId === params.userId;
      const matchesByUsername =
        !!params.normalizedUsername &&
        !!stateUsername &&
        params.normalizedUsername === stateUsername;

      if (!matchesByUserId && !matchesByUsername) {
        continue;
      }

      const nextState = this.updateSocketPresenceState(socket, patch);
      const tenantId =
        nextState.tenantId ||
        ((socket as any).tenantId as string | undefined) ||
        'tenant_master';
      affectedTenantIds.add(tenantId);
    }

    return affectedTenantIds;
  }

  private buildRoomMemberFromSocketState(socket: Socket): RoomMember | null {
    const state = this.getSocketPresenceState(socket);
    const username =
      (typeof state.username === 'string' && state.username.trim()) ||
      ((socket as any).username as string | undefined)?.trim();
    if (!username) {
      return null;
    }

    const roleVisual = this.resolveRoleVisualForMember({
      userId: state.userId,
      username,
      roleName: state.roleName,
      roleStarColor: state.roleStarColor,
      roleStarCount: state.roleStarCount,
      roleIcon: state.roleIcon,
    });

    return {
      socketId: socket.id,
      userId: state.userId,
      username,
      loginHistoryId: state.loginHistoryId,
      gender: state.gender === 'female' ? 'female' : 'male',
      isGuest: state.isGuest === true,
      guestAlias: state.guestAlias,
      guestAliasReleased: state.guestAliasReleased === true,
      guestFirstMessageDelayStartedAt: state.guestFirstMessageDelayStartedAt,
      tenantId:
        state.tenantId ||
        ((socket as any).tenantId as string | undefined) ||
        'tenant_master',
      isInVoiceChat: state.isInVoiceChat ?? false,
      isMuted: state.isMuted ?? false,
      isInVoiceSeat: state.isInVoiceSeat ?? false,
      voiceSeatJoinedAt: state.voiceSeatJoinedAt,
      voiceSeatIndex: state.voiceSeatIndex,
      isHandRaised: state.isHandRaised ?? false,
      isCameraOn: state.isCameraOn ?? false,
      handRaisedAt: state.handRaisedAt,
      statusModeId: state.statusModeId,
      statusModeName: state.statusModeName,
      roleName: roleVisual.roleName,
      roleStarColor: roleVisual.roleStarColor,
      roleStarCount: roleVisual.roleStarCount,
      roleIcon: roleVisual.roleIcon,
      frame: state.frame,
      icon: state.icon,
      deviceType: state.deviceType,
      device: state.device,
      clientType: state.clientType,
      fontName: state.fontName,
      granite: state.granite,
      nickColor: state.nickColor,
      userGif: state.userGif,
      flashNick: state.flashNick,
      joinEffect: state.agentNickname ? undefined : state.joinEffect,
      agentNickname: state.agentNickname,
      micBanned: state.micBanned,
      micBannedByStarCount: state.micBannedByStarCount,
      cameraBanned: state.cameraBanned,
      cameraBannedByStarCount: state.cameraBannedByStarCount,
      roomMuted: state.roomMuted,
      roomMutedByStarCount: state.roomMutedByStarCount,
      globalMuted: state.globalMuted,
      globalMutedByStarCount: state.globalMutedByStarCount,
      rejectIncomingCalls: state.rejectIncomingCalls,
      rejectRoomInvites: state.rejectRoomInvites,
      ipAddress: state.ipAddress,
    };
  }

  private getActiveVoiceSeatCount(
    roomMembers: Map<string, RoomMember>,
    exceptUsername?: string,
  ): number {
    const normalizedExceptUsername = this.normalize(exceptUsername);

    return Array.from(roomMembers.values()).filter((member) => {
      const normalizedMemberUsername = this.normalize(member.username);
      return (
        member.isInVoiceSeat === true &&
        normalizedMemberUsername !== normalizedExceptUsername &&
        member.statusModeName !== 'Çatıda'
      );
    }).length;
  }

  private repairMissingRoomMembersFromSocketState(params?: {
    tenantId?: string;
    userId?: number;
    normalizedUsername?: string | null;
  }): {
    repairedRooms: Set<string>;
    affectedTenantIds: Set<string>;
  } {
    const server = this.getServer();
    const sockets = server?.sockets?.sockets;
    const repairedRooms = new Set<string>();
    const affectedTenantIds = new Set<string>();
    const expectedTenant =
      this.normalizeTenantScope(params?.tenantId) ??
      this.normalizeTenantScope(params?.tenantId?.replace(/^tenant_/, ''));

    for (const [socketId, roomKeys] of this.getSocketRoomsStore().entries()) {
      const socket = sockets?.get(socketId);
      if (!socket) {
        this.getSocketRoomsStore().delete(socketId);
        continue;
      }

      const state = this.getSocketPresenceState(socket);
      const normalizedUsername =
        state.normalizedUsername ??
        this.normalize(state.username ?? (socket as any).username);
      const tenantScope =
        this.normalizeTenantScope(
          state.tenantId || ((socket as any).tenantId as string | undefined),
        ) ?? 'master';

      const matchesUserId =
        typeof params?.userId === 'number' &&
        Number.isFinite(params.userId) &&
        state.userId === params.userId;
      const matchesUsername =
        !!params?.normalizedUsername &&
        !!normalizedUsername &&
        params.normalizedUsername === normalizedUsername;
      const passesIdentityFilter =
        params?.userId === undefined &&
        !params?.normalizedUsername
          ? true
          : matchesUserId || matchesUsername;

      if (!passesIdentityFilter) {
        continue;
      }

      if (expectedTenant && tenantScope !== expectedTenant) {
        continue;
      }

      if (!normalizedUsername) {
        continue;
      }

      const reconstructedMember = this.buildRoomMemberFromSocketState(socket);
      if (!reconstructedMember) {
        continue;
      }

      for (const roomKey of roomKeys.values()) {
        if (!roomKey || roomKey === socket.id) {
          continue;
        }

        const members = this.getRoomsStore().get(roomKey) ?? new Map();
        const existingMember = members.get(normalizedUsername);
        if (existingMember?.socketId === socket.id) {
          continue;
        }

        if (
          existingMember &&
          server?.sockets?.sockets?.has(existingMember.socketId)
        ) {
          continue;
        }

        members.set(normalizedUsername, reconstructedMember);
        this.getRoomsStore().set(roomKey, members);
        repairedRooms.add(roomKey);
        affectedTenantIds.add(reconstructedMember.tenantId || 'tenant_master');
      }
    }

    return { repairedRooms, affectedTenantIds };
  }

  private repairMissingRoomMembersForRoomFromAdapter(roomKey: string): void {
    const server = this.getServer();
    const socketIds = server?.sockets?.adapter?.rooms?.get(roomKey);
    if (!socketIds || socketIds.size === 0) {
      return;
    }

    const members = this.getRoomsStore().get(roomKey) ?? new Map();

    for (const socketId of socketIds.values()) {
      const socket = server?.sockets?.sockets?.get(socketId);
      if (!socket) {
        continue;
      }

      const state = this.getSocketPresenceState(socket);
      const normalizedUsername =
        state.normalizedUsername ??
        this.normalize(state.username ?? (socket as any).username);
      if (!normalizedUsername) {
        continue;
      }

      const existingMember = this.findRoomMemberEntry(
        members,
        normalizedUsername,
      );
      if (existingMember?.member?.socketId === socket.id) {
        continue;
      }

      const reconstructedMember = this.buildRoomMemberFromSocketState(socket);
      if (!reconstructedMember) {
        continue;
      }

      members.set(normalizedUsername, reconstructedMember);
      const socketRooms =
        this.getSocketRoomsStore().get(socket.id) ?? new Set<string>();
      socketRooms.add(roomKey);
      this.getSocketRoomsStore().set(socket.id, socketRooms);
    }

    if (members.size > 0) {
      this.getRoomsStore().set(roomKey, members);
    }
  }

  private removeSocketIdentityFromOtherRooms(params: {
    socket: Socket;
    normalizedUsername: string;
    nextRoom: string;
  }): Set<string> {
    const affectedRooms = new Set<string>();
    const socketRooms = this.getSocketRoomsStore().get(params.socket.id);

    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      if (roomKey === params.nextRoom) {
        continue;
      }

      const member = members.get(params.normalizedUsername);
      if (!member || member.socketId !== params.socket.id) {
        continue;
      }

      if (member.userId && member.roomId) {
        void this.closeVisibilitySessions({
          userId: member.userId,
          identityKey: buildIdentity(member.userId, member.agentNickname)
            .identityKey,
          roomId: member.roomId,
          socketId: params.socket.id,
        });
      }

      members.delete(params.normalizedUsername);
      if (members.size === 0) {
        this.getRoomsStore().delete(roomKey);
      }
      socketRooms?.delete(roomKey);
      void params.socket.leave(roomKey);
      affectedRooms.add(roomKey);
    }

    if (socketRooms && socketRooms.size === 0) {
      this.getSocketRoomsStore().delete(params.socket.id);
    }

    return affectedRooms;
  }

  private hasActiveUserPresenceInOtherRoom(params: {
    socket: Socket;
    normalizedUsername: string;
    nextRoom: string;
    tenantId: string;
    loginHistoryId?: number;
  }): boolean {
    const requestedTenantScope = this.tenantScopeOrDefault(params.tenantId);
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      if (roomKey === params.nextRoom) {
        continue;
      }

      const member = members.get(params.normalizedUsername);
      if (!member) {
        continue;
      }

      if (this.tenantScopeOrDefault(member.tenantId) !== requestedTenantScope) {
        continue;
      }

      if (member.socketId === params.socket.id) {
        return true;
      }

      if (
        typeof params.loginHistoryId === 'number' &&
        Number.isFinite(params.loginHistoryId) &&
        member.loginHistoryId === params.loginHistoryId
      ) {
        return true;
      }

      const socketRecord = this.server?.sockets?.sockets?.get(member.socketId);
      if (socketRecord && socketRecord.connected !== false) {
        return true;
      }
    }

    return false;
  }

  private buildRecentRoomLeaveKey(
    tenantId: string | undefined,
    normalizedUsername: string,
  ): string {
    return `${this.tenantScopeOrDefault(tenantId)}:${normalizedUsername}`;
  }

  private pruneRecentRoomLeaves(now = Date.now()) {
    for (const [key, record] of RoomsGateway.recentRoomLeaves.entries()) {
      if (now - record.leftAt > RoomsGateway.RECENT_ROOM_LEAVE_TTL_MS) {
        RoomsGateway.recentRoomLeaves.delete(key);
      }
    }
  }

  private recordRecentRoomLeave(roomKey: string, member: RoomMember) {
    const normalizedUsername = this.normalize(member.username);
    if (!normalizedUsername) {
      return;
    }

    const now = Date.now();
    this.pruneRecentRoomLeaves(now);
    RoomsGateway.recentRoomLeaves.set(
      this.buildRecentRoomLeaveKey(member.tenantId, normalizedUsername),
      {
        roomKey,
        leftAt: now,
        socketId: member.socketId,
        loginHistoryId: member.loginHistoryId,
      },
    );
  }

  private hasRecentRoomLeaveFromOtherRoom(params: {
    normalizedUsername: string;
    nextRoom: string;
    tenantId: string;
    loginHistoryId?: number;
  }): boolean {
    const now = Date.now();
    this.pruneRecentRoomLeaves(now);

    const record = RoomsGateway.recentRoomLeaves.get(
      this.buildRecentRoomLeaveKey(params.tenantId, params.normalizedUsername),
    );

    if (!record || record.roomKey === params.nextRoom) {
      return false;
    }

    if (now - record.leftAt > RoomsGateway.RECENT_ROOM_LEAVE_TTL_MS) {
      return false;
    }

    if (
      typeof params.loginHistoryId === 'number' &&
      Number.isFinite(params.loginHistoryId) &&
      typeof record.loginHistoryId === 'number' &&
      record.loginHistoryId !== params.loginHistoryId
    ) {
      return false;
    }

    return true;
  }

  private getActiveCallsStore(): Map<string, ActiveCallRecord> {
    return this.roomsState?.activeCalls ?? RoomsGateway.fallbackActiveCalls;
  }

  private getUserActiveCallsStore(): Map<string, string> {
    return (
      this.roomsState?.userActiveCalls ?? RoomsGateway.fallbackUserActiveCalls
    );
  }

  private getRoomInvitesStore(): Map<string, PendingRoomInviteRecord> {
    return RoomsGateway.fallbackRoomInvites;
  }

  private getMicInvitesStore(): Map<string, PendingMicInviteRecord> {
    return RoomsGateway.fallbackMicInvites;
  }

  private getTemporaryOperatorsStore(): Map<string, TemporaryOperatorRecord> {
    return RoomsGateway.fallbackTemporaryOperators;
  }

  private getRoleVisualOverridesStore(): Map<string, RoleVisualOverride> {
    return RoomsGateway.fallbackRoleVisualOverrides;
  }

  private getRoleOverrideKey(params: {
    userId?: number;
    username?: string | null;
  }): string | null {
    if (
      typeof params.userId === 'number' &&
      Number.isFinite(params.userId) &&
      params.userId > 0
    ) {
      return `id:${params.userId}`;
    }

    const normalizedUsername = this.normalize(params.username ?? undefined);
    if (!normalizedUsername) {
      return null;
    }

    return `username:${normalizedUsername}`;
  }

  private setRoleVisualOverride(params: {
    userId?: number;
    username?: string | null;
    role: RoleVisualOverride | null;
  }): void {
    const primaryKey = this.getRoleOverrideKey(params);
    if (primaryKey) {
      if (params.role) {
        this.getRoleVisualOverridesStore().set(primaryKey, params.role);
      } else {
        this.getRoleVisualOverridesStore().delete(primaryKey);
      }
    }

    if (
      typeof params.userId === 'number' &&
      Number.isFinite(params.userId) &&
      params.userId > 0
    ) {
      const usernameKey = this.getRoleOverrideKey({ username: params.username });
      if (usernameKey) {
        if (params.role) {
          this.getRoleVisualOverridesStore().set(usernameKey, params.role);
        } else {
          this.getRoleVisualOverridesStore().delete(usernameKey);
        }
      }
    }
  }

  private getRoleVisualOverride(params: {
    userId?: number;
    username?: string | null;
  }): RoleVisualOverride | null {
    const idKey = this.getRoleOverrideKey({ userId: params.userId });
    if (idKey) {
      const role = this.getRoleVisualOverridesStore().get(idKey);
      if (role) return role;
    }

    const usernameKey = this.getRoleOverrideKey({ username: params.username });
    if (usernameKey) {
      return this.getRoleVisualOverridesStore().get(usernameKey) ?? null;
    }

    return null;
  }

  emitForbiddenWordsUpdated(payload: {
    type: 'created' | 'deleted';
    forbiddenWordId?: number;
  }): void {
    const server = this.getServer();
    if (server?.emit) {
      server.emit('forbidden-words:updated', payload);
      return;
    }

    const queue = this.pendingServerEmits ?? [];
    if (!this.pendingServerEmits) {
      this.pendingServerEmits = queue;
    }
    queue.push({
      eventName: 'forbidden-words:updated',
      payload,
      contextLabel: 'forbidden words update',
    });
  }

  emitTenantSettingsUpdated(payload: {
    scope: 'system' | 'security';
    showMicrophonesOnMobile?: boolean;
    mobileHeaderColor?: string;
    mobileFooterColor?: string;
    communicationPermissions?: {
      guestCanWrite: boolean;
      memberAndGuestMicDurationSeconds: number;
      membersPrivateMessageEnabled: boolean;
      membersVoiceCallEnabled: boolean;
      guestPrivateMessageEnabled: boolean;
      guestVoiceCallEnabled: boolean;
      showMicrophonesOnMobile: boolean;
    };
    accessPolicyChanged?: boolean;
    changedFields?: string[];
  }): void {
    const server = this.getServer();
    if (server?.emit) {
      server.emit('tenant:settingsUpdated', payload);
      return;
    }

    const queue = this.pendingServerEmits ?? [];
    if (!this.pendingServerEmits) {
      this.pendingServerEmits = queue;
    }
    queue.push({
      eventName: 'tenant:settingsUpdated',
      payload,
      contextLabel: 'tenant settings update',
    });
  }

  public disconnectMembersForSystemAccessUpdate(policy: {
    everyoneCanEnterDisabled?: boolean;
    guestLoginDisabled?: boolean;
    desktopLoginDisabled?: boolean;
    mobileLoginDisabled?: boolean;
  }): number {
    const server = this.getServer();
    if (!server?.sockets?.sockets) {
      return 0;
    }

    const affectedSockets = new Map<
      string,
      { member: RoomMember; reason: string }
    >();
    const addAffectedMember = (member: RoomMember, socket?: Socket) => {
      if (this.isRootUsername(member.username)) {
        return;
      }

      const reason = this.getSystemAccessDisconnectReason(
        member,
        policy,
        socket,
      );
      if (!reason || affectedSockets.has(member.socketId)) {
        return;
      }

      affectedSockets.set(member.socketId, { member, reason });
    };

    for (const members of this.getRoomsStore().values()) {
      for (const member of members.values()) {
        const socket = server.sockets.sockets.get(member.socketId);
        addAffectedMember(member, socket);
      }
    }

    for (const socket of server.sockets.sockets.values()) {
      const member = this.buildSystemAccessMemberFromSocket(socket);
      if (!member) {
        continue;
      }

      addAffectedMember(member, socket);
    }

    let disconnectedCount = 0;
    for (const [socketId, { member, reason }] of affectedSockets.entries()) {
      const socket = server.sockets.sockets.get(socketId);
      if (!socket) {
        continue;
      }

      socket.emit('system:accessRevoked', {
        reason,
        username: member.username,
        isGuest: member.isGuest === true,
      });
      socket.disconnect(true);
      disconnectedCount += 1;
    }

    return disconnectedCount;
  }

  private buildSystemAccessMemberFromSocket(socket: Socket): RoomMember | null {
    const state = this.getSocketPresenceState(socket);
    const username =
      (typeof state.username === 'string' && state.username.trim()) ||
      ((socket as any).username as string | undefined)?.trim();

    if (!username) {
      return null;
    }

    return {
      socketId: socket.id,
      userId: state.userId,
      username,
      loginHistoryId: state.loginHistoryId,
      gender: state.gender === 'female' ? 'female' : 'male',
      isGuest: state.isGuest === true,
      tenantId:
        state.tenantId ||
        ((socket as any).tenantId as string | undefined) ||
        'tenant_master',
      deviceType: state.deviceType,
      device: state.device,
      clientType: state.clientType,
    };
  }

  private getSystemAccessDisconnectReason(
    member: RoomMember,
    policy: {
      everyoneCanEnterDisabled?: boolean;
      guestLoginDisabled?: boolean;
      desktopLoginDisabled?: boolean;
      mobileLoginDisabled?: boolean;
    },
    socket?: Socket,
  ): string | null {
    if (policy.everyoneCanEnterDisabled) {
      return 'site_entries_disabled';
    }

    if (policy.guestLoginDisabled && member.isGuest === true) {
      return 'guest_entries_disabled';
    }

    const deviceClass = this.classifyMemberDevice(member, socket);
    if (policy.desktopLoginDisabled && deviceClass === 'desktop') {
      return 'desktop_entries_disabled';
    }

    if (policy.mobileLoginDisabled && deviceClass === 'mobile') {
      return 'mobile_entries_disabled';
    }

    return null;
  }

  private classifyMemberDevice(
    member: RoomMember,
    socket?: Socket,
  ): 'desktop' | 'mobile' | null {
    const userAgent = this.resolveSocketUserAgent(socket);
    const values = [member.deviceType, member.clientType, member.device, userAgent]
      .map((value) => String(value ?? '').trim().toLocaleLowerCase('tr-TR'))
      .filter((value) => value.length > 0);

    if (values.length === 0) {
      return null;
    }

    const hasMobileSignal = values.some(
      (value) =>
        value.includes('mobile') ||
        value.includes('mobil') ||
        value.includes('android') ||
        value.includes('iphone') ||
        value.includes('ipad') ||
        value.includes('ios') ||
        value.includes('tablet'),
    );
    if (hasMobileSignal) {
      return 'mobile';
    }

    const hasDesktopSignal = values.some(
      (value) =>
        value.includes('desktop') ||
        value.includes('web') ||
        value.includes('browser') ||
        value.includes('windows') ||
        value.includes('mac') ||
        value.includes('linux'),
    );
    if (hasDesktopSignal) {
      return 'desktop';
    }

    return null;
  }

  private resolveSocketUserAgent(socket?: Socket): string | null {
    const header = socket?.handshake?.headers?.['user-agent'];
    if (Array.isArray(header)) {
      return header.join(' ');
    }
    return typeof header === 'string' ? header : null;
  }

  private async getSystemAccessJoinErrorForSocket(args: {
    client: Socket;
    username: string;
    isGuest: boolean;
    deviceType?: string;
    device?: string;
    clientType?: string;
  }): Promise<{ reason: string; detail: string } | null> {
    if (this.isRootUsername(args.username) || !this.systemSettingsService) {
      return null;
    }

    let settings:
      | {
          everyoneCanEnter?: boolean;
          guestLoginEnabled?: boolean;
          desktopLoginEnabled?: boolean;
          mobileLoginEnabled?: boolean;
        }
      | null = null;
    try {
      settings = await this.systemSettingsService.getSettings();
    } catch {
      return null;
    }

    if (settings?.everyoneCanEnter === false) {
      return {
        reason: 'site_entries_disabled',
        detail: 'Site girişleri kapatıldı.',
      };
    }

    if (args.isGuest && settings?.guestLoginEnabled === false) {
      return {
        reason: 'guest_entries_disabled',
        detail: 'Misafir girişleri kapatıldı.',
      };
    }

    const deviceClass = this.classifyMemberDevice(
      {
        socketId: args.client.id,
        username: args.username,
        gender: 'male',
        isGuest: args.isGuest,
        deviceType: args.deviceType,
        device: args.device,
        clientType: args.clientType,
      },
      args.client,
    );

    if (deviceClass === 'mobile' && settings?.mobileLoginEnabled === false) {
      return {
        reason: 'mobile_entries_disabled',
        detail: 'Mobil girişleri kapatıldı.',
      };
    }

    if (deviceClass === 'desktop' && settings?.desktopLoginEnabled === false) {
      return {
        reason: 'desktop_entries_disabled',
        detail: 'Masaüstü girişleri kapatıldı.',
      };
    }

    return null;
  }

  private getServer(): Server | null {
    return this.server ?? RoomsGateway.sharedServer ?? null;
  }

  public static getSharedServer(): Server | null {
    return RoomsGateway.sharedServer;
  }

  private isRoleDebugEnabled(): boolean {
    return process.env.ROLE_DEBUG_LOGS === 'true';
  }

  private isJoinEffectDebugEnabled(): boolean {
    return (
      process.env.JOIN_EFFECT_DEBUG_LOGS === 'true' ||
      process.env.ROLE_DEBUG_LOGS === 'true'
    );
  }

  private logRoleDebug(
    event: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.isRoleDebugEnabled()) return;
    this.logger.log(
      `[ROLE_DEBUG] ${event} ${JSON.stringify(payload, null, 2)}`,
    );
  }

  private logJoinEffectDebug(
    event: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.isJoinEffectDebugEnabled()) return;
    this.logger.log(
      `[JOIN_EFFECT_DEBUG] ${event} ${JSON.stringify(payload, null, 2)}`,
    );
  }

  private summarizeRoomMembers(roomKey: string): Array<Record<string, unknown>> {
    const members = this.getRoomsStore().get(roomKey);
    if (!members) {
      return [];
    }

    return Array.from(members.values()).map((member) => ({
      socketId: member.socketId,
      userId: member.userId,
      username: member.username,
      tenantId: member.tenantId,
      roleName: member.roleName,
      roleStarCount: member.roleStarCount,
      roleStarColor: member.roleStarColor,
      roleIcon: member.roleIcon,
      statusModeName: member.statusModeName,
    }));
  }

  private normalizeTenantScope(tenantId?: string | null): string | undefined {
    const trimmedTenantId = String(tenantId ?? '').trim();
    if (!trimmedTenantId) {
      return undefined;
    }

    return trimmedTenantId.replace(/^tenant_/, '');
  }

  private tenantScopeOrDefault(tenantId?: string | null): string {
    return this.normalizeTenantScope(tenantId) ?? 'master';
  }

  private emitToTenant(
    tenantId: string | undefined,
    eventName: string,
    payload: unknown,
    contextLabel: string,
  ): void {
    const normalizedTenantId = this.normalizeTenantScope(tenantId);
    if (!normalizedTenantId) {
      this.emitWithRetry(eventName, payload, contextLabel);
      return;
    }

    const server = this.getServer();
    if (!server?.to) {
      this.logger.warn(
        `Skipping ${contextLabel} emit because socket server is not ready (tenant: ${normalizedTenantId})`,
      );
      return;
    }

    const activeSockets = server.sockets?.sockets;
    const socketIds = new Set<string>();

    for (const members of this.getRoomsStore().values()) {
      for (const member of members.values()) {
        const memberTenantId =
          this.normalizeTenantScope(member.tenantId) ?? 'master';
        if (memberTenantId !== normalizedTenantId) {
          continue;
        }
        if (!member.socketId) {
          continue;
        }
        if (activeSockets && !activeSockets.has(member.socketId)) {
          continue;
        }
        socketIds.add(member.socketId);
      }
    }

    for (const socketId of socketIds) {
      server.to(socketId).emit(eventName, payload);
    }
  }

  emitSystemMessage(payload: {
    message: string;
    timestamp?: string;
    isSystemMessage?: boolean;
  }): void {
    const server = this.getServer();
    if (!server) {
      this.logger.warn('WebSocket server not ready to emit system message');
      return;
    }

    server.emit('tenant:systemMessage', {
      message: payload.message,
      timestamp: payload.timestamp || new Date().toISOString(),
      isSystemMessage: payload.isSystemMessage ?? true,
    });
  }

  emitSystemResetStarted(payload: {
    countdownSeconds: number;
    message: string;
  }): void {
    const now = Date.now();
    const countdownSeconds =
      Number.isFinite(payload.countdownSeconds) && payload.countdownSeconds > 0
        ? Math.floor(payload.countdownSeconds)
        : 10;
    const message = payload.message || 'Sistem resetleniyor';
    RoomsGateway.activeSystemResetState = {
      countdownSeconds,
      message,
      startedAtMs: now,
      endsAtMs: now + countdownSeconds * 1000,
      joinBlockedUntilMs: now + Math.max(countdownSeconds * 1000, 30_000),
    };

    const server = this.getServer();
    if (!server) {
      this.logger.warn('WebSocket server not ready to emit system reset event');
      return;
    }

    server.emit('system:resetStarted', {
      countdownSeconds,
      remainingDurationMs:
        RoomsGateway.activeSystemResetState.joinBlockedUntilMs - now,
      message,
      timestamp: new Date(now).toISOString(),
    });

    this.scheduleSystemResetDisconnect(countdownSeconds);
  }

  getActiveSystemResetPayload(now = Date.now()): {
    countdownSeconds: number;
    remainingDurationMs: number;
    message: string;
    timestamp: string;
  } | null {
    const resetState = RoomsGateway.activeSystemResetState;
    if (!resetState) return null;

    const remainingDurationMs = resetState.joinBlockedUntilMs - now;
    if (remainingDurationMs <= 0) {
      RoomsGateway.activeSystemResetState = null;
      return null;
    }
    const totalDurationMs =
      resetState.joinBlockedUntilMs - resetState.startedAtMs;
    const countdownStepMs = Math.max(
      1,
      Math.ceil(totalDurationMs / resetState.countdownSeconds),
    );

    return {
      countdownSeconds: Math.max(
        1,
        Math.ceil(remainingDurationMs / countdownStepMs),
      ),
      remainingDurationMs,
      message: resetState.message,
      timestamp: new Date(resetState.startedAtMs).toISOString(),
    };
  }

  private emitActiveSystemResetToClient(client: Socket): void {
    const payload = this.getActiveSystemResetPayload();
    if (!payload) return;

    client.emit('system:resetStarted', payload);
  }

  private isSystemResetJoinBlocked(now = Date.now()): boolean {
    const resetState = RoomsGateway.activeSystemResetState;
    if (!resetState) return false;

    if (resetState.joinBlockedUntilMs <= now) {
      RoomsGateway.activeSystemResetState = null;
      return false;
    }

    return true;
  }

  private scheduleSystemResetDisconnect(countdownSeconds: number): void {
    if (RoomsGateway.systemResetDisconnectTimer) {
      clearTimeout(RoomsGateway.systemResetDisconnectTimer);
      RoomsGateway.systemResetDisconnectTimer = null;
    }

    const disconnectDelayMs = Math.max(countdownSeconds * 1000, 30_000);
    RoomsGateway.systemResetDisconnectTimer = setTimeout(() => {
      this.disconnectAllSocketsForSystemReset();
      RoomsGateway.systemResetDisconnectTimer = null;
      RoomsGateway.activeSystemResetState = null;
    }, disconnectDelayMs);
    RoomsGateway.systemResetDisconnectTimer.unref?.();
  }

  private disconnectAllSocketsForSystemReset(): void {
    const server = this.getServer();
    const sockets = server?.sockets?.sockets;
    if (!sockets) return;

    for (const socket of sockets.values()) {
      socket.emit?.('system:resetFinished', {
        message: 'Sistem resetleme tamamlandı.',
        timestamp: new Date().toISOString(),
      });
      socket.disconnect?.(true);
    }
  }

  emitRoomHistoryCleared(payload: {
    room: string;
    roomName?: string | null;
  }): void {
    const normalizedRoom = this.normalize(payload.room);
    if (!normalizedRoom) return;

    const server = this.getServer();
    if (!server) {
      this.logger.warn('WebSocket server not ready to emit room history clear event');
      return;
    }

    server.to(normalizedRoom).emit('room:historyCleared', {
      room: normalizedRoom,
      roomName: payload.roomName ?? payload.room,
      timestamp: new Date().toISOString(),
    });
  }

  private getRoomRepository(): Repository<Room> | null {
    if (this.roomRepository) {
      return this.roomRepository;
    }

    const managerRepository = this.userRepository?.manager?.getRepository(Room);
    if (managerRepository) {
      return managerRepository;
    }

    return null;
  }

  private async isBlockedBetweenUsernames(
    callerUsername: string,
    targetUsername: string,
  ): Promise<boolean> {
    if (!this.userRepository || !this.friendRequestRepository) {
      this.logger?.warn?.(
        'Block check skipped because repositories are not available',
      );
      return false;
    }

    const normalizedCaller = this.normalize(callerUsername);
    const normalizedTarget = this.normalize(targetUsername);
    if (!normalizedCaller || !normalizedTarget) {
      return false;
    }

    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) IN (:...usernames)', {
        usernames: [normalizedCaller, normalizedTarget],
      })
      .select(['user.id', 'user.username'])
      .getMany();

    const caller = users.find(
      (user) => this.normalize(user.username) === normalizedCaller,
    );
    const target = users.find(
      (user) => this.normalize(user.username) === normalizedTarget,
    );
    if (!caller || !target) {
      return false;
    }

    const blocked = await this.friendRequestRepository.findOne({
      where: [
        {
          requesterId: caller.id,
          addresseeId: target.id,
          status: FriendRequestStatus.BLOCKED,
        },
        {
          requesterId: target.id,
          addresseeId: caller.id,
          status: FriendRequestStatus.BLOCKED,
        },
      ],
      select: ['id'],
    });
    return Boolean(blocked);
  }

  afterInit(server: Server): void {
    this.server = server;
    RoomsGateway.sharedServer = server;
    this.flushPendingServerEmits();
  }

  private flushPendingServerEmits(): void {
    const server = this.getServer();
    const queue = this.pendingServerEmits ?? [];
    if (!this.pendingServerEmits) {
      this.pendingServerEmits = queue;
    }
    if (!server?.emit || queue.length === 0) {
      return;
    }

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      server.emit(item.eventName, item.payload);
    }
  }

  private async getVoiceCallSettingsSafe(): Promise<{
    membersVoiceCallEnabled: boolean;
    guestVoiceCallEnabled: boolean;
  }> {
    try {
      if (this.systemSettingsService?.getSettings) {
        const settings = await this.systemSettingsService.getSettings();
        return {
          membersVoiceCallEnabled: Boolean(settings?.membersVoiceCallEnabled),
          guestVoiceCallEnabled: Boolean(settings?.guestVoiceCallEnabled),
        };
      }
    } catch (error) {
      this.logger?.warn?.('Voice call settings fallback is being used');
    }

    // DI/context kopuksa crash yerine aramayı çalışır tut
    return {
      membersVoiceCallEnabled: true,
      guestVoiceCallEnabled: true,
    };
  }

  private async getGuestWritingBlockedReasonSafe(
    member: RoomMember,
  ): Promise<string | null> {
    try {
      const settings = await this.systemSettingsService.getSettings();
      if (member.isGuest && !settings.guestCanWrite) {
        return 'Misafirler için mesaj gönderme kapalı.';
      }

      let userCreatedAtMs: number | undefined;
      if (typeof member.userId === 'number') {
        const user = await this.userRepository.findOne({
          where: { id: member.userId },
          select: ['id', 'createdAt'],
        });
        userCreatedAtMs = new Date(user?.createdAt ?? '').getTime();
      }

      const guestWaitSeconds = Number(settings.guestWaitSeconds) || 0;
      if (
        member.isGuest &&
        guestWaitSeconds > 0 &&
        Number.isFinite(userCreatedAtMs)
      ) {
        const guestWaitUpdatedAtMs = new Date(
          settings.guestWaitUpdatedAt ?? '',
        ).getTime();
        const guestWaitStartedAtMs = Number.isFinite(guestWaitUpdatedAtMs)
          ? Math.max(Number(userCreatedAtMs), guestWaitUpdatedAtMs)
          : Number(userCreatedAtMs);
        const elapsedSeconds = Math.floor(
          (Date.now() - guestWaitStartedAtMs) / 1000,
        );
        const remainingSeconds = guestWaitSeconds - elapsedSeconds;
        if (remainingSeconds > 0) {
          return `Misafir bekleme süresi: ${remainingSeconds} saniye`;
        }
      }

      if (!settings.firstMessageDelayEnabled) {
        return null;
      }

      const delaySeconds = Number(settings.firstMessageDelaySeconds) || 0;
      if (delaySeconds <= 0) {
        return null;
      }

      let delayStartedAtMs: number | undefined =
        member.guestFirstMessageDelayStartedAt;
      if (!Number.isFinite(delayStartedAtMs)) {
        delayStartedAtMs = userCreatedAtMs;
      }

      if (
        typeof delayStartedAtMs !== 'number' ||
        !Number.isFinite(delayStartedAtMs)
      ) {
        delayStartedAtMs = Date.now();
        member.guestFirstMessageDelayStartedAt = delayStartedAtMs;
      }

      const delayUpdatedAtMs = new Date(
        settings.firstMessageDelayUpdatedAt ?? '',
      ).getTime();
      delayStartedAtMs = Number.isFinite(delayUpdatedAtMs)
        ? Math.max(delayStartedAtMs, delayUpdatedAtMs)
        : delayStartedAtMs;

      const elapsedSeconds = Math.floor((Date.now() - delayStartedAtMs) / 1000);
      const remainingSeconds = delaySeconds - elapsedSeconds;
      return remainingSeconds > 0
        ? `İlk mesajınızı ${remainingSeconds} saniye sonra gönderebilirsiniz.`
        : null;
    } catch (error) {
      this.logger?.warn?.('Guest writing delay settings fallback is being used');
      return null;
    }
  }

  private shouldDeliverToTargetGroup(
    targetGroup: string | null | undefined,
    member: {
      isGuest: boolean;
      roleStarCount?: number;
      username: string;
    },
  ): boolean {
    if (!targetGroup || targetGroup === 'everyone') return true;
    if (targetGroup === 'members') return member.isGuest !== true;
    if (targetGroup === 'staff') {
      return (
        (member.roleStarCount ?? 0) >= 1 ||
        member.username?.toLowerCase() === 'root'
      );
    }
    return true;
  }

  private isRootUsername(username?: string | null): boolean {
    return this.normalize(username ?? undefined) === 'root';
  }

  private async hasPermissionByUsername(
    username: string,
    permissionLabel: string,
  ): Promise<boolean> {
    if (this.isRootUsername(username)) {
      return true;
    }
    const persistedUser = await this.findPersistedUserByUsername(username);
    return hasPermissionForUser(persistedUser, permissionLabel);
  }

  private buildUserKey(
    tenantId: string,
    username: string,
    agentNickname?: string | null,
  ): string | null {
    const normalized = this.normalize(username);
    if (!normalized) return null;
    const normalizedTenant =
      this.normalizeTenantScope(tenantId) ?? 'master';
    const normalizedAgentNickname =
      agentNickname === undefined
        ? undefined
        : this.normalize(agentNickname ?? undefined);
    return `${normalizedTenant}:${normalized}:${normalizedAgentNickname || 'normal'}`;
  }

  private findActiveMember(
    tenantId: string,
    username: string,
    agentNickname?: string | null,
  ): {
    socketId: string;
    username: string;
    gender: 'male' | 'female';
    isGuest: boolean;
    icon?: string;
    frame?: string;
    roleName?: string;
    roleStarCount?: number;
    agentNickname?: string;
    rejectIncomingCalls?: boolean;
    rejectRoomInvites?: boolean;
  } | null {
    const normalizedUsername = this.normalize(username);
    if (!normalizedUsername) return null;
    const normalizedTenantId = this.normalizeTenantScope(tenantId) ?? 'master';
    const normalizedAgentNickname =
      agentNickname === undefined
        ? undefined
        : this.normalize(agentNickname ?? undefined);
    for (const [, members] of this.getRoomsStore().entries()) {
      const member = members.get(normalizedUsername);
      if (!member) continue;
      const memberTenantId = this.tenantScopeOrDefault(member.tenantId);
      if (memberTenantId !== normalizedTenantId) continue;
      if (normalizedAgentNickname !== undefined) {
        const memberAgentNickname = this.normalize(member.agentNickname);
        if (normalizedAgentNickname) {
          if (memberAgentNickname !== normalizedAgentNickname) continue;
        } else if (memberAgentNickname) {
          continue;
        }
      }
      if (!this.server?.sockets?.sockets?.has(member.socketId)) continue;
      return {
        socketId: member.socketId,
        username: member.username,
        gender: member.gender,
        isGuest: member.isGuest === true,
        icon: member.icon,
        frame: member.frame,
        roleName: member.roleName,
        roleStarCount: member.roleStarCount,
        agentNickname: member.agentNickname,
        rejectIncomingCalls: member.rejectIncomingCalls === true,
        rejectRoomInvites: member.rejectRoomInvites === true,
      };
    }
    return null;
  }

  private getDisplayUsername(member: {
    username?: string;
    agentNickname?: string | null;
    roleStarCount?: number | null;
    isGuest?: boolean;
    guestAlias?: string | null;
    guestAliasReleased?: boolean | null;
  }): string {
    const guestAlias = member.guestAlias?.trim();
    if (member.isGuest === true && guestAlias && member.guestAliasReleased !== true) {
      return guestAlias;
    }

    const nickname = member.agentNickname?.trim();
    return nickname || member.username?.trim() || '';
  }

  private async isGuestDisplayAliasEnabled(): Promise<boolean> {
    try {
      const settings = await this.securitySettingsService?.getSettings?.();
      return settings?.guestSystemEnabled === true;
    } catch (error) {
      this.logWarn(
        `Guest alias setting lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private allocateRoomGuestAlias(
    roomMembers: Map<string, RoomMember>,
    joiningUsernameKey?: string | null,
  ): string {
    const usedGuestNumbers = new Set<number>();
    const serverSockets = this.getServer()?.sockets?.sockets;
    const normalizedJoiningUsername = this.normalize(joiningUsernameKey ?? undefined);

    for (const [memberKey, member] of roomMembers.entries()) {
      if (member.isGuest !== true || member.guestAliasReleased === true) continue;
      if (normalizedJoiningUsername && memberKey === normalizedJoiningUsername) continue;
      if (serverSockets && !serverSockets.has(member.socketId)) continue;

      const match = member.guestAlias?.trim().match(/^guest(\d+)$/i);
      if (!match) continue;
      const guestNumber = Number(match[1]);
      if (Number.isInteger(guestNumber) && guestNumber > 0) {
        usedGuestNumbers.add(guestNumber);
      }
    }

    let nextGuestNumber = 1;
    while (usedGuestNumbers.has(nextGuestNumber)) {
      nextGuestNumber += 1;
    }

    return `guest${nextGuestNumber}`;
  }

  private getDisplayUsernameForCallViewer(
    member: {
      username?: string;
      agentNickname?: string | null;
      roleStarCount?: number | null;
      isGuest?: boolean;
      guestAlias?: string | null;
      guestAliasReleased?: boolean | null;
    },
    viewerStarCount: number,
  ): string {
    const guestAlias = member.guestAlias?.trim();
    if (member.isGuest === true && guestAlias && member.guestAliasReleased !== true) {
      return guestAlias;
    }

    const nickname = member.agentNickname?.trim();
    const real = member.username?.trim() || '';
    if (!nickname) return real;
    const memberStarCount = Number(member.roleStarCount ?? 0);
    if (viewerStarCount >= memberStarCount) {
      return `${nickname} (${real})`;
    }
    return nickname;
  }

  private emitRoofExitJoinEffect(roomKey: string, member: RoomMember) {
    if (
      member.agentNickname ||
      !member.joinEffect ||
      member.statusModeName === 'Çatıda'
    ) {
      return;
    }

    // Apply the same role visual override as getRoomUsers (sidebar uses this)
    const roleVisualOverride = this.getRoleVisualOverride({
      userId: member.userId,
      username: member.username,
    });

    const payload = {
      room: roomKey,
      socketId: member.socketId,
      username: member.username,
      loginHistoryId: member.loginHistoryId ?? null,
      gender: member.gender,
      isGuest: member.isGuest,
      statusModeId: member.statusModeId ?? null,
      statusModeName: member.statusModeName ?? null,
      icon: member.icon ?? null,
      roleIcon: roleVisualOverride?.roleIcon ?? member.roleIcon ?? null,
      roleStarColor: roleVisualOverride?.roleStarColor ?? member.roleStarColor ?? null,
      roleStarCount: roleVisualOverride?.roleStarCount ?? member.roleStarCount ?? null,
      roleName: roleVisualOverride?.roleName ?? member.roleName ?? null,
      agentNickname: member.agentNickname ?? null,
      entryType: 'room',
      joinEffect: member.joinEffect,
    };

    this.server.to(roomKey).emit('room:userJoinEffectTriggered', payload);
  }

  private clearActiveCall(callId: string) {
    const call = this.getActiveCallsStore().get(callId);
    if (!call) return;
    if (call.timeoutId) {
      clearTimeout(call.timeoutId);
    }
    const callerKey = this.buildUserKey(
      call.tenantId,
      call.callerUsername,
      call.callerAgentNickname,
    );
    const targetKey = this.buildUserKey(
      call.tenantId,
      call.targetUsername,
      call.targetAgentNickname,
    );
    if (callerKey) this.getUserActiveCallsStore().delete(callerKey);
    if (targetKey) this.getUserActiveCallsStore().delete(targetKey);
    this.getActiveCallsStore().delete(callId);
  }

  private emitTenantWideMessage(
    tenantId: string | undefined,
    targetGroup: string | null | undefined,
    buildPayload: (roomKey: string) => Record<string, unknown>,
  ) {
    this.emitTenantWideEvent(
      tenantId,
      targetGroup,
      'room:message',
      buildPayload,
    );
  }

  private emitTenantWideImage(
    tenantId: string | undefined,
    targetGroup: string | null | undefined,
    buildPayload: (roomKey: string) => Record<string, unknown>,
  ) {
    this.emitTenantWideEvent(
      tenantId,
      targetGroup,
      'room:image',
      buildPayload,
    );
  }

  private emitTenantWideAudio(
    tenantId: string | undefined,
    targetGroup: string | null | undefined,
    buildPayload: (roomKey: string) => Record<string, unknown>,
  ) {
    this.emitTenantWideEvent(
      tenantId,
      targetGroup,
      'room:audio',
      buildPayload,
    );
  }

  private emitTenantWideYouTube(
    tenantId: string | undefined,
    targetGroup: string | null | undefined,
    buildPayload: (roomKey: string) => Record<string, unknown>,
  ) {
    this.emitTenantWideEvent(
      tenantId,
      targetGroup,
      'room:youtube',
      buildPayload,
    );
  }

  emitPersistedMessage(
    roomKey: string,
    message: MessageResponseDto,
  ): void {
    const normalizedRoom = this.normalize(roomKey);
    if (!normalizedRoom) return;
    const server = this.getServer();
    if (!server?.to) {
      this.logger?.warn?.(
        `Skipping persisted message emit because socket server is not ready for room ${normalizedRoom}`,
      );
      return;
    }

    const senderMember = this.findActiveRoomMember({
      roomKey: normalizedRoom,
      username: message.user?.username,
      userId: message.user?.id,
    });

    const payload: Record<string, unknown> = {
      room: normalizedRoom,
      id: message.id,
      messageId: message.id,
      username: message.user?.username || 'Bilinmeyen',
      displayUsername:
        message.user?.displayUsername ||
        message.user?.agentNickname ||
        message.user?.username ||
        'Bilinmeyen',
      originalUsername: message.user?.username || 'Bilinmeyen',
      message: message.content ?? '',
      gender: message.user?.gender === 'female' ? 'female' : 'male',
      isGuest: senderMember?.isGuest === true,
      timestamp:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : new Date(message.createdAt).toISOString(),
      fontColor: message.fontColor ?? null,
      targetGroup: message.targetGroup ?? null,
      roleStarCount: message.user?.role?.starCount ?? senderMember?.roleStarCount ?? null,
      image: message.image ?? undefined,
      audio: message.audio ?? undefined,
      audioFileName: message.audioFileName ?? undefined,
      icon: message.user?.icon ?? null,
      fontName: message.user?.fontName ?? null,
      granite: message.user?.granite ?? null,
      nickColor: message.user?.nickColor ?? null,
      flashNick: message.user?.flashNick ?? null,
    };

    if (message.replyToMessage) {
      payload.type = 'reply';
      payload.replyToMessage = {
        id: message.replyToMessage.id,
        content: message.replyToMessage.content ?? '',
        username: message.replyToMessage.user?.username ?? 'Bilinmeyen',
      };
    }

    server.to(normalizedRoom).emit('room:message', payload);
  }

  emitBotMessage(
    roomKey: string,
    payload: {
      botId: number;
      username: string;
      message: string;
      gender: 'male' | 'female';
      icon?: string | null;
      botSpeakerUsername: string;
      botSpeakerDisplayName?: string | null;
      messageId?: number;
    },
  ): void {
    const normalizedRoom = this.normalize(roomKey);
    const trimmedMessage = payload.message?.trim();
    if (!normalizedRoom || !trimmedMessage) return;

    const processedMessage = this.preprocessMessage(trimmedMessage);
    this.getServer()?.to(normalizedRoom).emit('room:message', {
      room: normalizedRoom,
      id: payload.messageId ?? undefined,
      messageId: payload.messageId ?? undefined,
      username: payload.username,
      displayUsername: payload.username,
      originalUsername: payload.username,
      message: processedMessage,
      gender: payload.gender,
      isGuest: false,
      isBot: true,
      botId: payload.botId,
      botSpeakerUsername: payload.botSpeakerUsername,
      botSpeakerDisplayName:
        payload.botSpeakerDisplayName || payload.botSpeakerUsername,
      timestamp: new Date().toISOString(),
      icon: payload.icon ?? null,
      fontColor: null,
      targetGroup: null,
      roleStarCount: null,
    });
  }

  private async getAiWelcomeBotForRoom(
    room: string,
    username: string,
  ): Promise<{
    bot: Bot;
    normalizedRoom: string;
    normalizedUsername: string;
  } | null> {
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);
    if (!normalizedRoom || !normalizedUsername) return null;

    const botRepository = this.getBotRepository();
    if (!botRepository) return null;

    const aiBots = await botRepository.find({ where: { isAI: true } });
    const aiBot = aiBots.find((candidate) => {
      if (!candidate.welcomeMessage?.trim()) return false;
      return this.normalize(candidate.room ?? undefined) === normalizedRoom;
    });
    if (!aiBot) return null;
    if (this.normalize(aiBot.username) === normalizedUsername) return null;

    return { bot: aiBot, normalizedRoom, normalizedUsername };
  }

  private async handleAiWelcome(payload: {
    room: string;
    username: string;
    displayUsername: string;
    welcomeSessionKey?: string | null;
    welcomeSessionKeys?: string[] | null;
  }): Promise<{
    manualPromptEnabled: boolean;
  } | null> {
    const result = await this.getAiWelcomeBotForRoom(
      payload.room,
      payload.username,
    );
    if (!result) return null;

    const welcomeSessionKeys = [
      payload.welcomeSessionKey,
      ...(payload.welcomeSessionKeys ?? []),
    ]
      .map((key) => key?.trim())
      .filter((key): key is string => Boolean(key));
    if (welcomeSessionKeys.length > 0) {
      this.pruneAiWelcomeSessionKeys();
      if (welcomeSessionKeys.some((key) => this.aiWelcomeSessionKeys.has(key))) {
        return null;
      }
      const now = Date.now();
      for (const key of welcomeSessionKeys) {
        this.aiWelcomeSessionKeys.set(key, now);
      }
    }

    const { bot: aiBot, normalizedRoom } = result;
    if (aiBot.welcomeManualPromptEnabled === true) {
      return { manualPromptEnabled: true };
    }
    if (aiBot.welcomeAutoSendEnabled === false) {
      return null;
    }

    const welcomeTemplate = aiBot.welcomeMessage?.trim() || '';
    const messageContent = welcomeTemplate.replace(
      /\[username\]/gi,
      payload.displayUsername,
    );
    let savedMessageId: number | undefined;

    try {
      const roomEntity = await this.roomRepository
        .createQueryBuilder('room')
        .where('LOWER(room.name) = :roomName', { roomName: normalizedRoom })
        .orWhere('LOWER(room.voiceId) = :voiceId', {
          voiceId: normalizedRoom,
        })
        .getOne();

      if (roomEntity) {
        const savedMessage = await this.messageRepository.save(
          this.messageRepository.create({
            content: messageContent,
            type: MessageType.NORMAL,
            userId: null,
            roomId: roomEntity.id,
            botId: aiBot.id,
            botUsername: aiBot.username,
            botSpeakerUsername: null,
            botSpeakerDisplayName: null,
            botAvatar: aiBot.avatar ?? null,
            botGender: aiBot.gender ?? null,
            botFontName: aiBot.fontName ?? null,
            botGranite: aiBot.granite ?? null,
            senderPublicName: aiBot.username,
            senderIdentityKey: `bot_${aiBot.id}`,
            senderIdentityType: 'normal',
          }),
        );
        savedMessageId = savedMessage.id;
      }
    } catch (error) {
      this.logger?.warn?.(
        `Failed to persist AI welcome message for bot "${aiBot.username}": ${error?.message || error}`,
      );
    }

    this.emitBotMessage(normalizedRoom, {
      botId: aiBot.id,
      username: aiBot.username,
      message: messageContent,
      gender: aiBot.gender,
      icon: aiBot.avatar ?? null,
      botSpeakerUsername: '',
      botSpeakerDisplayName: null,
      messageId: savedMessageId,
    });

    return {
      manualPromptEnabled: aiBot.welcomeManualPromptEnabled !== false,
    };
  }

  private shouldRunAiWelcomeForSiteEntry(params: {
    entryType: 'site' | 'room';
    statusModeName?: string | null;
  }): boolean {
    return params.entryType === 'site' && params.statusModeName !== 'Çatıda';
  }

  private buildAiWelcomeSessionKey(params: {
    tenantId?: string | null;
    loginHistoryId?: number | null;
    username?: string | null;
  }): string | null {
    return this.buildAiWelcomeSessionKeys(params)[0] ?? null;
  }

  private buildAiWelcomeSessionKeys(params: {
    tenantId?: string | null;
    loginHistoryId?: number | null;
    socketId?: string | null;
    username?: string | null;
  }): string[] {
    const normalizedUsername = this.normalize(params.username ?? undefined);
    if (!normalizedUsername) return [];

    const tenantKey = this.tenantScopeOrDefault(params.tenantId);
    const socketId = String(params.socketId ?? '').trim();
    const keys: string[] = [];
    if (
      typeof params.loginHistoryId === 'number' &&
      Number.isFinite(params.loginHistoryId)
    ) {
      keys.push(
        `${tenantKey}:login:${params.loginHistoryId}:${normalizedUsername}`,
      );
    }

    if (socketId) {
      keys.push(`${tenantKey}:socket:${socketId}:${normalizedUsername}`);
    }

    return keys;
  }

  private pruneAiWelcomeSessionKeys(): void {
    const expiresBefore =
      Date.now() - RoomsGateway.AI_WELCOME_SESSION_TTL_MS;

    for (const [key, createdAt] of this.aiWelcomeSessionKeys.entries()) {
      if (createdAt < expiresBefore) {
        this.aiWelcomeSessionKeys.delete(key);
      }
    }
  }

  private emitTenantWideEvent(
    tenantId: string | undefined,
    targetGroup: string | null | undefined,
    eventName: 'room:message' | 'room:image' | 'room:audio' | 'room:youtube',
    buildPayload: (roomKey: string) => Record<string, unknown>,
  ) {
    const normalizedTenantId =
      this.normalizeTenantScope(tenantId) ?? 'master';
    const activeSockets = this.server?.sockets?.sockets;
    const emittedSocketRoomPairs = new Set<string>();

    if (!activeSockets) return;

    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      for (const [, member] of members.entries()) {
        const memberTenantId =
          this.normalizeTenantScope(member.tenantId) ?? 'master';
        if (memberTenantId !== normalizedTenantId) continue;
        if (!activeSockets.has(member.socketId)) continue;
        if (!this.shouldDeliverToTargetGroup(targetGroup, member)) continue;

        const emissionKey = `${member.socketId}:${roomKey}`;
        if (emittedSocketRoomPairs.has(emissionKey)) continue;
        emittedSocketRoomPairs.add(emissionKey);

        const payload = buildPayload(roomKey);
        this.server.to(member.socketId).emit(eventName, payload);
      }
    }
  }

  handleConnection = (client: Socket) => {
    RoomsGateway.sharedServer = this.server ?? RoomsGateway.sharedServer;
    this.logger?.log?.(`Client connected: ${client?.id ?? 'unknown'}`);
    this.flushPendingServerEmits();
    this.getSocketRoomsStore().set(client.id, new Set());
    this.emitActiveSystemResetToClient(client);
  };

  handleDisconnect = (client: Socket) => {
    this.logger?.log?.(`Client disconnected: ${client.id}`);
    void this.closeVisibilitySessions({ socketId: client.id });
    const affectedTenantIds = new Set<string>();
    const removedMembers: Array<Record<string, unknown>> = [];
    for (const [inviteId, invite] of this.getRoomInvitesStore().entries()) {
      if (
        invite.inviterSocketId !== client.id &&
        invite.targetSocketId !== client.id
      ) {
        continue;
      }
      if (invite.targetSocketId === client.id) {
        this.server.to(invite.inviterSocketId).emit('room:invite:result', {
          status: 'error',
          code: 'target_offline',
          targetUsername: invite.targetUsername,
          roomName: invite.roomName,
        });
      }
      this.getRoomInvitesStore().delete(inviteId);
    }
    for (const [inviteId, invite] of this.getMicInvitesStore().entries()) {
      if (
        invite.inviterSocketId !== client.id &&
        invite.targetSocketId !== client.id
      ) {
        continue;
      }
      if (invite.targetSocketId === client.id) {
        this.server
          .to(invite.inviterSocketId)
          .emit('moderation:micInviteResult', {
            status: 'error',
            code: 'target_offline',
            targetUsername: invite.targetUsername,
            inviteId,
          });
      }
      this.getMicInvitesStore().delete(inviteId);
    }
    for (const [
      normalizedUsername,
      record,
    ] of this.getTemporaryOperatorsStore().entries()) {
      if (record.socketId !== client.id) continue;
      this.getTemporaryOperatorsStore().delete(normalizedUsername);
      this.emitTemporaryOperatorUpdated(
        record.tenantId || 'tenant_master',
        record.username,
        false,
      );
    }

    const affectedRoomKeys = new Set<string>();
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      let removedAny = false;
      for (const [usernameKey, info] of members.entries()) {
        if (info.socketId !== client.id) continue;
        members.delete(usernameKey);
        removedAny = true;
        removedMembers.push({
          roomKey,
          socketId: info.socketId,
          userId: info.userId,
          username: info.username,
          tenantId: info.tenantId,
          roleName: info.roleName,
          roleStarCount: info.roleStarCount,
          roleStarColor: info.roleStarColor,
          roleIcon: info.roleIcon,
        });
        this.recordRecentRoomLeave(roomKey, info);
        if (info.tenantId) {
          affectedTenantIds.add(info.tenantId);
        }
        this.server.to(roomKey).emit('room:userLeft', {
          room: roomKey,
          username: info.username,
          displayUsername: this.getDisplayUsername(info),
        });
      }

      if (removedAny) {
        affectedRoomKeys.add(roomKey);
      }

      if (members.size === 0) {
        this.getRoomsStore().delete(roomKey);
      }
    }

    for (const roomKey of affectedRoomKeys) {
      // Odadaki tüm kullanıcıları gönder
      this.emitRoomUsers(roomKey);
      this.logRoleDebug('handleDisconnect:roomStateAfterRemoval', {
        roomKey,
        disconnectingSocketId: client.id,
        removedMembers: removedMembers.filter((item) => item.roomKey === roomKey),
        roomMembers: this.summarizeRoomMembers(roomKey),
      });
    }

    this.getSocketRoomsStore().delete(client.id);

    for (const [callId, call] of this.getActiveCallsStore().entries()) {
      if (
        call.callerSocketId !== client.id &&
        call.targetSocketId !== client.id
      ) {
        continue;
      }

      if (call.status === 'ringing') {
        if (call.callerSocketId === client.id) {
          this.server
            .to(call.targetSocketId)
            .emit('call:canceled', { callId, callType: call.callType });
        } else {
          const callerMember = this.findActiveMember(
            call.tenantId,
            call.callerUsername,
          ) || { username: call.callerUsername };
          const targetMember = this.findActiveMember(
            call.tenantId,
            call.targetUsername,
          ) || { username: call.targetUsername };
          const callerViewerStars =
            'roleStarCount' in callerMember
              ? (callerMember.roleStarCount ?? 0)
              : 0;
          this.server.to(call.callerSocketId).emit('call:missed', {
            callId,
            callType: call.callType,
            callerUsername: this.getDisplayUsernameForCallViewer(
              callerMember,
              callerViewerStars,
            ),
            targetUsername: this.getDisplayUsernameForCallViewer(
              targetMember,
              callerViewerStars,
            ),
          });
        }
      } else if (call.status === 'active') {
        const durationSec = call.acceptedAt
          ? Math.max(0, Math.floor((Date.now() - call.acceptedAt) / 1000))
          : 0;
        const otherSocketId =
          call.callerSocketId === client.id
            ? call.targetSocketId
            : call.callerSocketId;
        this.server
          .to(otherSocketId)
          .emit('call:ended', { callId, callType: call.callType, durationSec });
      }

      this.clearActiveCall(callId);
    }

    for (const tenantId of affectedTenantIds) {
      this.emitTenantActiveUserSnapshot(tenantId);
    }
  };

  @SubscribeMessage('joinRoom')
  async handleJoin(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger?.log?.(`joinRoom event received from ${client.id}:`, payload);
    const {
      room,
      roomId,
      roomName,
      username,
      loginHistoryId,
      gender,
      tenantId,
      roleName,
      agentNickname,
      role,
      roleStarColor,
      roleStarCount,
      roleIcon,
      statusModeId,
      statusModeName,
      frame,
      icon,
      fontName,
      granite,
      nickColor,
      userGif,
      flashNick,
      joinEffect,
      deviceType,
      device,
      clientType,
      globalMuted,
      rejectIncomingCalls,
      rejectRoomInvites,
    } = payload ?? {};

    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);
    const trimmedUsername = username?.trim();
    const trimmedRoomName = roomName?.trim();
    const trimmedAgentNickname = agentNickname?.trim();
    const parsedStatusModeId = statusModeId ? Number(statusModeId) : undefined;
    const rawRoleName =
      typeof roleName === 'string' && roleName.trim() ? roleName : role?.name;
    const trimmedRoleName =
      typeof rawRoleName === 'string' ? rawRoleName.trim() : undefined;
    const trimmedRoleStarColor =
      typeof roleStarColor === 'string' && roleStarColor.trim()
        ? roleStarColor.trim()
        : role?.starColor?.trim();
    const parsedRoleStarCount =
      typeof roleStarCount === 'number'
        ? roleStarCount
        : typeof role?.starCount === 'number'
          ? role.starCount
          : undefined;
    const trimmedRoleIcon =
      typeof roleIcon === 'string' && roleIcon.trim()
        ? roleIcon.trim()
        : role?.icon?.trim();
    const trimmedFrame = frame?.trim();
    const trimmedIcon = icon?.trim();
    const trimmedFontName = fontName?.trim();
    const trimmedGranite = granite?.trim();
    const trimmedNickColor = nickColor?.trim();
    const trimmedUserGif = userGif?.trim();
    const trimmedFlashNick = flashNick?.trim();
    const trimmedJoinEffect = joinEffect?.trim();
    const trimmedDeviceType = deviceType?.trim();
    const trimmedDevice = device?.trim();
    const trimmedClientType = clientType?.trim();
    const trimmedTenantId = tenantId?.trim();
    const normalizedTenantId = trimmedTenantId
      ? trimmedTenantId.replace(/^tenant_/, '')
      : undefined;
    const isGuest = payload?.guest === true;

    if (!normalizedRoom || !normalizedUsername || !trimmedUsername) {
      this.logger?.warn?.(`Invalid joinRoom payload from ${client.id}`);
      return { status: 'error', message: 'room and username are required' };
    }

    const clientIp = this.resolveClientIp(client);
    if (
      clientIp &&
      this.securitySettingsService &&
      (await this.securitySettingsService.hasActiveFloodBan(clientIp))
    ) {
      const joinErrorPayload = {
        room: normalizedRoom,
        roomName: trimmedRoomName || undefined,
        message: 'ip_banned',
        detail: 'Bu cihazın siteye girişi engellendi.',
      };
      client.emit('room:joinError', joinErrorPayload);
      client.disconnect(true);
      return {
        status: 'error',
        ...joinErrorPayload,
      };
    }

    const activeSystemResetPayload = this.getActiveSystemResetPayload();
    if (activeSystemResetPayload) {
      client.emit('system:resetStarted', activeSystemResetPayload);
    }
    if (this.isSystemResetJoinBlocked()) {
      client.emit('room:joinError', {
        room: normalizedRoom,
        roomName: trimmedRoomName || undefined,
        message: 'reset_in_progress',
        detail: 'Sistem resetlenirken giriş yapılamaz.',
        countdownSeconds: activeSystemResetPayload?.countdownSeconds,
        remainingDurationMs: activeSystemResetPayload?.remainingDurationMs,
      });

      return {
        status: 'error',
        room: normalizedRoom,
        roomName: trimmedRoomName || undefined,
        message: 'reset_in_progress',
        detail: 'Sistem resetlenirken giriş yapılamaz.',
        countdownSeconds: activeSystemResetPayload?.countdownSeconds,
        remainingDurationMs: activeSystemResetPayload?.remainingDurationMs,
      };
    }

    const systemAccessJoinError =
      await this.getSystemAccessJoinErrorForSocket({
        client,
        username: trimmedUsername,
        isGuest,
        deviceType: trimmedDeviceType,
        device: trimmedDevice,
        clientType: trimmedClientType,
      });
    if (systemAccessJoinError) {
      const joinErrorPayload = {
        room: normalizedRoom,
        roomName: trimmedRoomName || undefined,
        message: systemAccessJoinError.reason,
        detail: systemAccessJoinError.detail,
      };
      client.emit('system:accessRevoked', {
        reason: systemAccessJoinError.reason,
        username: trimmedUsername,
        isGuest,
      });
      client.emit('room:joinError', joinErrorPayload);
      client.disconnect(true);
      return {
        status: 'error',
        ...joinErrorPayload,
      };
    }

    // Frontend oda değişimini isTeleport ile açıkça işaretler. Yine de
    // kaçan geçişlerde aynı kullanıcı başka odada aktifse backend oda girişi sayar.
    const isExplicitRoomNavigation = payload?.isTeleport === true;

    if (
      this.isUsernameTakenInRoom(normalizedRoom, normalizedUsername, client.id)
    ) {
      client.emit('room:joinError', {
        room: normalizedRoom,
        message: 'username_taken',
      });

      return { status: 'error', message: 'username_taken' };
    }

    const effectiveTenantId = this.tenantScopeOrDefault(normalizedTenantId);
    const tempOpRecord =
      this.getTemporaryOperatorsStore().get(normalizedUsername);
    if (
      tempOpRecord &&
      this.tenantScopeOrDefault(tempOpRecord.tenantId) === effectiveTenantId &&
      tempOpRecord.socketId !== client.id
    ) {
      this.getTemporaryOperatorsStore().delete(normalizedUsername);
      this.emitTemporaryOperatorUpdated(
        effectiveTenantId,
        tempOpRecord.username,
        false,
      );
    }

    const joinAccess = await this.validateRoomJoinAccess({
      normalizedRoom,
      rawRoom: room?.trim(),
      rawRoomId:
        typeof roomId === 'number' || typeof roomId === 'string'
          ? String(roomId).trim()
          : undefined,
      normalizedUsername,
      trimmedUsername,
      trimmedRoomName,
      isGuest,
      fallbackRoleStarCount: parsedRoleStarCount ?? 0,
    });
    if (!joinAccess.allowed) {
      const joinErrorPayload = {
        room: normalizedRoom,
        roomName: trimmedRoomName || joinAccess.roomEntity?.name || undefined,
        message: joinAccess.code,
        detail: joinAccess.message,
        requiredMinStar: joinAccess.requiredMinStar,
        userStarCount: joinAccess.effectiveStarCount,
      };

      client.emit('room:joinError', joinErrorPayload);
      return {
        status: 'error',
        ...joinErrorPayload,
      };
    }

    const effectiveRoleStarCount = joinAccess.effectiveStarCount;
    const dbModeration = joinAccess.persistedModerationState;
    const persistedRole =
      !isGuest && joinAccess.persistedUser?.role
        ? joinAccess.persistedUser.role
        : null;
    const effectiveRoleName = isGuest
      ? (trimmedRoleName || undefined)
      : (persistedRole?.name?.trim() || trimmedRoleName || (joinAccess as any).roleName || undefined);
    this.logRoleDebug('handleJoin role resolution', {
      username: trimmedUsername,
      isGuest,
      persistedRoleName: persistedRole?.name ?? 'NULL',
      persistedRoleId: persistedRole?.id ?? 'NULL',
      persistedRoleStarCount: persistedRole?.starCount ?? 'NULL',
      joinAccessRoleName: (joinAccess as any).roleName ?? 'NULL',
      effectiveRoleName: effectiveRoleName ?? 'NULL',
      roleVisualOverrideRoleName:
        this.getRoleVisualOverride({
          userId: joinAccess.persistedUser?.id,
          username: trimmedUsername,
        })?.roleName ?? 'NULL',
      trimmedRoleName: trimmedRoleName ?? 'NULL',
    });
    const effectiveRoleStarColor = isGuest
      ? trimmedRoleStarColor || undefined
      : typeof persistedRole?.starColor === 'string' &&
          persistedRole.starColor.trim()
        ? persistedRole.starColor.trim()
        : trimmedRoleStarColor || undefined;
    const effectiveRoleIcon = isGuest
      ? trimmedRoleIcon || undefined
      : typeof persistedRole?.icon === 'string' && persistedRole.icon.trim()
        ? persistedRole.icon.trim()
        : trimmedRoleIcon || undefined;
    const effectiveAgentNickname =
      trimmedAgentNickname && !isGuest ? trimmedAgentNickname : undefined;
    const effectiveJoinEffect = isGuest
      ? trimmedJoinEffect || undefined
      : typeof trimmedJoinEffect === 'string' &&
            trimmedJoinEffect.length > 0
        ? trimmedJoinEffect
        : typeof joinAccess.persistedUser?.joinEffect === 'string' &&
              joinAccess.persistedUser.joinEffect.trim()
          ? joinAccess.persistedUser.joinEffect.trim()
          : undefined;
    const shouldDowngradeRoofStatus =
      statusModeName === 'Çatıda' && !joinAccess.canUseRoofMode;
    const effectiveStatusModeName = shouldDowngradeRoofStatus
      ? 'Çevrimiçi'
      : statusModeName || undefined;
    const effectiveStatusModeId =
      !shouldDowngradeRoofStatus && Number.isFinite(parsedStatusModeId)
        ? parsedStatusModeId
        : undefined;

    this.logRoleDebug('handleJoin:resolvedIdentity', {
      room: normalizedRoom,
      socketId: client.id,
      username: trimmedUsername,
      normalizedUsername,
      isGuest,
      tenantId: effectiveTenantId,
      persistedUserId: joinAccess.persistedUser?.id,
      persistedUsername: joinAccess.persistedUser?.username,
      persistedRoleName: persistedRole?.name,
      persistedRoleStarCount: persistedRole?.starCount,
      persistedRoleStarColor: persistedRole?.starColor,
      persistedRoleIcon: persistedRole?.icon,
      payloadRoleName: trimmedRoleName,
      payloadRoleStarCount: parsedRoleStarCount,
      payloadRoleStarColor: trimmedRoleStarColor,
      payloadRoleIcon: trimmedRoleIcon,
      effectiveRoleName,
      effectiveRoleStarCount,
      effectiveRoleStarColor,
      effectiveRoleIcon,
      statusModeName: effectiveStatusModeName,
    });

    const canonicalRoomKey =
      this.normalize(joinAccess.roomEntity?.voiceId ?? undefined) ||
      normalizedRoom;
    const parsedLoginHistoryId =
      typeof loginHistoryId === 'number' && Number.isFinite(loginHistoryId)
        ? loginHistoryId
        : undefined;
    const hasOtherRoomPresence = this.hasActiveUserPresenceInOtherRoom({
      socket: client,
      normalizedUsername,
      nextRoom: canonicalRoomKey,
      tenantId: effectiveTenantId,
      loginHistoryId: parsedLoginHistoryId,
    });
    const hasRecentRoomLeave = this.hasRecentRoomLeaveFromOtherRoom({
      normalizedUsername,
      nextRoom: canonicalRoomKey,
      tenantId: effectiveTenantId,
      loginHistoryId: parsedLoginHistoryId,
    });
    const isTeleport =
      isExplicitRoomNavigation || hasOtherRoomPresence || hasRecentRoomLeave;
    const entryType = isTeleport ? 'room' : 'site';
    const shouldRunSiteWelcome = this.shouldRunAiWelcomeForSiteEntry({
      entryType,
      statusModeName: effectiveStatusModeName,
    });

    this.logJoinEffectDebug('handleJoin:computed', {
      socketId: client.id,
      room: normalizedRoom,
      canonicalRoom: canonicalRoomKey,
      tenantId: effectiveTenantId,
      username: trimmedUsername,
      isGuest,
      payloadJoinEffect: trimmedJoinEffect || null,
      persistedJoinEffect:
        typeof joinAccess.persistedUser?.joinEffect === 'string'
          ? joinAccess.persistedUser.joinEffect.trim() || null
          : null,
      effectiveJoinEffect: effectiveJoinEffect ?? null,
      isTeleport,
      isExplicitRoomNavigation,
      hasOtherRoomPresence,
      hasRecentRoomLeave,
      entryType,
      requestedStatusModeName: statusModeName || null,
      effectiveStatusModeName: effectiveStatusModeName ?? null,
      effectiveRoleStarCount,
    });

    if (
      canonicalRoomKey !== normalizedRoom &&
      this.isUsernameTakenInRoom(canonicalRoomKey, normalizedUsername, client.id)
    ) {
      client.emit('room:joinError', {
        room: canonicalRoomKey,
        roomName: trimmedRoomName || joinAccess.roomEntity?.name || undefined,
        message: 'username_taken',
      });

      return { status: 'error', message: 'username_taken' };
    }

    const roomMembers =
      this.getRoomsStore().get(canonicalRoomKey) ??
      new Map<string, RoomMember>();
    const guestAlias =
      isGuest && (await this.isGuestDisplayAliasEnabled())
        ? this.allocateRoomGuestAlias(roomMembers, normalizedUsername)
        : undefined;

    try {
      await client.join(canonicalRoomKey);
    } catch (error) {
      this.logger?.error?.(`Join room failed: ${error}`);
      return { status: 'error', message: 'join_failed' };
    }

    roomMembers.set(normalizedUsername, {
      socketId: client.id,
      userId: joinAccess.persistedUser?.id,
      roomId: joinAccess.roomEntity?.id,
      username: trimmedUsername,
      loginHistoryId:
        typeof loginHistoryId === 'number' && Number.isFinite(loginHistoryId)
          ? loginHistoryId
          : undefined,
      gender: (gender as 'male' | 'female') ?? 'male',
      isGuest,
      guestAlias,
      guestAliasReleased: false,
      guestFirstMessageDelayStartedAt: isGuest ? Date.now() : undefined,
      tenantId: effectiveTenantId,
      isInVoiceChat: false,
      isMuted: false,
      isInVoiceSeat: false,
      voiceSeatJoinedAt: undefined,
      voiceSeatIndex: undefined,
      isHandRaised: false,
      isCameraOn: false,
      statusModeId: effectiveStatusModeId,
      statusModeName: effectiveStatusModeName,
      roleName: effectiveRoleName,
      roleStarColor: effectiveRoleStarColor,
      roleStarCount: effectiveRoleStarCount,
      roleIcon: effectiveRoleIcon,
      frame: trimmedFrame || undefined,
      icon: trimmedIcon || undefined,
      fontName: trimmedFontName || undefined,
      granite: trimmedGranite || undefined,
      nickColor: trimmedNickColor || undefined,
      userGif: trimmedUserGif || undefined,
      flashNick: trimmedFlashNick || undefined,
      joinEffect: effectiveJoinEffect,
      agentNickname: effectiveAgentNickname,
      deviceType: trimmedDeviceType || undefined,
      device: trimmedDevice || trimmedDeviceType || undefined,
      clientType: trimmedClientType || trimmedDeviceType || undefined,
      micBanned: dbModeration?.micBanned ?? payload?.micBanned === true,
      micBannedByStarCount: dbModeration?.micBannedByStarCount ?? 0,
      cameraBanned:
        dbModeration?.cameraBanned ?? payload?.cameraBanned === true,
      cameraBannedByStarCount: dbModeration?.cameraBannedByStarCount ?? 0,
      roomMuted: false,
      roomMutedByStarCount: 0,
      globalMuted: dbModeration?.globalMuted ?? globalMuted === true,
      globalMutedByStarCount: dbModeration?.globalMutedByStarCount ?? 0,
      rejectIncomingCalls: rejectIncomingCalls === true,
      rejectRoomInvites: rejectRoomInvites === true,
      ipAddress: clientIp || undefined,
    });
    this.getRoomsStore().set(canonicalRoomKey, roomMembers);

    const liveMember = roomMembers.get(normalizedUsername);
    if (liveMember) {
      this.syncSocketPresenceFromMember(client, liveMember);
    }
    const effectiveDisplayUsername = liveMember
      ? this.getDisplayUsername(liveMember)
      : this.getDisplayUsername({
          username: trimmedUsername,
          agentNickname: effectiveAgentNickname,
        });

    await this.startVisibilitySession({
      userId: liveMember?.userId,
      agentNickname: liveMember?.agentNickname,
      roomId: liveMember?.roomId,
      socketId: client.id,
    });

    // Oda adını sakla
    if (trimmedRoomName && canonicalRoomKey) {
      this.getRoomNamesStore().set(canonicalRoomKey, trimmedRoomName);
    }

    const clientRooms =
      this.getSocketRoomsStore().get(client.id) ?? new Set<string>();
    clientRooms.add(canonicalRoomKey);
    this.getSocketRoomsStore().set(client.id, clientRooms);
    const roomsToRefresh = this.removeSocketIdentityFromOtherRooms({
      socket: client,
      normalizedUsername,
      nextRoom: canonicalRoomKey,
    });

    this.server.to(canonicalRoomKey).emit('room:userJoined', {
      room: canonicalRoomKey,
      socketId: client.id,
      username: trimmedUsername,
      loginHistoryId:
        typeof loginHistoryId === 'number' && Number.isFinite(loginHistoryId)
          ? loginHistoryId
          : undefined,
      displayUsername: effectiveDisplayUsername,
      guest: isGuest,
      guestAlias,
      guestAliasReleased: false,
      gender: payload?.gender,
      tenantId: effectiveTenantId,
      agentNickname: effectiveAgentNickname,
      statusModeId: effectiveStatusModeId,
      statusModeName: effectiveStatusModeName,
      roleName: effectiveRoleName,
      roleStarColor: effectiveRoleStarColor,
      roleStarCount: effectiveRoleStarCount,
      roleIcon: effectiveRoleIcon,
      frame: trimmedFrame || undefined,
      icon: trimmedIcon || undefined,
      flashNick: trimmedFlashNick || undefined,
      joinEffect: effectiveJoinEffect,
      deviceType: trimmedDeviceType || undefined,
      device: trimmedDevice || trimmedDeviceType || undefined,
      clientType: trimmedClientType || trimmedDeviceType || undefined,
      entryType,
      isHandRaised: false,
      isCameraOn: false,
    });

    if (shouldRunSiteWelcome) {
      const displayUsername = effectiveDisplayUsername;

      const welcomeMessage = await this.handleAiWelcome({
        room: canonicalRoomKey,
        username: trimmedUsername,
        displayUsername: effectiveDisplayUsername,
        welcomeSessionKeys: this.buildAiWelcomeSessionKeys({
          tenantId: effectiveTenantId,
          loginHistoryId: parsedLoginHistoryId,
          socketId: client.id,
          username: trimmedUsername,
        }),
      });

      if (welcomeMessage?.manualPromptEnabled) {
        this.server.to(canonicalRoomKey).emit('room:welcomePromptRequested', {
          room: canonicalRoomKey,
          socketId: client.id,
          username: trimmedUsername,
          displayUsername,
          agentNickname: effectiveAgentNickname,
          roleStarCount: effectiveRoleStarCount,
          statusModeName: effectiveStatusModeName,
          entryType: 'site',
        });
      }
    }

    if (effectiveJoinEffect && !effectiveAgentNickname) {
      this.logJoinEffectDebug('handleJoin:emitting', {
        socketId: client.id,
        room: canonicalRoomKey,
        tenantId: effectiveTenantId,
        username: trimmedUsername,
        effectiveJoinEffect,
        effectiveStatusModeName: effectiveStatusModeName ?? null,
        emitsRoomScoped:
          entryType === 'room' || effectiveStatusModeName !== 'Çatıda',
        emitsTenantScoped: entryType === 'site' || effectiveStatusModeName !== 'Çatıda',
      });
      const joinUserId = !isGuest ? joinAccess.persistedUser?.id : undefined;
      const roleVisualOverride = this.getRoleVisualOverride({
        userId: joinUserId,
        username: trimmedUsername,
      });
      const emitRoleName = roleVisualOverride?.roleName ?? effectiveRoleName ?? null;
      const emitRoleStarColor = roleVisualOverride?.roleStarColor ?? effectiveRoleStarColor ?? null;
      const emitRoleStarCount = roleVisualOverride?.roleStarCount ?? effectiveRoleStarCount ?? null;
      const emitRoleIcon = roleVisualOverride?.roleIcon ?? effectiveRoleIcon ?? null;
      const emittedJoinEffect = effectiveAgentNickname ? null : effectiveJoinEffect;

      const payload = {
        room: canonicalRoomKey,
        socketId: client.id,
        username: trimmedUsername,
        loginHistoryId:
          typeof loginHistoryId === 'number' && Number.isFinite(loginHistoryId)
            ? loginHistoryId
            : undefined,
        gender: (gender as 'male' | 'female') ?? 'male',
        isGuest,
        guestAlias,
        guestAliasReleased: false,
        statusModeId: effectiveStatusModeId ?? null,
        statusModeName: effectiveStatusModeName ?? null,
        icon: effectiveAgentNickname ? undefined : trimmedIcon || null,
        roleIcon: emitRoleIcon,
        roleStarColor: emitRoleStarColor,
        roleStarCount: emitRoleStarCount,
        roleName: emitRoleName,
        agentNickname: effectiveAgentNickname ?? null,
        entryType,
        joinEffect: emittedJoinEffect,
      };

      if (entryType === 'site') {
        // İlk site girişi: Kullanıcı çatıda başlasa bile global banner gösterilir.
        this.server.emit('tenant:joinEffectTriggered', payload);
        if (effectiveStatusModeName !== 'Çatıda') {
          // Kullanıcı görünürse odaya özel event de gönderilir.
          this.server.to(canonicalRoomKey).emit('room:userJoinEffectTriggered', payload);
        }
      } else {
        // Oda/çatı girişinde event her zaman odaya gider.
        // Web çatı görünürlüğünü client tarafında korur; mobilde efekt kutucuğu yine düşer.
        this.server.to(canonicalRoomKey).emit('room:userJoinEffectTriggered', payload);
      }
    }

    this.logRoleDebug('handleJoin agentNickname', {
      username: trimmedUsername,
      agentNickname: effectiveAgentNickname ?? null,
    });

    // Odadaki tüm kullanıcıları gönder
    this.emitRoomUsers(canonicalRoomKey);
    void this.emitRoomUsersToClient(canonicalRoomKey, client);
    setTimeout(() => {
      void this.emitRoomUsersToClient(canonicalRoomKey, client);
    }, 250);
    roomsToRefresh.forEach((roomKey) => this.emitRoomUsers(roomKey));
    this.emitTenantActiveUserSnapshot(effectiveTenantId);

    this.logRoleDebug('handleJoin:roomStateAfterJoin', {
      room: canonicalRoomKey,
      joinedUser: trimmedUsername,
      roomMembers: this.summarizeRoomMembers(canonicalRoomKey),
    });

    this.startSorubazIfNeeded(canonicalRoomKey);

    return {
      status: 'ok',
      room: canonicalRoomKey,
      username: trimmedUsername,
      loginHistoryId:
        typeof loginHistoryId === 'number' && Number.isFinite(loginHistoryId)
          ? loginHistoryId
          : undefined,
      guest: isGuest,
      displayUsername: effectiveDisplayUsername,
      guestAlias,
      guestAliasReleased: false,
      gender: payload?.gender,
      tenantId: trimmedTenantId || undefined,
      agentNickname: effectiveAgentNickname,
      statusModeId: effectiveStatusModeId,
      statusModeName: effectiveStatusModeName,
      roleName: effectiveRoleName,
      roleStarColor: effectiveRoleStarColor,
      roleStarCount: effectiveRoleStarCount,
      roleIcon: effectiveRoleIcon,
      frame: trimmedFrame || undefined,
      icon: trimmedIcon || undefined,
      flashNick: trimmedFlashNick || undefined,
      joinEffect: effectiveJoinEffect,
      isHandRaised: false,
      isCameraOn: false,
      entryType,
    };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeave(
    @MessageBody() payload: LeaveRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomFromPayload = payload?.room ?? payload?.roomId;
    const usernameFromPayload = payload?.username ?? (client as any).username;
    const normalizedRoom = this.normalize(roomFromPayload);
    const normalizedUsername = this.normalize(usernameFromPayload);

    if (!normalizedRoom || !normalizedUsername) {
      return { status: 'error', message: 'room and username are required' };
    }

    const resolvedMember = this.resolveRoomMessageMember(
      normalizedRoom,
      normalizedUsername,
      client,
    );
    const roomMembers = resolvedMember?.roomMembers;
    const member = resolvedMember?.member;

    if (!roomMembers || !member) {
      return { status: 'error', message: 'not_in_room' };
    }

    if (member.userId && member.roomId) {
      await this.closeVisibilitySessions({
        userId: member.userId,
        identityKey: buildIdentity(member.userId, member.agentNickname)
          .identityKey,
        roomId: member.roomId,
        socketId: client.id,
      });
    }

    this.recordRecentRoomLeave(normalizedRoom, member);
    roomMembers.delete(normalizedUsername);
    if (roomMembers.size === 0) {
      this.getRoomsStore().delete(normalizedRoom);
    }

    const clientRooms = this.getSocketRoomsStore().get(client.id);
    if (clientRooms) {
      clientRooms.delete(normalizedRoom);
      if (clientRooms.size === 0) {
        this.getSocketRoomsStore().delete(client.id);
      }
    }

    try {
      await client.leave(normalizedRoom);
    } catch (error) {
      this.logger?.error?.(`Leave room failed: ${error}`);
    }

    this.server.to(normalizedRoom).emit('room:userLeft', {
      room: normalizedRoom,
      username: member.username,
      displayUsername: this.getDisplayUsername(member),
    });

    // Odadaki tüm kullanıcıları gönder
    this.emitRoomUsers(normalizedRoom);
    this.emitTenantActiveUserSnapshot(member.tenantId);

    return { status: 'ok', room: normalizedRoom, username: member.username };
  }

  @SubscribeMessage('statusMode:update')
  async handleStatusModeUpdate(
    @MessageBody() payload: UpdateStatusModePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, statusModeId, statusModeName, joinEffect } =
      payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);
    const parsedStatusModeId = statusModeId ? Number(statusModeId) : undefined;
    const trimmedJoinEffect = joinEffect?.trim();

    if (!normalizedRoom || !normalizedUsername) {
      return { status: 'error', message: 'room and username are required' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'not_in_room' };
    }
    if (statusModeName === 'Çatıda') {
      if ((member.roleStarCount ?? 0) < 1) {
        return {
          status: 'error',
          message: 'insufficient_star_for_roof_mode',
        };
      }

      const senderIsRoot = this.normalize(member.username) === 'root';
      if (!senderIsRoot) {
        const persistedMember = await this.findPersistedUserByUsername(
          member.username,
        );
        if (
          !hasPermissionForUser(persistedMember, PERMISSION_LABELS.ROOF_ACCESS)
        ) {
          return {
            status: 'error',
            message: 'roof_permission_required',
          };
        }
      }
    }

    const previousStatusModeId = member.statusModeId;
    const previousStatusModeName = member.statusModeName;

    if (!member.isGuest) {
      const persistedMember = await this.findPersistedUserByUsername(
        member.username,
      );
      const persistedJoinEffect =
        typeof persistedMember?.joinEffect === 'string' &&
        persistedMember.joinEffect.trim().length > 0
          ? persistedMember.joinEffect.trim()
          : undefined;

      member.joinEffect =
        typeof trimmedJoinEffect === 'string' && trimmedJoinEffect.length > 0
          ? trimmedJoinEffect
          : persistedJoinEffect ?? member.joinEffect;
    } else if (trimmedJoinEffect) {
      member.joinEffect = trimmedJoinEffect;
    }

    member.statusModeId = Number.isFinite(parsedStatusModeId)
      ? parsedStatusModeId
      : undefined;
    member.statusModeName = statusModeName || undefined;
    if (member.statusModeName === 'Çatıda') {
      member.isInVoiceSeat = false;
      member.voiceSeatJoinedAt = undefined;
      member.voiceSeatIndex = undefined;
    }

    roomMembers.set(normalizedUsername, member);
    this.getRoomsStore().set(normalizedRoom, roomMembers);
    this.syncSocketPresenceFromMember(client, member);

    this.server.to(normalizedRoom).emit('room:userStatusModeChanged', {
      room: normalizedRoom,
      socketId: member.socketId,
      username: member.username,
      displayUsername: this.getDisplayUsername(member),
      previousStatusModeId,
      previousStatusModeName,
      statusModeId: member.statusModeId,
      statusModeName: member.statusModeName,
      joinEffect: member.joinEffect,
    });
    this.server.emit('tenant:userStateUpdate', {
      tenantId: member.tenantId || 'tenant_master',
      socketId: member.socketId,
      username: member.username,
      statusModeId: member.statusModeId ?? null,
      statusModeName: member.statusModeName ?? null,
      joinEffect: member.joinEffect ?? null,
      isInVoiceChat: member.isInVoiceChat ?? false,
      isMuted: member.isMuted ?? false,
      isHandRaised: member.isHandRaised ?? false,
      isCameraOn: member.isCameraOn ?? false,
      handRaisedAt: member.handRaisedAt ?? null,
    });

    this.logJoinEffectDebug('statusMode:update:applied', {
      room: normalizedRoom,
      username: member.username,
      tenantId: member.tenantId || 'tenant_master',
      previousStatusModeName: previousStatusModeName ?? null,
      nextStatusModeName: member.statusModeName ?? null,
      requestedJoinEffect: trimmedJoinEffect || null,
      effectiveJoinEffect: member.joinEffect ?? null,
      willEmitRoofExitEffect:
        previousStatusModeName === 'Çatıda' &&
        member.statusModeName !== 'Çatıda' &&
        Boolean(member.joinEffect),
    });

    if (
      previousStatusModeName === 'Çatıda' &&
      member.statusModeName !== 'Çatıda'
    ) {
      if (member.joinEffect) {
        this.emitRoofExitJoinEffect(normalizedRoom, member);
      }

      const displayUsername = this.getDisplayUsername(member);
      const welcomeMessage = await this.handleAiWelcome({
        room: normalizedRoom,
        username: member.username,
        displayUsername,
        welcomeSessionKeys: this.buildAiWelcomeSessionKeys({
          tenantId: member.tenantId || 'tenant_master',
          loginHistoryId: member.loginHistoryId,
          socketId: member.socketId,
          username: member.username,
        }),
      });
      if (welcomeMessage?.manualPromptEnabled) {
        this.server.to(normalizedRoom).emit('room:welcomePromptRequested', {
          room: normalizedRoom,
          socketId: member.socketId,
          username: member.username,
          displayUsername,
          agentNickname: member.agentNickname,
          roleStarCount: member.roleStarCount ?? 0,
          statusModeName: member.statusModeName,
          entryType: 'site',
        });
      }
    }

    this.emitRoomUsers(normalizedRoom);
    this.emitTenantActiveUserSnapshot(member.tenantId);

    return {
      status: 'ok',
      room: normalizedRoom,
      username: member.username,
      previousStatusModeId,
      previousStatusModeName,
      statusModeId: member.statusModeId,
      statusModeName: member.statusModeName,
      joinEffect: member.joinEffect ?? null,
    };
  }

  async syncUserStatusModeFromPersistence(params: {
    userId?: number;
    username?: string | null;
    statusModeId?: number | null;
    statusModeName?: string | null;
    joinEffect?: string | null;
  }): Promise<void> {
    const member = this.findActiveRoomMember({
      userId: params.userId,
      username: params.username ?? undefined,
    });

    if (!member) return;

    const normalizedUsername = this.normalize(member.username);
    if (!normalizedUsername) return;

    let normalizedRoom: string | null = null;
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      const roomMember = this.findRoomMemberEntry(members, normalizedUsername);
      if (roomMember?.member?.socketId === member.socketId) {
        normalizedRoom = roomKey;
        break;
      }
    }
    if (!normalizedRoom) return;

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const liveMember = roomMembers?.get(normalizedUsername);
    if (!roomMembers || !liveMember) return;

    const previousStatusModeId = liveMember.statusModeId;
    const previousStatusModeName = liveMember.statusModeName;

    liveMember.statusModeId = Number.isFinite(Number(params.statusModeId))
      ? Number(params.statusModeId)
      : undefined;
    liveMember.statusModeName = params.statusModeName || undefined;
    if (liveMember.statusModeName === 'Çatıda') {
      liveMember.isInVoiceSeat = false;
      liveMember.voiceSeatJoinedAt = undefined;
      liveMember.voiceSeatIndex = undefined;
    }
    liveMember.joinEffect =
      typeof params.joinEffect === 'string' && params.joinEffect.trim().length > 0
        ? params.joinEffect.trim()
        : liveMember.joinEffect;

    roomMembers.set(normalizedUsername, liveMember);
    this.getRoomsStore().set(normalizedRoom, roomMembers);
    this.syncSocketPresenceFromMember(liveMember.socketId, liveMember);

    this.server.to(normalizedRoom).emit('room:userStatusModeChanged', {
      room: normalizedRoom,
      socketId: liveMember.socketId,
      username: liveMember.username,
      displayUsername: this.getDisplayUsername(liveMember),
      previousStatusModeId,
      previousStatusModeName,
      statusModeId: liveMember.statusModeId,
      statusModeName: liveMember.statusModeName,
      joinEffect: liveMember.joinEffect,
    });

    this.server.emit('tenant:userStateUpdate', {
      tenantId: liveMember.tenantId || 'tenant_master',
      socketId: liveMember.socketId,
      username: liveMember.username,
      statusModeId: liveMember.statusModeId ?? null,
      statusModeName: liveMember.statusModeName ?? null,
      joinEffect: liveMember.joinEffect ?? null,
      isInVoiceChat: liveMember.isInVoiceChat ?? false,
      isMuted: liveMember.isMuted ?? false,
      isHandRaised: liveMember.isHandRaised ?? false,
      isCameraOn: liveMember.isCameraOn ?? false,
      handRaisedAt: liveMember.handRaisedAt ?? null,
    });

    if (
      previousStatusModeName === 'Çatıda' &&
      liveMember.statusModeName !== 'Çatıda' &&
      liveMember.joinEffect
    ) {
      // We skip emitRoofExitJoinEffect here because it is typically already handled
      // by the handleStatusModeUpdate socket handler when triggered from the UI.
    }

    this.emitRoomUsers(normalizedRoom);
    this.emitTenantActiveUserSnapshot(liveMember.tenantId);
  }

  @SubscribeMessage('chatPreferences:update')
  handleChatPreferencesUpdate(
    @MessageBody() payload: UpdateChatPreferencesPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { username, rejectIncomingCalls, rejectRoomInvites } = payload ?? {};
    const normalizedUsername = this.normalize(username);

    if (!normalizedUsername) {
      return { status: 'error', message: 'username is required' };
    }

    const clientRooms = this.getSocketRoomsStore().get(client.id);
    const targetRooms = Array.from(clientRooms || []);

    targetRooms.forEach((roomKey) => {
      const roomMembers = this.getRoomsStore().get(roomKey);
      const member = roomMembers?.get(normalizedUsername);

      if (!roomMembers || !member || member.socketId !== client.id) return;

      if (typeof rejectIncomingCalls === 'boolean') {
        member.rejectIncomingCalls = rejectIncomingCalls;
      }
      if (typeof rejectRoomInvites === 'boolean') {
        member.rejectRoomInvites = rejectRoomInvites;
      }
      roomMembers.set(normalizedUsername, member);
      this.getRoomsStore().set(roomKey, roomMembers);
    });

    return {
      status: 'ok',
      username: normalizedUsername,
      rejectIncomingCalls:
        typeof rejectIncomingCalls === 'boolean'
          ? rejectIncomingCalls
          : undefined,
      rejectRoomInvites:
        typeof rejectRoomInvites === 'boolean' ? rejectRoomInvites : undefined,
    };
  }

  @SubscribeMessage('frame:update')
  handleFrameUpdate(
    @MessageBody() payload: UpdateFramePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, frame } = payload ?? {};
    const normalizedUsername = this.normalize(username);
    const trimmedFrame = frame?.trim();

    if (!normalizedUsername) {
      return { status: 'error', message: 'username is required' };
    }

    if (this.getSocketPresenceState(client).isGuest === true) {
      return {
        status: 'error',
        message: 'Çerçeve seçmek için üye girişi yapmalısınız',
      };
    }

    // Kullanıcının bulunduğu tüm odaları bul
    const clientRooms = this.getSocketRoomsStore().get(client.id);
    const targetRoomList: Array<string | null> =
      room && room !== 'global'
        ? [this.normalize(room)]
        : Array.from(clientRooms || []).map((r) => this.normalize(r) ?? r);

    if (targetRoomList.length === 0) {
      this.logger?.warn?.(
        `User ${normalizedUsername} tried to update frame but is not in any room`,
      );
      // Global broadcast (isteğe bağlı, gerekirse)
      return { status: 'ok', globalOnly: true };
    }

    // Her oda için güncelleme yap
    targetRoomList.forEach((normalizedRoom) => {
      if (!normalizedRoom) return;
      const roomMembers = this.getRoomsStore().get(normalizedRoom);
      const member = roomMembers?.get(normalizedUsername);

      if (roomMembers && member && member.socketId === client.id) {
        if (member.isGuest === true) return;

        // State güncelleme
        member.frame = trimmedFrame || undefined;
        this.syncSocketPresenceFromMember(client, member);

        roomMembers.set(normalizedUsername, member);
        this.getRoomsStore().set(normalizedRoom, roomMembers);

        // Odaya özel broadcast
        this.server.to(normalizedRoom).emit('room:userFrameChanged', {
          room: normalizedRoom,
          username: member.username,
          frame: member.frame,
        });

        // Oda listesini de güncelle
        this.emitRoomUsers(normalizedRoom);
      }
    });

    return {
      status: 'ok',
      username: normalizedUsername,
      frame: trimmedFrame,
    };
  }

  @SubscribeMessage('icon:update')
  handleIconUpdate(
    @MessageBody() payload: UpdateIconPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, icon } = payload ?? {};
    const normalizedUsername = this.normalize(username);
    const trimmedIcon = icon?.trim();

    if (!normalizedUsername) {
      return { status: 'error', message: 'username is required' };
    }

    if (this.getSocketPresenceState(client).isGuest === true) {
      return {
        status: 'error',
        message: 'İkon seçmek için üye girişi yapmalısınız',
      };
    }

    // Kullanıcının bulunduğu tüm odaları bul
    const clientRooms = this.getSocketRoomsStore().get(client.id);
    const targetRoomList: Array<string | null> =
      room && room !== 'global'
        ? [this.normalize(room)]
        : Array.from(clientRooms || []).map((r) => this.normalize(r) ?? r);

    if (targetRoomList.length === 0) {
      this.logger?.warn?.(
        `User ${normalizedUsername} tried to update icon but is not in any room`,
      );
      // Yine de global broadcast yapalım
      this.server.emit('tenant:userIconChanged', {
        username: normalizedUsername,
        icon: trimmedIcon || undefined,
      });
      return { status: 'ok', globalOnly: true };
    }

    // Her oda için güncelleme yap
    targetRoomList.forEach((normalizedRoom) => {
      if (!normalizedRoom) return;
      const roomMembers = this.getRoomsStore().get(normalizedRoom);
      const member = roomMembers?.get(normalizedUsername);

      if (roomMembers && member && member.socketId === client.id) {
        if (member.isGuest === true) return;

        // State güncelleme
        member.icon = trimmedIcon || undefined;
        this.syncSocketPresenceFromMember(client, member);

        roomMembers.set(normalizedUsername, member);
        this.getRoomsStore().set(normalizedRoom, roomMembers);

        // Odaya özel broadcast (Eski event ismiyle uyumlu)
        this.server.to(normalizedRoom).emit('room:userIconChanged', {
          room: normalizedRoom,
          username: member.username,
          icon: member.icon,
        });

        // Oda listesini de güncelle
        this.emitRoomUsers(normalizedRoom);
      }
    });

    // Herkese (tenant geneli) broadcast
    this.server.emit('tenant:userIconChanged', {
      username: normalizedUsername,
      icon: trimmedIcon || undefined,
    });

    return {
      status: 'ok',
      username: normalizedUsername,
      icon: trimmedIcon,
    };
  }

  @SubscribeMessage('flashNick:update')
  async handleFlashNickUpdate(
    @MessageBody() payload: UpdateFlashNickPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, flashNick } = payload ?? {};
    const normalizedUsername = this.normalize(username);
    const trimmedFlashNick = flashNick?.trim();

    if (!normalizedUsername) {
      return { status: 'error', message: 'username is required' };
    }

    const hasFlashNickPermission = await this.hasPermissionByUsername(
      normalizedUsername,
      PERMISSION_LABELS.FLASH_NICK_UPLOAD,
    );
    if (!hasFlashNickPermission) {
      return { status: 'error', message: 'flash_nick_permission_required' };
    }

    const clientRooms = this.getSocketRoomsStore().get(client.id);
    const targetRoomList: Array<string | null> =
      room && room !== 'global'
        ? [this.normalize(room)]
        : Array.from(clientRooms || []).map((r) => this.normalize(r) ?? r);
    const tenantIdsToRefresh = new Set<string>();

    this.logger?.log?.(
      `[FLASH_NICK] update requested username=${normalizedUsername} room=${room || 'global'} socket=${client.id} targetRooms=${targetRoomList.filter(Boolean).join(',') || 'none'}`,
    );

    if (targetRoomList.length === 0) {
      // Veritabanını da güncelle (race condition önlemek için)
      await this.userRepository.update(
        { username: normalizedUsername },
        { flashNick: trimmedFlashNick || null },
      );

      this.updateSocketPresenceState(client, {
        flashNick: trimmedFlashNick || null,
      });

      this.server.emit('tenant:userFlashNickChanged', {
        username: normalizedUsername,
        flashNick: trimmedFlashNick || null,
      });
      this.logger?.log?.(
        `[FLASH_NICK] global-only broadcast username=${normalizedUsername} value=${trimmedFlashNick ? 'set' : 'cleared'}`,
      );
      this.emitTenantActiveUserSnapshot('tenant_master');
      return { status: 'ok', globalOnly: true };
    }

    // Veritabanını güncelle
    await this.userRepository.update(
      { username: normalizedUsername },
      { flashNick: trimmedFlashNick || null },
    );

    // Tüm odalarda kullanıcıyı bul ve güncelle (stale data önlemek için)
    for (const [normalizedRoom, roomMembers] of this.getRoomsStore().entries()) {
      const member = roomMembers.get(normalizedUsername);
      if (member) {
        member.flashNick = trimmedFlashNick ? trimmedFlashNick : null;
        this.syncSocketPresenceFromMember(member.socketId, member);
        if (member.tenantId) {
          tenantIdsToRefresh.add(member.tenantId);
        }
        roomMembers.set(normalizedUsername, member);
        this.getRoomsStore().set(normalizedRoom, roomMembers);

        this.server.to(normalizedRoom).emit('room:userFlashNickChanged', {
          room: normalizedRoom,
          username: member.username,
          flashNick: member.flashNick,
        });
        this.logger?.log?.(
          `[FLASH_NICK] room broadcast room=${normalizedRoom} username=${member.username} tenant=${member.tenantId || 'tenant_master'} value=${member.flashNick ? 'set' : 'cleared'}`,
        );

        this.emitRoomUsers(normalizedRoom);
      }
    }

    this.server.emit('tenant:userFlashNickChanged', {
      username: normalizedUsername,
      flashNick: trimmedFlashNick || null,
    });
    this.logger?.log?.(
      `[FLASH_NICK] tenant broadcast username=${normalizedUsername} tenants=${Array.from(tenantIdsToRefresh).join(',') || 'tenant_master'} value=${trimmedFlashNick ? 'set' : 'cleared'}`,
    );
    tenantIdsToRefresh.forEach((tenantId) =>
      this.emitTenantActiveUserSnapshot(tenantId),
    );

    return {
      status: 'ok',
      username: normalizedUsername,
      flashNick: trimmedFlashNick || null,
    };
  }

  @SubscribeMessage('joinEffect:update')
  async handleJoinEffectUpdate(
    @MessageBody() payload: UpdateJoinEffectPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, joinEffect } = payload ?? {};
    const normalizedUsername = this.normalize(username);
    const trimmedJoinEffect = joinEffect?.trim();

    if (!normalizedUsername) {
      return { status: 'error', message: 'username is required' };
    }

    if (normalizedUsername !== 'root') {
      const persistedUser = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('LOWER(user.username) = :username', {
          username: normalizedUsername,
        })
        .getOne();

      const hasJoinEffectPermission = hasPermissionForUser(
        persistedUser,
        PERMISSION_LABELS.JOIN_EFFECT_SELECT,
      );
      if (!hasJoinEffectPermission) {
        return { status: 'error', message: 'join_effect_permission_required' };
      }
    }

    const clientRooms = this.getSocketRoomsStore().get(client.id);
    const targetRoomList: Array<string | null> =
      room && room !== 'global'
        ? [this.normalize(room)]
        : Array.from(clientRooms || []).map((r) => this.normalize(r) ?? r);

    if (targetRoomList.length === 0) {
      return { status: 'ok', globalOnly: true };
    }

    targetRoomList.forEach((normalizedRoom) => {
      if (!normalizedRoom) return;
      const roomMembers = this.getRoomsStore().get(normalizedRoom);
      const member = roomMembers?.get(normalizedUsername);

      if (roomMembers && member && member.socketId === client.id) {
        member.joinEffect = trimmedJoinEffect || undefined;
        roomMembers.set(normalizedUsername, member);
        this.getRoomsStore().set(normalizedRoom, roomMembers);
        this.emitRoomUsers(normalizedRoom);
      }
    });

    return {
      status: 'ok',
      username: normalizedUsername,
      joinEffect: trimmedJoinEffect || null,
    };
  }

  @SubscribeMessage('joinEffect:trigger')
  async handleJoinEffectTrigger(
    @MessageBody() payload: TriggerJoinEffectPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedUsername = this.normalize(payload?.username);
    const normalizedRoom = this.normalize(payload?.room);
    const trimmedRequestedJoinEffect = payload?.joinEffect?.trim();

    if (!normalizedUsername || !normalizedRoom) {
      return { status: 'error', message: 'room and username are required' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'not_in_room' };
    }

    if (!member.isGuest) {
      const persistedMember = await this.findPersistedUserByUsername(
        member.username,
      );
      member.joinEffect =
        typeof trimmedRequestedJoinEffect === 'string' &&
        trimmedRequestedJoinEffect.length > 0
          ? trimmedRequestedJoinEffect
          : typeof persistedMember?.joinEffect === 'string' &&
              persistedMember.joinEffect.trim()
            ? persistedMember.joinEffect.trim()
            : undefined;
    } else if (trimmedRequestedJoinEffect) {
      member.joinEffect = trimmedRequestedJoinEffect;
    }

    if (!member.joinEffect) {
      this.logJoinEffectDebug('joinEffect:trigger:skipped', {
        room: normalizedRoom,
        username: member.username,
        tenantId: member.tenantId || 'tenant_master',
        requestedJoinEffect: trimmedRequestedJoinEffect || null,
        effectiveJoinEffect: member.joinEffect ?? null,
        statusModeName: member.statusModeName ?? null,
        reason: 'missing_effect',
      });
      return { status: 'ok', skipped: true };
    }

    roomMembers.set(normalizedUsername, member);
    this.getRoomsStore().set(normalizedRoom, roomMembers);

    this.logJoinEffectDebug('joinEffect:trigger:emitting', {
      room: normalizedRoom,
      username: member.username,
      tenantId: member.tenantId || 'tenant_master',
      requestedJoinEffect: trimmedRequestedJoinEffect || null,
      effectiveJoinEffect: member.joinEffect,
      statusModeName: member.statusModeName ?? null,
      socketId: member.socketId,
    });

    this.server.to(normalizedRoom).emit('room:userJoinEffectTriggered', {
      room: normalizedRoom,
      socketId: member.socketId,
      username: member.username,
      loginHistoryId: member.loginHistoryId ?? null,
      gender: member.gender,
      isGuest: member.isGuest,
      statusModeId: member.statusModeId ?? null,
      statusModeName: member.statusModeName ?? null,
      icon: member.icon ?? null,
      roleIcon: member.roleIcon ?? null,
      roleStarColor: member.roleStarColor ?? null,
      roleStarCount: member.roleStarCount ?? null,
      agentNickname: member.agentNickname ?? null,
      entryType: 'room',
      joinEffect: member.joinEffect,
    });

    return {
      status: 'ok',
      username: member.username,
      joinEffect: member.joinEffect,
    };
  }

  @SubscribeMessage('hand:update')
  handleHandUpdate(
    @MessageBody() payload: UpdateHandPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, isRaised } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);

    if (
      !normalizedRoom ||
      !normalizedUsername ||
      typeof isRaised !== 'boolean'
    ) {
      return {
        status: 'error',
        message: 'room, username and isRaised are required',
      };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'not_in_room' };
    }

    member.isHandRaised = isRaised;
    member.handRaisedAt = isRaised ? Date.now() : undefined;

    roomMembers.set(normalizedUsername, member);
    this.getRoomsStore().set(normalizedRoom, roomMembers);
    this.syncSocketPresenceFromMember(client, member);

    this.server.to(normalizedRoom).emit('room:userHandChanged', {
      room: normalizedRoom,
      username: member.username,
      isRaised,
    });

    this.emitRoomUsers(normalizedRoom);

    return {
      status: 'ok',
      room: normalizedRoom,
      username: member.username,
      isRaised,
    };
  }

  @SubscribeMessage('camera:toggle')
  handleCameraToggle(
    @MessageBody() payload: UpdateCameraPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, isCameraOn } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);

    if (
      !normalizedRoom ||
      !normalizedUsername ||
      typeof isCameraOn !== 'boolean'
    ) {
      return {
        status: 'error',
        message: 'room, username and isCameraOn are required',
      };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'not_in_room' };
    }

    if (isCameraOn && member.cameraBanned) {
      client.emit('camera:error', { message: 'camera_banned' });
      return { status: 'error', message: 'camera_banned' };
    }

    member.isCameraOn = isCameraOn;

    roomMembers.set(normalizedUsername, member);
    this.getRoomsStore().set(normalizedRoom, roomMembers);
    this.syncSocketPresenceFromMember(client, member);

    this.server.to(normalizedRoom).emit('room:userCameraChanged', {
      room: normalizedRoom,
      username: member.username,
      isCameraOn,
    });

    this.emitRoomUsers(normalizedRoom);
    this.server.emit('tenant:userStateUpdate', {
      tenantId: member.tenantId || 'tenant_master',
      username: member.username,
      isInVoiceChat: member.isInVoiceChat ?? false,
      isMuted: member.isMuted ?? false,
      isHandRaised: member.isHandRaised ?? false,
      isCameraOn: member.isCameraOn ?? false,
      handRaisedAt: member.handRaisedAt ?? null,
    });

    return {
      status: 'ok',
      room: normalizedRoom,
      username: member.username,
      isCameraOn,
    };
  }

  @SubscribeMessage('tenant:roleUpdate')
  handleTenantRoleUpdate(
    @MessageBody()
    payload: {
      id: number;
      name: string;
      previousName?: string;
      starColor?: string | null;
      starCount?: number | null;
      icon?: string | null;
    },
  ) {
    this.updateRoleInAllUsers(payload);
  }

  @SubscribeMessage('style:update')
  @SubscribeMessage('userStyleUpdate')
  async handleTenantStyleUpdate(
    @MessageBody() payload: StyleUpdatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, fontName, granite, nickColor, userGif, flashNick } =
      payload ?? {};
    const normalizedUsername = this.normalize(username);
    const normalizedFontName =
      fontName !== undefined ? fontName?.trim() || null : undefined;
    const normalizedGranite =
      granite !== undefined ? granite?.trim() || null : undefined;
    const normalizedNickColor =
      nickColor !== undefined ? nickColor?.trim() || null : undefined;
    const normalizedUserGif =
      userGif !== undefined ? userGif?.trim() || null : undefined;
    const normalizedFlashNick =
      flashNick !== undefined ? flashNick?.trim() || null : undefined;

    if (!normalizedUsername) {
      return { status: 'error', message: 'username is required' };
    }

    // Veritabanını güncel tut (race condition & teleport sorunlarını çözmek için en garantisi bu)
    const updatePayload: Partial<User> = {};
    if (normalizedFontName !== undefined) {
      updatePayload.fontName = normalizedFontName;
    }
    if (normalizedGranite !== undefined) {
      updatePayload.granite = normalizedGranite;
    }
    if (normalizedNickColor !== undefined) {
      updatePayload.nickColor = normalizedNickColor;
    }
    if (normalizedUserGif !== undefined) {
      updatePayload.userGif = normalizedUserGif;
    }
    if (normalizedFlashNick !== undefined) {
      updatePayload.flashNick = normalizedFlashNick;
    }

    if (Object.keys(updatePayload).length > 0) {
      const userRepository = this.getUserRepository();
      if (!userRepository) {
        this.logWarn(
          `Style DB update skipped because userRepository is not available (username: ${normalizedUsername})`,
        );
      } else {
        await userRepository
          .update({ username: normalizedUsername }, updatePayload)
          .catch((err) =>
            this.logError(`DB Update Error (Style): ${err.message}`),
          );
      }
    }

    // Kullanıcının bulunduğu tüm odaları bul
    const clientRooms = this.getSocketRoomsStore().get(client.id);
    const targetRoomList: Array<string | null> =
      room && room !== 'global'
        ? [this.normalize(room)]
        : Array.from(clientRooms || []).map((r) => this.normalize(r) ?? r);

    if (targetRoomList.length === 0) {
      this.logger?.warn?.(
        `User ${normalizedUsername} tried to update style but is not in any room`,
      );
      this.updateSocketPresenceState(client, {
        ...(normalizedFontName !== undefined && { fontName: normalizedFontName ?? undefined }),
        ...(normalizedGranite !== undefined && { granite: normalizedGranite ?? undefined }),
        ...(normalizedNickColor !== undefined && { nickColor: normalizedNickColor ?? undefined }),
        ...(normalizedUserGif !== undefined && { userGif: normalizedUserGif ?? undefined }),
        ...(normalizedFlashNick !== undefined && { flashNick: normalizedFlashNick }),
      });
      // Yine de global broadcast yapalım ki sidebar güncellensin
      this.server.emit('tenant:userStyleUpdate', {
        username: normalizedUsername,
        ...(normalizedFontName !== undefined && { fontName: normalizedFontName }),
        ...(normalizedGranite !== undefined && { granite: normalizedGranite }),
        ...(normalizedNickColor !== undefined && { nickColor: normalizedNickColor }),
        ...(normalizedUserGif !== undefined && { userGif: normalizedUserGif }),
        ...(normalizedFlashNick !== undefined && { flashNick: normalizedFlashNick }),
      });
      return { status: 'ok', globalOnly: true };
    }

    // Tüm odalarda kullanıcıyı bul ve güncelle (stale data önlemek için)
    for (const [normalizedRoom, roomMembers] of this.getRoomsStore().entries()) {
      const member = roomMembers.get(normalizedUsername);
      if (member) {
        // State güncelleme
        if (normalizedFontName !== undefined) {
          member.fontName = normalizedFontName ?? undefined;
        }
        if (normalizedGranite !== undefined) {
          member.granite = normalizedGranite ?? undefined;
        }
        if (normalizedNickColor !== undefined) {
          member.nickColor = normalizedNickColor ?? undefined;
        }
        if (normalizedUserGif !== undefined) {
          member.userGif = normalizedUserGif ?? undefined;
        }
        if (normalizedFlashNick !== undefined) {
          member.flashNick = normalizedFlashNick;
        }
        this.syncSocketPresenceFromMember(member.socketId, member);

        roomMembers.set(normalizedUsername, member);
        this.getRoomsStore().set(normalizedRoom, roomMembers);

        // Odaya özel broadcast
        const updatePayload = {
          room: normalizedRoom,
          username: member.username,
          fontName: member.fontName,
          granite: member.granite,
          nickColor: member.nickColor,
          userGif: member.userGif,
          flashNick: member.flashNick,
        };
        this.server.to(normalizedRoom).emit('userStyleUpdate', updatePayload);

        // Oda listesini de güncelle
        this.emitRoomUsers(normalizedRoom);
      }
    }

    // Herkese (tenant geneli) broadcast
    this.server.emit('tenant:userStyleUpdate', {
      username: normalizedUsername,
      ...(normalizedFontName !== undefined && { fontName: normalizedFontName }),
      ...(normalizedGranite !== undefined && { granite: normalizedGranite }),
      ...(normalizedNickColor !== undefined && { nickColor: normalizedNickColor }),
      ...(normalizedUserGif !== undefined && { userGif: normalizedUserGif }),
      ...(normalizedFlashNick !== undefined && { flashNick: normalizedFlashNick }),
    });

    return {
      status: 'ok',
      username: normalizedUsername,
      fontName: normalizedFontName,
      granite: normalizedGranite,
      nickColor: normalizedNickColor,
      userGif: normalizedUserGif,
      flashNick: normalizedFlashNick,
    };
  }

  @SubscribeMessage('room:teleport')
  async handleTeleport(
    @MessageBody() payload: { targetUsername: string; roomName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { targetUsername, roomName } = payload || {};
    const normalizedTargetUsername = this.normalize(targetUsername);

    if (!normalizedTargetUsername || !roomName) {
      return {
        status: 'error',
        message: 'targetUsername and roomName required',
      };
    }

    // Find sender to check permissions
    let senderInfo: any = null;
    for (const members of this.getRoomsStore().values()) {
      for (const info of members.values()) {
        if (info.socketId === client.id) {
          senderInfo = info;
          break;
        }
      }
      if (senderInfo) break;
    }

    if (!senderInfo) {
      return { status: 'error', message: 'sender_not_found' };
    }

    const senderUsername = senderInfo.username || (client as any).username || '';
    const senderIsRoot = senderUsername.toLowerCase() === 'root';
    const senderTenantId = senderInfo.tenantId || 'tenant_master';

    if (!senderIsRoot) {
      const hasTeleportPermission = await this.hasPermissionByUsername(
        senderUsername,
        PERMISSION_LABELS.ROOM_TELEPORT,
      );
      if (!hasTeleportPermission) {
        return { status: 'error', message: 'missing_permission' };
      }
    }

    if (this.normalize(senderUsername) === normalizedTargetUsername) {
      return { status: 'error', message: 'self_target' };
    }

    // Find target user only inside the sender tenant.
    let targetInfo: any = null;
    let targetSocketId: string | null = null;
    let targetCurrentRoomKey: string | null = null;

    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      for (const [usernameKey, info] of members.entries()) {
        if (usernameKey !== normalizedTargetUsername) continue;
        if ((info.tenantId || 'tenant_master') !== senderTenantId) continue;
        if (!this.server?.sockets?.sockets?.has(info.socketId)) continue;
        targetInfo = info;
        targetSocketId = info.socketId;
        targetCurrentRoomKey = roomKey;
        break;
      }
      if (targetInfo) break;
    }

    if (!targetInfo || !targetSocketId) {
      return { status: 'error', message: 'target_not_found' };
    }

    // Star check: Sender must have MORE stars than target, unless sender is ROOT
    const senderStars = senderInfo.roleStarCount || 0;
    const targetStars = targetInfo.roleStarCount || 0;

    if (
      senderStars <= targetStars &&
      !senderIsRoot
    ) {
      return { status: 'error', message: 'insufficient_privileges' };
    }

    if (this.normalize(targetCurrentRoomKey ?? undefined) === this.normalize(roomName)) {
      return { status: 'error', message: 'same_room' };
    }

    const persistedUser = await this.findPersistedUserByUsername(
      targetInfo.username,
    );
    if (
      isProtectedActionBlocked({
        actorStarCount: senderStars,
        isRoot: senderIsRoot,
        targetProtection: persistedUser?.protection,
        targetProtectedByStarCount: persistedUser?.protectedByStarCount,
      })
    ) {
      return { status: 'error', message: 'target_is_protected' };
    }

    // Broadcast transition message to the room they are leaving
    if (targetCurrentRoomKey) {
      const targetDisplayName = this.getDisplayUsername(targetInfo);
      this.logger?.log?.(
        `📡 Teleport transition: ${targetDisplayName} leaving ${targetCurrentRoomKey} for ${roomName}`,
      );
      const msg = {
        room: targetCurrentRoomKey,
        username: targetInfo.username,
        displayUsername: targetDisplayName,
        message: `__TELEPORT__:${targetDisplayName}:${roomName}`,
        timestamp: new Date().toISOString(),
        isSystemMessage: true,
      };

      // Filtered broadcast: only show to users with >= senderStars
      const connectedSockets = await this.server
        .in(targetCurrentRoomKey)
        .fetchSockets();

      for (const s of connectedSockets) {
        const userStarCount = (s as any).roleStarCount || 0;
        const socketUsername = (s as any).username?.toLowerCase();
        if (userStarCount >= senderStars || socketUsername === 'root') {
          s.emit('room:message', msg);
        }
      }
    }

    // Emit teleport event to the target user
    this.server.to(targetSocketId).emit('room:teleport', {
      toRoom: roomName,
      roomName,
      source: 'teleport',
      byWhom: this.getDisplayUsername(senderInfo),
    });

    this.logger?.log?.(
      `User ${targetInfo.username} teleported to ${roomName} by ${senderInfo.username}`,
    );

    return { status: 'ok', roomName, targetUsername: targetInfo.username };
  }

  @SubscribeMessage('moderation:userInfo:request')
  async handleModerationUserInfoRequest(
    @MessageBody() payload: ModerationUserInfoRequestPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedTarget = this.normalize(payload?.targetUsername);
    if (!normalizedTarget) {
      return { status: 'error', code: 'invalid_payload' };
    }

    let senderInfo: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      for (const info of members.values()) {
        if (info.socketId === client.id) {
          senderInfo = info;
          break;
        }
      }
      if (senderInfo) break;
    }

    if (!senderInfo) {
      return { status: 'error', code: 'sender_not_found' };
    }

    const senderUsername = senderInfo.username || (client as any).username;
    const senderIsRoot = senderUsername?.toLowerCase() === 'root';
    const senderStars = senderInfo.roleStarCount || 0;
    if (senderStars < 1 && !senderIsRoot) {
      return { status: 'error', code: 'insufficient_privileges' };
    }

    let canViewIp = senderIsRoot;
    if (!senderIsRoot) {
      const persistedSender =
        await this.findPersistedUserByUsername(senderUsername);
      canViewIp = hasPermissionForUser(
        persistedSender,
        PERMISSION_LABELS.IP_VIEW,
      );
    }

    if (this.normalize(senderUsername) === normalizedTarget) {
      return { status: 'error', code: 'self_target' };
    }

    const senderTenantId = senderInfo.tenantId || 'tenant_master';
    let targetMember: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      const candidate = members.get(normalizedTarget);
      if (!candidate) continue;
      if ((candidate.tenantId || 'tenant_master') !== senderTenantId) continue;
      if (!this.server?.sockets?.sockets?.has(candidate.socketId)) continue;
      targetMember = candidate;
      break;
    }

    if (!targetMember) {
      return { status: 'error', code: 'target_not_found' };
    }

    const targetStars = targetMember.roleStarCount || 0;
    if (!senderIsRoot && senderStars <= targetStars) {
      return { status: 'error', code: 'insufficient_rank' };
    }

    if (
      canViewIp &&
      (!targetMember.ipAddress || !targetMember.ipAddress.trim())
    ) {
      return { status: 'error', code: 'ip_not_available' };
    }

    return {
      status: 'ok',
      data: {
        username: this.getDisplayUsername(targetMember),
        roleName:
          targetMember.roleName || (targetMember.isGuest ? 'Misafir' : 'Üye'),
        roleStarCount: targetMember.roleStarCount || 0,
        statusModeName: targetMember.statusModeName || null,
        ipAddress: canViewIp ? targetMember.ipAddress : 'Gizli',
      },
    };
  }

  @SubscribeMessage('moderation:tempOperator:grant')
  async handleModerationTempOperatorGrant(
    @MessageBody() payload: ModerationTempOperatorGrantPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedTarget = this.normalize(payload?.targetUsername);
    if (!normalizedTarget) {
      return { status: 'error', code: 'invalid_payload' };
    }

    let senderInfo: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      for (const info of members.values()) {
        if (info.socketId === client.id) {
          senderInfo = info;
          break;
        }
      }
      if (senderInfo) break;
    }

    if (!senderInfo) {
      return { status: 'error', code: 'sender_not_found' };
    }

    const senderUsername = senderInfo.username || (client as any).username;
    const senderIsRoot = senderUsername?.toLowerCase() === 'root';
    if (!senderIsRoot) {
      const persistedSender =
        await this.findPersistedUserByUsername(senderUsername);
      if (
        !hasPermissionForUser(
          persistedSender,
          PERMISSION_LABELS.TEMP_OPERATOR_GRANT,
        )
      ) {
        return { status: 'error', code: 'insufficient_privileges' };
      }
    }

    const senderStars = senderInfo.roleStarCount || 0;
    if (senderStars < 1 && !senderIsRoot) {
      return { status: 'error', code: 'insufficient_privileges' };
    }

    if (this.normalize(senderUsername) === normalizedTarget) {
      return { status: 'error', code: 'self_target' };
    }

    const senderTenantId = senderInfo.tenantId || 'tenant_master';
    let targetMember: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      const candidate = members.get(normalizedTarget);
      if (!candidate) continue;
      if ((candidate.tenantId || 'tenant_master') !== senderTenantId) continue;
      if (!this.server?.sockets?.sockets?.has(candidate.socketId)) continue;
      targetMember = candidate;
      break;
    }

    if (!targetMember) {
      return { status: 'error', code: 'target_not_found' };
    }

    const targetStars = targetMember.roleStarCount || 0;
    if (!senderIsRoot && senderStars <= targetStars) {
      return { status: 'error', code: 'insufficient_rank' };
    }

    if (!(targetMember.isGuest || targetStars <= 0)) {
      return { status: 'error', code: 'not_eligible' };
    }

    this.getTemporaryOperatorsStore().set(normalizedTarget, {
      username: targetMember.username,
      tenantId: senderTenantId,
      socketId: targetMember.socketId,
      createdAt: Date.now(),
    });

    this.emitTemporaryOperatorUpdated(
      senderTenantId,
      targetMember.username,
      true,
    );

    return { status: 'ok' };
  }

  @SubscribeMessage('moderation:tempOperator:revoke')
  async handleModerationTempOperatorRevoke(
    @MessageBody() payload: ModerationTempOperatorRevokePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedTarget = this.normalize(payload?.targetUsername);
    if (!normalizedTarget) {
      return { status: 'error', code: 'invalid_payload' };
    }

    let senderInfo: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      for (const info of members.values()) {
        if (info.socketId === client.id) {
          senderInfo = info;
          break;
        }
      }
      if (senderInfo) break;
    }

    if (!senderInfo) {
      return { status: 'error', code: 'sender_not_found' };
    }

    const senderUsername = senderInfo.username || (client as any).username;
    const senderIsRoot = senderUsername?.toLowerCase() === 'root';
    if (!senderIsRoot) {
      const persistedSender =
        await this.findPersistedUserByUsername(senderUsername);
      if (
        !hasPermissionForUser(
          persistedSender,
          PERMISSION_LABELS.TEMP_OPERATOR_GRANT,
        )
      ) {
        return { status: 'error', code: 'insufficient_privileges' };
      }
    }

    const senderStars = senderInfo.roleStarCount || 0;
    if (senderStars < 1 && !senderIsRoot) {
      return { status: 'error', code: 'insufficient_privileges' };
    }

    if (this.normalize(senderUsername) === normalizedTarget) {
      return { status: 'error', code: 'self_target' };
    }

    const senderTenantId = senderInfo.tenantId || 'tenant_master';
    const tempRecord = this.getTemporaryOperatorsStore().get(normalizedTarget);
    if (
      !tempRecord ||
      (tempRecord.tenantId || 'tenant_master') !== senderTenantId
    ) {
      return { status: 'error', code: 'not_found' };
    }

    let targetMember: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      const candidate = members.get(normalizedTarget);
      if (!candidate) continue;
      if ((candidate.tenantId || 'tenant_master') !== senderTenantId) continue;
      if (!this.server?.sockets?.sockets?.has(candidate.socketId)) continue;
      targetMember = candidate;
      break;
    }

    if (targetMember) {
      const targetStars = targetMember.roleStarCount || 0;
      if (!senderIsRoot && senderStars <= targetStars) {
        return { status: 'error', code: 'insufficient_rank' };
      }
    }

    this.getTemporaryOperatorsStore().delete(normalizedTarget);
    this.emitTemporaryOperatorUpdated(
      senderTenantId,
      tempRecord.username,
      false,
    );

    return { status: 'ok' };
  }

  @SubscribeMessage('moderation:warnUser')
  handleModerationWarnUser(
    @MessageBody() payload: ModerationWarnUserPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedTarget = this.normalize(payload?.targetUsername);
    const warningMessage = String(payload?.message || '').trim();
    if (!normalizedTarget || !warningMessage) {
      return { status: 'error', code: 'invalid_payload' };
    }

    let senderInfo: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      for (const info of members.values()) {
        if (info.socketId === client.id) {
          senderInfo = info;
          break;
        }
      }
      if (senderInfo) break;
    }

    if (!senderInfo) {
      return { status: 'error', code: 'sender_not_found' };
    }

    const senderUsername = senderInfo.username || (client as any).username;
    const senderIsRoot = senderUsername?.toLowerCase() === 'root';
    const senderStars = senderInfo.roleStarCount || 0;
    if (senderStars < 1 && !senderIsRoot) {
      return { status: 'error', code: 'insufficient_privileges' };
    }

    if (this.normalize(senderUsername) === normalizedTarget) {
      return { status: 'error', code: 'self_target' };
    }

    const senderTenantId = senderInfo.tenantId || 'tenant_master';
    let targetMember: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      const candidate = members.get(normalizedTarget);
      if (!candidate) continue;
      if ((candidate.tenantId || 'tenant_master') !== senderTenantId) continue;
      if (!this.server?.sockets?.sockets?.has(candidate.socketId)) continue;
      targetMember = candidate;
      break;
    }

    if (!targetMember) {
      return { status: 'error', code: 'target_not_found' };
    }

    const targetStars = targetMember.roleStarCount || 0;
    if (!senderIsRoot && senderStars <= targetStars) {
      return { status: 'error', code: 'insufficient_rank' };
    }

    this.server.to(targetMember.socketId).emit('moderation:warnReceived', {
      fromUsername: senderUsername || 'Yönetici',
      message: warningMessage,
      createdAt: Date.now(),
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('moderation:guestAlias:release')
  async handleModerationGuestAliasRelease(
    @MessageBody() payload: ModerationGuestAliasReleasePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedRoom = this.resolveRoomKey(payload?.room || '');
    const normalizedTarget = this.normalize(payload?.targetUsername);

    if (!normalizedRoom || !normalizedTarget) {
      return { status: 'error', code: 'invalid_payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    if (!roomMembers) {
      return { status: 'error', code: 'room_not_found' };
    }

    let senderMember: RoomMember | null = null;
    for (const member of roomMembers.values()) {
      if (member.socketId === client.id) {
        senderMember = member;
        break;
      }
    }

    if (!senderMember) {
      return { status: 'error', code: 'sender_not_in_room' };
    }

    const targetMember = roomMembers.get(normalizedTarget);
    if (!targetMember) {
      return { status: 'error', code: 'target_not_found_in_room' };
    }

    if (this.normalize(senderMember.username) === normalizedTarget) {
      return { status: 'error', code: 'self_target' };
    }

    const senderIsRoot =
      senderMember.username?.trim().toLocaleLowerCase('tr-TR') === 'root';
    const senderStars = Number(senderMember.roleStarCount ?? 0);
    if (!senderIsRoot && senderStars < 1) {
      return { status: 'error', code: 'insufficient_privileges' };
    }

    if (targetMember.isGuest !== true) {
      return { status: 'error', code: 'target_not_guest' };
    }

    if (!targetMember.guestAlias || targetMember.guestAliasReleased === true) {
      return { status: 'error', code: 'alias_not_active' };
    }

    targetMember.guestAliasReleased = true;
    this.syncSocketPresenceFromMember(targetMember.socketId, targetMember);
    void this.emitRoomUsers(normalizedRoom);
    void this.emitTenantActiveUserSnapshot(targetMember.tenantId);

    return {
      status: 'ok',
      room: normalizedRoom,
      username: targetMember.username,
      displayUsername: this.getDisplayUsername(targetMember),
      isGuest: true,
      guestAlias: targetMember.guestAlias,
      guestAliasReleased: true,
    };
  }

  @SubscribeMessage('moderation:micInvite')
  async handleModerationMicInvite(
    @MessageBody() payload: ModerationMicInvitePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedTarget = this.normalize(payload?.targetUsername);
    const normalizedRoom = this.normalize(payload?.room);
    const roomName = payload?.roomName?.trim();

    if (!normalizedTarget || !normalizedRoom) {
      return { status: 'error', code: 'invalid_payload' };
    }

    let senderInfo: RoomMember | null = null;
    let senderRoomKey: string | null = null;
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      for (const info of members.values()) {
        if (info.socketId === client.id) {
          senderInfo = info;
          senderRoomKey = roomKey;
          break;
        }
      }
      if (senderInfo) break;
    }

    if (!senderInfo || !senderRoomKey) {
      return { status: 'error', code: 'sender_not_found' };
    }

    const senderUsername = senderInfo.username || (client as any).username;
    const senderIsRoot = senderUsername?.toLowerCase() === 'root';
    const senderStars = senderInfo.roleStarCount || 0;
    if (senderStars < 1 && !senderIsRoot) {
      return { status: 'error', code: 'insufficient_privileges' };
    }
    if (!senderIsRoot) {
      const hasMicInvitePermission = await this.hasPermissionByUsername(
        senderUsername || '',
        PERMISSION_LABELS.MICROPHONE_INVITE,
      );
      if (!hasMicInvitePermission) {
        return { status: 'error', code: 'insufficient_privileges' };
      }
    }

    if (this.normalize(senderUsername) === normalizedTarget) {
      return { status: 'error', code: 'self_target' };
    }

    const senderTenantId = senderInfo.tenantId || 'tenant_master';
    let targetMember: RoomMember | null = null;
    let targetRoomKey: string | null = null;
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      const candidate = members.get(normalizedTarget);
      if (!candidate) continue;
      if ((candidate.tenantId || 'tenant_master') !== senderTenantId) continue;
      if (!this.server?.sockets?.sockets?.has(candidate.socketId)) continue;
      targetMember = candidate;
      targetRoomKey = roomKey;
      break;
    }

    if (!targetMember || !targetRoomKey) {
      return { status: 'error', code: 'target_not_found' };
    }

    const targetStars = targetMember.roleStarCount || 0;
    if (!senderIsRoot && senderStars <= targetStars) {
      return { status: 'error', code: 'insufficient_rank' };
    }

    const persistedUser = await this.findPersistedUserByUsername(
      targetMember.username,
    );
    if (
      isProtectedActionBlocked({
        actorStarCount: senderStars,
        isRoot: senderIsRoot,
        targetProtection: persistedUser?.protection,
        targetProtectedByStarCount: persistedUser?.protectedByStarCount,
      })
    ) {
      return { status: 'error', code: 'target_is_protected' };
    }

    if (targetRoomKey !== senderRoomKey || targetRoomKey !== normalizedRoom) {
      return { status: 'error', code: 'not_same_room' };
    }

    const inviteId = `mic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.getMicInvitesStore().set(inviteId, {
      inviteId,
      inviterSocketId: client.id,
      inviterUsername: senderUsername || 'Yönetici',
      inviterTenantId: senderTenantId,
      targetSocketId: targetMember.socketId,
      targetUsername: targetMember.username,
      room: normalizedRoom,
      roomName,
      createdAt: Date.now(),
    });

    this.server.to(targetMember.socketId).emit('moderation:micInviteReceived', {
      inviteId,
      fromUsername: senderUsername || 'Yönetici',
      room: normalizedRoom,
      roomName: roomName || this.getRoomDisplayName(normalizedRoom),
    });

    this.server.to(client.id).emit('moderation:micInviteResult', {
      status: 'sent',
      inviteId,
      targetUsername: targetMember.username,
    });

    return { status: 'ok', inviteId };
  }

  @SubscribeMessage('moderation:micInviteRespond')
  handleModerationMicInviteRespond(
    @MessageBody() payload: ModerationMicInviteRespondPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const inviteId = payload?.inviteId?.trim();
    const accepted = payload?.accepted === true;
    if (!inviteId) {
      return { status: 'error', code: 'invalid_payload' };
    }

    const invite = this.getMicInvitesStore().get(inviteId);
    if (!invite) {
      return { status: 'error', code: 'invite_not_found' };
    }

    if (invite.targetSocketId !== client.id) {
      return { status: 'error', code: 'not_invited_user' };
    }

    this.getMicInvitesStore().delete(inviteId);
    this.server.to(invite.inviterSocketId).emit('moderation:micInviteResult', {
      status: accepted ? 'accepted' : 'rejected',
      inviteId,
      targetUsername: invite.targetUsername,
    });

    return { status: 'ok', inviteId, accepted };
  }

  @SubscribeMessage('room:invite')
  async handleRoomInvite(
    @MessageBody() payload: RoomInvitePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const targetUsername = payload?.targetUsername?.trim();
    const roomName = payload?.roomName?.trim();
    const normalizedTarget = this.normalize(targetUsername);
    const normalizedRoomName = this.normalize(roomName);

    const emitInviteResult = (result: {
      status: 'sent' | 'accepted' | 'rejected' | 'error';
      code?: string;
      targetUsername?: string;
      roomName?: string;
      inviteId?: string;
    }) => {
      this.server.to(client.id).emit('room:invite:result', result);
    };

    if (!normalizedTarget || !roomName || !normalizedRoomName) {
      emitInviteResult({ status: 'error', code: 'invalid_payload' });
      return {
        status: 'error',
        message: 'targetUsername and roomName required',
      };
    }

    let senderInfo: RoomMember | null = null;
    for (const members of this.getRoomsStore().values()) {
      for (const info of members.values()) {
        if (info.socketId === client.id) {
          senderInfo = info;
          break;
        }
      }
      if (senderInfo) break;
    }

    if (!senderInfo) {
      emitInviteResult({ status: 'error', code: 'sender_not_found' });
      return { status: 'error', message: 'sender_not_found' };
    }

    const senderStars = senderInfo.roleStarCount || 0;
    const senderUsername = senderInfo.username || (client as any).username;
    const senderIsRoot = senderUsername?.toLowerCase() === 'root';
    if (senderStars < 1 && !senderIsRoot) {
      emitInviteResult({ status: 'error', code: 'insufficient_privileges' });
      return { status: 'error', message: 'insufficient_privileges' };
    }

    if (this.normalize(senderUsername) === normalizedTarget) {
      emitInviteResult({ status: 'error', code: 'self_invite' });
      return { status: 'error', message: 'self_invite' };
    }

    const senderTenantId = senderInfo.tenantId || 'tenant_master';
    const targetMember = this.findActiveMember(
      senderTenantId,
      normalizedTarget,
    );
    if (!targetMember) {
      emitInviteResult({
        status: 'error',
        code: 'target_not_found',
        targetUsername,
        roomName,
      });
      return { status: 'error', message: 'target_not_found' };
    }

    if (
      targetMember.isGuest !== true &&
      targetMember.rejectRoomInvites === true
    ) {
      emitInviteResult({
        status: 'error',
        code: 'rejected_by_preference',
        targetUsername: targetMember.username,
        roomName,
      });
      return { status: 'error', message: 'rejected_by_preference' };
    }

    const persistedUser = await this.findPersistedUserByUsername(
      targetMember.username,
    );
    if (
      isProtectedActionBlocked({
        actorStarCount: senderStars,
        isRoot: senderIsRoot,
        targetProtection: persistedUser?.protection,
        targetProtectedByStarCount: persistedUser?.protectedByStarCount,
      })
    ) {
      emitInviteResult({
        status: 'error',
        code: 'target_is_protected',
        targetUsername: targetMember.username,
        roomName,
      });
      return { status: 'error', message: 'target_is_protected' };
    }

    let targetCurrentRoomKey: string | null = null;
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      const member = members.get(normalizedTarget);
      if (!member || member.socketId !== targetMember.socketId) continue;
      if ((member.tenantId || 'tenant_master') !== senderTenantId) continue;
      targetCurrentRoomKey = roomKey;
      break;
    }

    if (targetCurrentRoomKey) {
      const targetRoomName =
        this.getRoomNamesStore().get(targetCurrentRoomKey) ||
        targetCurrentRoomKey;
      if (
        this.normalize(targetRoomName) === normalizedRoomName ||
        targetCurrentRoomKey === normalizedRoomName
      ) {
        emitInviteResult({
          status: 'error',
          code: 'already_in_room',
          targetUsername: targetMember.username,
          roomName,
        });
        return { status: 'error', message: 'already_in_room' };
      }
    }

    const inviteId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.getRoomInvitesStore().set(inviteId, {
      inviteId,
      inviterSocketId: client.id,
      inviterUsername: senderUsername || 'Bilinmeyen',
      inviterTenantId: senderTenantId,
      targetSocketId: targetMember.socketId,
      targetUsername: targetMember.username,
      roomName,
      createdAt: Date.now(),
    });

    this.server.to(targetMember.socketId).emit('room:invite:received', {
      inviteId,
      fromUsername: senderUsername || 'Bilinmeyen',
      roomName,
    });

    emitInviteResult({
      status: 'sent',
      inviteId,
      targetUsername: targetMember.username,
      roomName,
    });

    return { status: 'ok', inviteId };
  }

  @SubscribeMessage('room:invite:respond')
  handleRoomInviteRespond(
    @MessageBody() payload: RoomInviteRespondPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const inviteId = payload?.inviteId?.trim();
    const accepted = payload?.accepted === true;
    if (!inviteId) {
      return { status: 'error', message: 'inviteId required' };
    }

    const invite = this.getRoomInvitesStore().get(inviteId);
    if (!invite) {
      return { status: 'error', message: 'invite_not_found' };
    }

    if (invite.targetSocketId !== client.id) {
      return { status: 'error', message: 'not_invited_user' };
    }

    this.getRoomInvitesStore().delete(inviteId);
    this.server.to(invite.inviterSocketId).emit('room:invite:result', {
      status: accepted ? 'accepted' : 'rejected',
      targetUsername: invite.targetUsername,
      roomName: invite.roomName,
      inviteId,
    });

    return { status: 'ok', inviteId, accepted };
  }

  private normalizeGameAnswer(value: string): string {
    return String(value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9çğıöşü\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async ensureSorubazScoreTable(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "game_weekly_scores" (
        "id" BIGSERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "username" varchar(120) NOT NULL,
        "game" varchar(40) NOT NULL DEFAULT 'sorubaz',
        "weekKey" varchar(16) NOT NULL,
        "points" integer NOT NULL DEFAULT 0,
        "wins" integer NOT NULL DEFAULT 0,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("userId", "game", "weekKey")
      )
    `);
  }

  private getGameWeekKey(): string {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const day = Math.floor((now.getTime() - first.getTime()) / 86400000);
    return `${now.getUTCFullYear()}-W${String(Math.ceil((day + first.getUTCDay() + 1) / 7)).padStart(2, '0')}`;
  }

  private async emitSorubazLeaderboard(room: string): Promise<void> {
    try {
      await this.ensureSorubazScoreTable();
      const rows = await this.dataSource.query(
        `SELECT "username", "points", "wins" FROM "game_weekly_scores" WHERE "game"='sorubaz' AND "weekKey"=$1 ORDER BY "points" DESC, "wins" DESC LIMIT 10`,
        [this.getGameWeekKey()],
      );
      this.server.to(room).emit('game:leaderboard', { game: 'sorubaz', weekKey: this.getGameWeekKey(), rows });
    } catch (error) {
      this.logWarn(`Sorubaz leaderboard failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private startSorubazIfNeeded(room: string): void {
    const key = this.normalize(room);
    if (!key || (!key.includes('sorubaz') && !key.includes('soru-cevap') && !key.includes('soru cevap'))) return;
    void this.emitSorubazLeaderboard(key);
    if (this.sorubazTimers.has(key) || this.sorubazGames.has(key)) return;
    const ask = () => {
      const q = this.sorubazQuestions[Math.floor(Math.random() * this.sorubazQuestions.length)];
      this.sorubazGames.set(key, { answer: this.normalizeGameAnswer(q.a), question: q.q, points: q.p, expiresAt: Date.now() + 20000 });
      this.server.to(key).emit('room:message', {
        id: `sorubaz-${Date.now()}`,
        type: 'activity', activityType: 'sorubaz-question', username: 'Sorubaz',
        content: `🧠 SORUBAZ • ${q.q}  (+${q.p} puan)`, message: `🧠 SORUBAZ • ${q.q}  (+${q.p} puan)`,
        createdAt: new Date().toISOString(),
      });
      const timer = setTimeout(() => {
        const active = this.sorubazGames.get(key);
        if (active) {
          this.server.to(key).emit('room:message', { type: 'activity', activityType: 'sorubaz-timeout', username: 'Sorubaz', content: `⏱️ Süre doldu. Doğru cevap: ${active.answer}`, message: `⏱️ Süre doldu. Doğru cevap: ${active.answer}`, createdAt: new Date().toISOString() });
          this.sorubazGames.delete(key);
        }
        const next = setTimeout(ask, 8000);
        this.sorubazTimers.set(key, next);
      }, 20000);
      this.sorubazTimers.set(key, timer);
    };
    const first = setTimeout(ask, 2500);
    this.sorubazTimers.set(key, first);
  }

  private async evaluateSorubazAnswer(room: string, member: RoomMember, message: string): Promise<void> {
    const key = this.normalize(room);
    if (!key) return;
    const game = this.sorubazGames.get(key);
    if (!game || Date.now() > game.expiresAt) return;
    if (this.normalizeGameAnswer(message) !== game.answer) return;
    this.sorubazGames.delete(key);
    const timer = this.sorubazTimers.get(key);
    if (timer) clearTimeout(timer);
    this.sorubazTimers.delete(key);
    const display = this.getDisplayUsername(member);
    this.server.to(key).emit('room:message', { type: 'activity', activityType: 'sorubaz-win', username: 'Sorubaz', content: `🎉 ${display} doğru bildi! +${game.points} puan`, message: `🎉 ${display} doğru bildi! +${game.points} puan`, createdAt: new Date().toISOString() });
    // Guests may play and win the round, but only registered users enter the weekly table.
    if (member.userId && member.isGuest !== true) {
      try {
        await this.ensureSorubazScoreTable();
        await this.dataSource.query(
          `INSERT INTO "game_weekly_scores" ("userId","username","game","weekKey","points","wins") VALUES ($1,$2,'sorubaz',$3,$4,1) ON CONFLICT ("userId","game","weekKey") DO UPDATE SET "username"=EXCLUDED."username", "points"="game_weekly_scores"."points"+EXCLUDED."points", "wins"="game_weekly_scores"."wins"+1, "updatedAt"=now()`,
          [member.userId, member.username, this.getGameWeekKey(), game.points],
        );
        await this.emitSorubazLeaderboard(key);
      } catch (error) { this.logWarn(`Sorubaz score failed: ${error instanceof Error ? error.message : String(error)}`); }
    }
    const next = setTimeout(() => { this.sorubazTimers.delete(key); this.startSorubazIfNeeded(key); }, 8000);
    this.sorubazTimers.set(key, next);
  }

  private async addWeeklyGameScore(member: RoomMember, game: string, points: number): Promise<void> {
    if (!member.userId || member.isGuest === true) return;
    await this.ensureSorubazScoreTable();
    await this.dataSource.query(
      `INSERT INTO "game_weekly_scores" ("userId","username","game","weekKey","points","wins") VALUES ($1,$2,$3,$4,$5,1) ON CONFLICT ("userId","game","weekKey") DO UPDATE SET "username"=EXCLUDED."username", "points"="game_weekly_scores"."points"+EXCLUDED."points", "wins"="game_weekly_scores"."wins"+1, "updatedAt"=now()`,
      [member.userId, member.username, game, this.getGameWeekKey(), points],
    );
  }

  private scrambleGameWord(word: string): string {
    const chars = Array.from(word);
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const mixed = chars.join('');
    return mixed === word && word.length > 2 ? word.slice(1) + word[0] : mixed;
  }

  private async getGameSettings(): Promise<{ diceEnabled:boolean; wordHuntEnabled:boolean; duelEnabled:boolean; sorubazEnabled:boolean; wordHuntPoints:number; duelPoints:number }> {
    try {
      await this.dataSource.query(`CREATE TABLE IF NOT EXISTS "game_settings" ("id" integer PRIMARY KEY DEFAULT 1, "diceEnabled" boolean NOT NULL DEFAULT true, "wordHuntEnabled" boolean NOT NULL DEFAULT true, "duelEnabled" boolean NOT NULL DEFAULT true, "sorubazEnabled" boolean NOT NULL DEFAULT true, "wordHuntPoints" integer NOT NULL DEFAULT 10, "duelPoints" integer NOT NULL DEFAULT 15, "updatedAt" timestamptz NOT NULL DEFAULT now())`);
      await this.dataSource.query(`INSERT INTO "game_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING`);
      const rows = await this.dataSource.query(`SELECT * FROM "game_settings" WHERE "id"=1`);
      return rows[0];
    } catch { return { diceEnabled:true, wordHuntEnabled:true, duelEnabled:true, sorubazEnabled:true, wordHuntPoints:10, duelPoints:15 }; }
  }

  @SubscribeMessage('game:wordhunt:start')
  async handleWordHuntStart(@MessageBody() payload: { room?: string }, @ConnectedSocket() client: Socket) {
    const settings = await this.getGameSettings();
    if (!settings.wordHuntEnabled) return { status:'error', message:'game_disabled' };
    const room = this.normalize(payload?.room);
    const member = room ? Array.from(this.getRoomsStore().get(room)?.values() ?? []).find((item) => item.socketId === client.id) : undefined;
    if (!room || !member) return { status: 'error', message: 'not_in_room' };
    if (this.wordHuntGames.has(room)) return { status: 'error', message: 'already_running' };
    const answer = this.wordHuntWords[Math.floor(Math.random() * this.wordHuntWords.length)];
    const scrambled = this.scrambleGameWord(answer);
    this.wordHuntGames.set(room, { answer: this.normalizeGameAnswer(answer), scrambled, points: settings.wordHuntPoints, expiresAt: Date.now() + 30000 });
    this.server.to(room).emit('room:message', { type:'activity', activityType:'wordhunt-question', username:'Kelime Avı', content:`🔤 KELİME AVI • Harfleri çöz: ${scrambled.toUpperCase()}  (+${settings.wordHuntPoints} puan)`, message:`🔤 KELİME AVI • Harfleri çöz: ${scrambled.toUpperCase()}  (+${settings.wordHuntPoints} puan)`, createdAt:new Date().toISOString() });
    setTimeout(() => {
      const active = this.wordHuntGames.get(room);
      if (active && Date.now() >= active.expiresAt) {
        this.wordHuntGames.delete(room);
        this.server.to(room).emit('room:message', { type:'activity', activityType:'wordhunt-timeout', username:'Kelime Avı', content:`⏱️ Kelime Avı bitti. Cevap: ${active.answer}`, message:`⏱️ Kelime Avı bitti. Cevap: ${active.answer}`, createdAt:new Date().toISOString() });
      }
    }, 30500);
    return { status:'ok' };
  }

  @SubscribeMessage('game:duel:start')
  async handleDuelStart(@MessageBody() payload: { room?: string }, @ConnectedSocket() client: Socket) {
    const settings = await this.getGameSettings();
    if (!settings.duelEnabled) return { status:'error', message:'game_disabled' };
    const room = this.normalize(payload?.room);
    const member = room ? Array.from(this.getRoomsStore().get(room)?.values() ?? []).find((item) => item.socketId === client.id) : undefined;
    if (!room || !member) return { status:'error', message:'not_in_room' };
    if (this.duelGames.has(room)) return { status:'error', message:'already_running' };
    this.duelGames.set(room, { challenger: member, expiresAt: Date.now() + 30000 });
    const display = this.getDisplayUsername(member);
    this.server.to(room).emit('room:message', { type:'activity', activityType:'duel-open', username:'Düello', content:`⚔️ ${display} düello başlattı! Katılmak için 30 saniye içinde “kabul” yaz.`, message:`⚔️ ${display} düello başlattı! Katılmak için 30 saniye içinde “kabul” yaz.`, createdAt:new Date().toISOString() });
    setTimeout(() => {
      const duel = this.duelGames.get(room);
      if (duel && Date.now() >= duel.expiresAt) {
        this.duelGames.delete(room);
        this.server.to(room).emit('room:message', { type:'activity', activityType:'duel-timeout', username:'Düello', content:'⌛ Düello davetinin süresi doldu.', message:'⌛ Düello davetinin süresi doldu.', createdAt:new Date().toISOString() });
      }
    }, 30500);
    return { status:'ok' };
  }

  private async evaluateExtraGames(room: string, member: RoomMember, message: string): Promise<void> {
    const key = this.normalize(room);
    if (!key) return;
    const normalized = this.normalizeGameAnswer(message);
    const wordGame = this.wordHuntGames.get(key);
    if (wordGame && Date.now() <= wordGame.expiresAt && normalized === wordGame.answer) {
      this.wordHuntGames.delete(key);
      const display = this.getDisplayUsername(member);
      this.server.to(key).emit('room:message', { type:'activity', activityType:'wordhunt-win', username:'Kelime Avı', content:`🏆 ${display} kelimeyi buldu! +${wordGame.points} puan`, message:`🏆 ${display} kelimeyi buldu! +${wordGame.points} puan`, createdAt:new Date().toISOString() });
      try { await this.addWeeklyGameScore(member, 'wordhunt', wordGame.points); } catch (error) { this.logWarn(`Word hunt score failed: ${error instanceof Error ? error.message : String(error)}`); }
    }
    const duel = this.duelGames.get(key);
    if (duel && Date.now() <= duel.expiresAt && normalized === 'kabul' && duel.challenger.socketId !== member.socketId) {
      this.duelGames.delete(key);
      const a = Math.floor(Math.random()*100)+1;
      const b = Math.floor(Math.random()*100)+1;
      const winner = a >= b ? duel.challenger : member;
      const loser = a >= b ? member : duel.challenger;
      const winnerScore = a >= b ? a : b;
      const loserScore = a >= b ? b : a;
      this.server.to(key).emit('room:message', { type:'activity', activityType:'duel-result', username:'Düello', content:`⚔️ ${this.getDisplayUsername(duel.challenger)} ${a} — ${b} ${this.getDisplayUsername(member)} • 🏆 ${this.getDisplayUsername(winner)} kazandı!`, message:`⚔️ ${this.getDisplayUsername(duel.challenger)} ${a} — ${b} ${this.getDisplayUsername(member)} • 🏆 ${this.getDisplayUsername(winner)} kazandı!`, createdAt:new Date().toISOString(), winner: winner.username, winnerScore, loser: loser.username, loserScore });
      try { const settings = await this.getGameSettings(); await this.addWeeklyGameScore(winner, 'duel', settings.duelPoints); } catch (error) { this.logWarn(`Duel score failed: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }

  @SubscribeMessage('game:leaderboard:get')
  async handleGameLeaderboard(@MessageBody() payload: { room?: string }) {
    const room = this.normalize(payload?.room);
    if (room) await this.emitSorubazLeaderboard(room);
    return { status: 'ok' };
  }

  @SubscribeMessage('room:dice:roll')
  async handleDiceRoll(
    @MessageBody() payload: { room?: string; username?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.normalize(payload?.room);
    const username = String(payload?.username || '').trim();
    if (!room || !username) return { status: 'error', message: 'invalid_payload' };
    const settings = await this.getGameSettings();
    if (!settings.diceEnabled) return { status:'error', message:'game_disabled' };

    // Do not trust a client supplied result: the server always rolls the die.
    const value = Math.floor(Math.random() * 6) + 1;
    const event = {
      id: `dice-${Date.now()}-${client.id}`,
      type: 'activity',
      activityType: 'dice',
      username,
      message: `🎲 ${username} zar attı: ${value}`,
      content: `🎲 ${username} zar attı: ${value}`,
      diceValue: value,
      createdAt: new Date().toISOString(),
    };
    this.server.to(room).emit('room:message', event);
    return { status: 'ok', value };
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger?.log?.(
      `sendMessage event received from ${client.id}:`,
      payload,
    );
    const {
      room,
      username,
      message,
      messageId,
      type,
      replyTo,
      fontColor,
      targetGroup,
    } = payload || {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);
    const trimmedMessage = message?.trim();

    if (!normalizedRoom || !normalizedUsername || !trimmedMessage) {
      this.logger?.warn?.(`Invalid sendMessage payload from ${client.id}`);
      return {
        status: 'error',
        message: 'room, username and message are required',
      };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'not_in_room' };
    }

    const guestWritingBlockedReason =
      await this.getGuestWritingBlockedReasonSafe(member);
    if (guestWritingBlockedReason) {
      return {
        status: 'error',
        message: guestWritingBlockedReason,
      };
    }

    if (targetGroup) {
      const hasGeneralBroadcastPermission = await this.hasPermissionByUsername(
        member.username,
        PERMISSION_LABELS.GENERAL_BROADCAST,
      );
      if (!hasGeneralBroadcastPermission) {
        return {
          status: 'error',
          message: 'general_broadcast_permission_required',
        };
      }
    }

    const muteStatus = this.isUserMutedForRoom(member);
    if (muteStatus.muted && muteStatus.reason) {
      this.emitMuteActionDenied(member, normalizedRoom, muteStatus.reason);
      return { status: 'error', message: muteStatus.reason };
    }

    const processedMessage = this.preprocessMessage(trimmedMessage);
    const displayUsername = this.getDisplayUsername(member);

    // Build message payload with optional reply info
    const baseMessagePayload = {
      username: member.username,
      displayUsername,
      originalUsername: member.username,
      message: processedMessage,
      gender: member.gender,
      isGuest: member.isGuest,
      timestamp: new Date().toISOString(),
      fontColor: fontColor || null,
      targetGroup: targetGroup || null,
      roleStarCount: member.roleStarCount ?? null,
    };

    if (targetGroup) {
      const currentRoomPayload: Record<string, unknown> = {
        ...baseMessagePayload,
        room: normalizedRoom,
      };

      if (messageId !== undefined) {
        currentRoomPayload.id = messageId;
        currentRoomPayload.messageId = messageId;
      }

      if (type === 'reply' && replyTo) {
        currentRoomPayload.type = 'reply';
        currentRoomPayload.replyToMessage = {
          id: replyTo.messageId,
          content: replyTo.content,
          username: replyTo.sender,
        };
      }

      this.server.to(normalizedRoom).emit('room:message', currentRoomPayload);

      this.emitTenantWideMessage(member.tenantId, targetGroup, (roomKey) => {
        const payload: Record<string, unknown> = {
          ...baseMessagePayload,
          room: roomKey,
        };

        if (messageId !== undefined && roomKey === normalizedRoom) {
          payload.id = messageId;
          payload.messageId = messageId;
        }

        if (type === 'reply' && replyTo && roomKey === normalizedRoom) {
          payload.type = 'reply';
          payload.replyToMessage = {
            id: replyTo.messageId,
            content: replyTo.content,
            username: replyTo.sender,
          };
        }

        return payload;
      });
    } else {
      const messagePayload: Record<string, unknown> = {
        ...baseMessagePayload,
        room: normalizedRoom,
      };

      // Include messageId from API if provided
      if (messageId !== undefined) {
        messagePayload.id = messageId;
        messagePayload.messageId = messageId;
      }

      // Include reply info if this is a reply message
      if (type === 'reply' && replyTo) {
        messagePayload.type = 'reply';
        messagePayload.replyToMessage = {
          id: replyTo.messageId,
          content: replyTo.content,
          username: replyTo.sender,
        };
      }

      this.server.to(normalizedRoom).emit('room:message', messagePayload);
    }

    void this.evaluateSorubazAnswer(normalizedRoom, member, processedMessage);
    void this.evaluateExtraGames(normalizedRoom, member, processedMessage);

    return {
      status: 'ok',
      room: normalizedRoom,
      username: member.username,
      displayUsername,
      message: processedMessage,
      messageId,
    };
  }

  @SubscribeMessage('sendImage')
  async handleImage(
    @MessageBody() payload: SendImagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const imageSize = payload?.image?.length ?? 0;
      this.logger?.log?.(
        `sendImage event received from ${client.id}, size: ${Math.round(imageSize / 1024)}KB`,
      );

      const {
        room,
        username,
        image,
        message,
        fontColor,
        targetGroup,
        messageId,
      } = payload ?? {};
      const normalizedRoom = this.normalize(room);
      const normalizedUsername = this.normalize(username);
      const trimmedMessage = message?.trim() ?? '';

      if (!normalizedRoom || !normalizedUsername || !image) {
        this.logger?.warn?.(`Invalid sendImage payload from ${client.id}`);
        return {
          status: 'error',
          message: 'room, username and image are required',
        };
      }

      // Validate image format - accept both base64 and URL paths (for animations/emojis)
      const isBase64 = image.startsWith('data:image/');
      const isAnimationUrl = image.startsWith('/animasyonlar/');
      const isEmojiUrl = image.startsWith('/emom/');

      if (!isBase64 && !isAnimationUrl && !isEmojiUrl) {
        this.logger?.warn?.(`Invalid image format from ${client.id}`);
        return { status: 'error', message: 'invalid_image_format' };
      }

      // Check image size limit to match socket payload settings
      if (isBase64 && image.length > socketPayloadLimitBytes) {
        this.logger?.warn?.(
          `Image too large from ${client.id}: ${Math.round(image.length / 1024)}KB`,
        );
        return { status: 'error', message: 'image_too_large' };
      }

      const resolvedMember = this.resolveRoomMessageMember(
        normalizedRoom,
        normalizedUsername,
        client,
      );
      const roomMembers = resolvedMember?.roomMembers;
      const member = resolvedMember?.member;

      if (!roomMembers || !member) {
        return { status: 'error', message: 'not_in_room' };
      }

      const guestWritingBlockedReason =
        await this.getGuestWritingBlockedReasonSafe(member);
      if (guestWritingBlockedReason) {
        return {
          status: 'error',
          message: guestWritingBlockedReason,
        };
      }

      if (targetGroup) {
        const hasGeneralBroadcastPermission =
          await this.hasPermissionByUsername(
            member.username,
            PERMISSION_LABELS.GENERAL_BROADCAST,
          );
        if (!hasGeneralBroadcastPermission) {
          return {
            status: 'error',
            message: 'general_broadcast_permission_required',
          };
        }
      }

      const muteStatus = this.isUserMutedForRoom(member);
      if (muteStatus.muted && muteStatus.reason) {
        this.emitMuteActionDenied(member, normalizedRoom, muteStatus.reason);
        return { status: 'error', message: muteStatus.reason };
      }

      const now = new Date();
      const time = now.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const processedMessage = this.preprocessMessage(trimmedMessage);

      const displayUsername = this.getDisplayUsername(member);
      const basePayload = {
        username: member.username,
        displayUsername,
        originalUsername: member.username,
        message: processedMessage,
        image,
        time,
        gender: member.gender,
        isGuest: member.isGuest,
        fontColor: fontColor || null,
        targetGroup: targetGroup || null,
        roleStarCount: member.roleStarCount ?? null,
      };

      if (targetGroup) {
        this.server.to(normalizedRoom).emit('room:image', {
          ...basePayload,
          room: normalizedRoom,
          id: messageId,
          messageId,
        });
        this.emitTenantWideImage(member.tenantId, targetGroup, (roomKey) => ({
          ...basePayload,
          room: roomKey,
          id: roomKey === normalizedRoom ? messageId : undefined,
          messageId: roomKey === normalizedRoom ? messageId : undefined,
        }));
      } else {
        this.server.to(normalizedRoom).emit('room:image', {
          ...basePayload,
          room: normalizedRoom,
          id: messageId,
          messageId,
        });
      }

      this.logger?.log?.(
        `Image broadcasted to room ${normalizedRoom} from ${member.username}`,
      );

      return {
        status: 'ok',
        room: normalizedRoom,
        username: member.username,
      };
    } catch (error) {
      this.logger?.error?.(`Error handling image from ${client.id}:`, error);
      return { status: 'error', message: 'internal_error' };
    }
  }

  @SubscribeMessage('sendAudio')
  async handleAudio(
    @MessageBody() payload: SendAudioPayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger?.log?.(`sendAudio event received from ${client.id}`);
    const {
      room,
      username,
      audio,
      audioFileName,
      message,
      fontColor,
      targetGroup,
      messageId,
    } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);
    const trimmedMessage = message?.trim() ?? '';

    if (!normalizedRoom || !normalizedUsername || !audio) {
      this.logger?.warn?.(`Invalid sendAudio payload from ${client.id}`);
      return {
        status: 'error',
        message: 'room, username and audio are required',
      };
    }

    // Validate base64 audio format
    if (!audio.startsWith('data:audio/')) {
      this.logger?.warn?.(`Invalid audio format from ${client.id}`);
      return { status: 'error', message: 'invalid_audio_format' };
    }

    const resolvedMember = this.resolveRoomMessageMember(
      normalizedRoom,
      normalizedUsername,
      client,
    );
    const roomMembers = resolvedMember?.roomMembers;
    const member = resolvedMember?.member;

    if (!roomMembers || !member) {
      return { status: 'error', message: 'not_in_room' };
    }

    const guestWritingBlockedReason =
      await this.getGuestWritingBlockedReasonSafe(member);
    if (guestWritingBlockedReason) {
      return {
        status: 'error',
        message: guestWritingBlockedReason,
      };
    }

    if (targetGroup) {
      const hasGeneralBroadcastPermission = await this.hasPermissionByUsername(
        member.username,
        PERMISSION_LABELS.GENERAL_BROADCAST,
      );
      if (!hasGeneralBroadcastPermission) {
        return {
          status: 'error',
          message: 'general_broadcast_permission_required',
        };
      }
    }

    const muteStatus = this.isUserMutedForRoom(member);
    if (muteStatus.muted && muteStatus.reason) {
      this.emitMuteActionDenied(member, normalizedRoom, muteStatus.reason);
      return { status: 'error', message: muteStatus.reason };
    }

    const now = new Date();
    const time = now.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const processedMessage = this.preprocessMessage(trimmedMessage);

    const basePayload = {
      username: member.username,
      displayUsername: this.getDisplayUsername(member),
      originalUsername: member.username,
      message: processedMessage,
      audio,
      audioFileName: audioFileName ?? '',
      time,
      gender: member.gender,
      isGuest: member.isGuest,
      fontColor: fontColor || null,
      targetGroup: targetGroup || null,
      roleStarCount: member.roleStarCount ?? null,
    };

      if (targetGroup) {
        this.server.to(normalizedRoom).emit('room:audio', {
          ...basePayload,
          room: normalizedRoom,
          id: messageId,
          messageId,
        });
        this.emitTenantWideAudio(member.tenantId, targetGroup, (roomKey) => ({
          ...basePayload,
          room: roomKey,
          id: roomKey === normalizedRoom ? messageId : undefined,
        messageId: roomKey === normalizedRoom ? messageId : undefined,
      }));
    } else {
      this.server.to(normalizedRoom).emit('room:audio', {
        ...basePayload,
        room: normalizedRoom,
        id: messageId,
        messageId,
      });
    }

    this.logger?.log?.(
      `Audio broadcasted to room ${normalizedRoom} from ${member.username}`,
    );

    return {
      status: 'ok',
      room: normalizedRoom,
      username: member.username,
    };
  }

  @SubscribeMessage('sendYouTube')
  async handleYouTube(
    @MessageBody() payload: SendYouTubePayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger?.log?.(`sendYouTube event received from ${client.id}`);
    const {
      room,
      username,
      videoUrl,
      videoTitle,
      videoThumbnail,
      videoId,
      message,
      fontColor,
      targetGroup,
      messageId,
    } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);
    const trimmedMessage = message?.trim() ?? '';

    if (!normalizedRoom || !normalizedUsername || !videoId) {
      this.logger?.warn?.(`Invalid sendYouTube payload from ${client.id}`);
      return {
        status: 'error',
        message: 'room, username and videoId are required',
      };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'not_in_room' };
    }

    const guestWritingBlockedReason =
      await this.getGuestWritingBlockedReasonSafe(member);
    if (guestWritingBlockedReason) {
      return {
        status: 'error',
        message: guestWritingBlockedReason,
      };
    }

    if (targetGroup) {
      const hasGeneralBroadcastPermission = await this.hasPermissionByUsername(
        member.username,
        PERMISSION_LABELS.GENERAL_BROADCAST,
      );
      if (!hasGeneralBroadcastPermission) {
        return {
          status: 'error',
          message: 'general_broadcast_permission_required',
        };
      }
    }

    const muteStatus = this.isUserMutedForRoom(member);
    if (muteStatus.muted && muteStatus.reason) {
      this.emitMuteActionDenied(member, normalizedRoom, muteStatus.reason);
      return { status: 'error', message: muteStatus.reason };
    }

    const now = new Date();
    const time = now.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const processedMessage = this.preprocessMessage(trimmedMessage);

    const basePayload = {
      username: member.username,
      displayUsername: this.getDisplayUsername(member),
      originalUsername: member.username,
      message: processedMessage,
      videoUrl: videoUrl ?? '',
      videoTitle: videoTitle ?? '',
      videoThumbnail: videoThumbnail ?? '',
      videoId,
      time,
      gender: member.gender,
      isGuest: member.isGuest,
      fontColor: fontColor || null,
      targetGroup: targetGroup || null,
      roleStarCount: member.roleStarCount ?? null,
    };

      if (targetGroup) {
        this.server.to(normalizedRoom).emit('room:youtube', {
          ...basePayload,
          room: normalizedRoom,
          id: messageId,
          messageId,
        });
        this.emitTenantWideYouTube(member.tenantId, targetGroup, (roomKey) => ({
          ...basePayload,
          room: roomKey,
          id: roomKey === normalizedRoom ? messageId : undefined,
        messageId: roomKey === normalizedRoom ? messageId : undefined,
      }));
    } else {
      this.server.to(normalizedRoom).emit('room:youtube', {
        ...basePayload,
        room: normalizedRoom,
        id: messageId,
        messageId,
      });
    }

    this.logger?.log?.(
      `YouTube video broadcasted to room ${normalizedRoom} from ${member.username}`,
    );

    return {
      status: 'ok',
      room: normalizedRoom,
      username: member.username,
    };
  }

  @SubscribeMessage('room:getCounts')
  async handleRoomCounts(
    @MessageBody()
    payload: { room?: string; rooms?: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const roomList = Array.isArray(payload?.rooms)
      ? payload?.rooms
      : payload?.room
        ? [payload.room]
        : [];

    const normalizedRooms = roomList
      .map((roomKey) => this.normalize(roomKey))
      .filter((roomKey): roomKey is string => Boolean(roomKey));

    if (normalizedRooms.length === 0) {
      return { status: 'error', message: 'room or rooms are required' };
    }

    const counts: Record<string, number> = {};
    for (const roomKey of normalizedRooms) {
      const liveCount = this.getRoomUserCount(roomKey);
      let persistentBotCount = 0;
      try {
        persistentBotCount = (
          await this.getPersistentBotUsersForRoom(roomKey)
        ).filter(
          (bot) =>
            !this.getRoomsStore()
              .get(roomKey)
              ?.has(this.normalize(bot.username) ?? ''),
        ).length;
      } catch (error) {
        this.logWarn(
          `Room count bot hydration failed for room "${roomKey}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      counts[roomKey] = liveCount + persistentBotCount;
    }

    client.emit('room:counts', { counts });

    return { status: 'ok', counts };
  }

  @SubscribeMessage('room:getUsers')
  async handleRoomUsersSnapshot(
    @MessageBody() payload: { room?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedRoom = this.normalize(payload?.room);

    if (!normalizedRoom) {
      return { status: 'error', message: 'room is required' };
    }

    const { users } = await this.buildRoomUsersSnapshot(normalizedRoom);

    client.emit('room:users', {
      room: normalizedRoom,
      users,
    });

    return { status: 'ok', room: normalizedRoom, users };
  }

  @SubscribeMessage('tenant:getActiveUserCount')
  async handleTenantActiveUserCount(
    @MessageBody() payload: { tenantId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { tenantId } = payload ?? {};

    if (!tenantId || !tenantId.trim()) {
      return { status: 'error', message: 'tenantId is required' };
    }

    const trimmedTenantId = tenantId.trim();
    const normalizedTenantId = trimmedTenantId.replace(/^tenant_/, '');

    const { users } = this.getActiveTenantUsers(normalizedTenantId);
    let persistentBotUsers: Array<Omit<RoomUser, 'id'> & { socketId: string }> =
      [];
    try {
      persistentBotUsers = await this.getPersistentBotUsersForTenantSnapshot();
    } catch (error) {
      this.logWarn(
        `Tenant active user count bot hydration failed for tenant "${normalizedTenantId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const liveUserKeys = new Set(
      users.map((user) => this.normalize(user.username)).filter(Boolean),
    );
    const mergedUsers = [
      ...users,
      ...persistentBotUsers.filter(
        (bot) => !liveUserKeys.has(this.normalize(bot.username)),
      ),
    ];
    let hydratedUsers = mergedUsers;
    try {
      hydratedUsers = await this.hydrateRoleVisualsFromDatabase(mergedUsers);
    } catch (error) {
      this.logWarn(
        `Tenant active user count role hydration failed for tenant "${normalizedTenantId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const count = hydratedUsers.length;

    this.logJoinEffectDebug('tenant:getActiveUserCount:response', {
      tenantId: normalizedTenantId,
      count,
      users: hydratedUsers.map((user) => ({
        socketId: user.socketId,
        username: user.username,
        statusModeName: user.statusModeName ?? null,
        joinEffect: user.joinEffect ?? null,
        roomCount: Array.isArray(user.rooms) ? user.rooms.length : 0,
      })),
    });

    client.emit('tenant:activeUserCount', {
      tenantId: normalizedTenantId,
      count,
      users: hydratedUsers,
    });

    return {
      status: 'ok',
      tenantId: normalizedTenantId,
      count,
      users: hydratedUsers,
    };
  }

  @SubscribeMessage('room:updated')
  async handleRoomUpdated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number; roomName: string },
  ) {
    this.logger?.log?.('Room updated event received from admin:', data);

    // Tüm bağlı kullanıcılara oda güncellemesini broadcast et
    this.server.emit('room:updated', {
      roomId: data.roomId,
      roomName: data.roomName,
    });

    return { success: true };
  }

  @SubscribeMessage('radio-settings:updated')
  async handleRadioSettingsUpdated(@ConnectedSocket() client: Socket) {
    this.server.emit('radio-settings:updated');
    return { success: true };
  }

  @SubscribeMessage('forbidden-words:updated')
  async handleForbiddenWordsUpdated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type: 'created' | 'deleted'; forbiddenWordId?: number },
  ) {
    this.logger?.log?.('Forbidden words update event received from admin:', data);

    this.server.emit('forbidden-words:updated', {
      type: data?.type,
      forbiddenWordId: data?.forbiddenWordId,
    });

    return { success: true };
  }

  @SubscribeMessage('wall-posts:updated')
  async handleWallPostsUpdated(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      action:
        | 'created'
        | 'deleted'
        | 'liked'
        | 'comment_created'
        | 'comment_deleted';
      postId?: number;
      commentId?: number;
    },
  ) {
    this.logger?.log?.('Wall posts update event received from client:', data);

    this.server.emit('wall-posts:updated', {
      action: data?.action,
      postId: data?.postId,
      commentId: data?.commentId,
    });

    return { success: true };
  }

  private normalize(value?: string): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed.toLowerCase() : null;
  }

  private resolveClientIp(client: Socket): string | null {
    const headers = client.handshake?.headers ?? {};
    const forwardedFor = headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      const firstIp = forwardedFor.split(',')[0]?.trim();
      if (firstIp) return firstIp;
    }

    const realIp = headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim().length > 0) {
      return realIp.trim();
    }

    if (typeof client.handshake?.address === 'string') {
      const addr = client.handshake.address.trim();
      if (addr.length > 0) return addr;
    }

    return null;
  }

  private emitTemporaryOperatorUpdated(
    tenantId: string,
    username: string,
    isTemporaryOperator: boolean,
  ) {
    this.server.emit('moderation:tempOperator:updated', {
      tenantId,
      username,
      isTemporaryOperator,
    });
  }

  private preprocessMessage(message: string): string {
    if (!message) return message;
    // Replace emoticons with [e1]
    // Order matters: :)) should be replaced before :)
    return message
      .replace(/:D/g, '[e1]')
      .replace(/:\)\)/g, '[e1]')
      .replace(/:\)/g, '[e1]');
  }

  private getRoomDisplayName(roomKey: string): string {
    return this.getRoomNamesStore().get(roomKey) || roomKey;
  }

  private isLobbyRoomAlias(value?: string | null): boolean {
    const normalized = this.normalize(value ?? undefined);
    return Boolean(
      normalized && RoomsGateway.LOBBY_ROOM_ALIASES.has(normalized),
    );
  }

  private async resolveCanonicalLobbyRoomKey(): Promise<string> {
    const roomRepository = this.getRoomRepository();
    if (!roomRepository?.createQueryBuilder) {
      return this.resolveRoomKey('lobby') || 'lobby';
    }

    try {
      const roomEntity = await roomRepository
        .createQueryBuilder('room')
        .where('LOWER(room.voiceId) = :lobby', { lobby: 'lobby' })
        .orWhere('LOWER(room.name) IN (:...names)', {
          names: ['lobby', 'lobi'],
        })
        .getOne();
      const roomKey = roomEntity?.voiceId || roomEntity?.name || 'lobby';
      const roomName = roomEntity?.name?.trim();
      if (roomKey && roomName) {
        this.getRoomNamesStore().set(roomKey, roomName);
      }
      return roomKey;
    } catch (error) {
      this.logWarn(
        `Lobby room lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.resolveRoomKey('lobby') || 'lobby';
    }
  }

  private resolveRoomKey(roomLike: string): string | null {
    const normalized = this.normalize(roomLike);
    if (!normalized) return null;

    if (this.isLobbyRoomAlias(normalized)) return 'lobby';
    if (this.getRoomsStore().has(normalized) || this.getRoomNamesStore().has(normalized)) {
      return normalized;
    }

    const slugAsName = normalized.replace(/-/g, ' ');
    for (const [roomKey, roomName] of this.getRoomNamesStore().entries()) {
      const normalizedName = this.normalize(roomName);
      if (!normalizedName) continue;
      if (
        normalizedName === normalized ||
        normalizedName === slugAsName ||
        normalizedName.replace(/\s+/g, '-') === normalized
      ) {
        return roomKey;
      }
    }

    return normalized;
  }

  private async validateRoomJoinAccess(params: {
    normalizedRoom: string;
    rawRoom?: string;
    rawRoomId?: string;
    normalizedUsername: string;
    trimmedUsername: string;
    trimmedRoomName?: string;
    isGuest: boolean;
    fallbackRoleStarCount: number;
  }): Promise<RoomJoinAccessResult> {
    const {
      normalizedRoom,
      rawRoom,
      rawRoomId,
      normalizedUsername,
      trimmedUsername,
      trimmedRoomName,
      isGuest,
      fallbackRoleStarCount,
    } = params;

    if (normalizedUsername === 'root') {
      return {
        allowed: true,
        roomEntity: null,
        effectiveStarCount: fallbackRoleStarCount,
        canUseRoofMode: true,
        roleName: 'Admin',
      };
    }

    const roomRepository = this.getRoomRepository();
    if (!roomRepository) {
      this.logger?.warn?.(
        `Room repository unavailable during join validation for room ${normalizedRoom}. Falling back to legacy join behavior.`,
      );
      return {
        allowed: true,
        roomEntity: null,
        effectiveStarCount: isGuest ? 0 : fallbackRoleStarCount,
        canUseRoofMode: isGuest ? false : fallbackRoleStarCount >= 1,
        persistedUser: null,
        roleName: normalizedUsername === 'root' ? 'Admin' : undefined,
      };
    }

    if (rawRoomId) {
      const roomById = await roomRepository.findOne({
        where: { id: Number(rawRoomId) },
      });

      if (roomById) {
        return this.validateRoomJoinAccessAgainstRoom({
          roomEntity: roomById,
          normalizedUsername,
          trimmedUsername,
          isGuest,
          fallbackRoleStarCount,
        });
      }
    }

    const roomLookupCandidates = Array.from(
      new Set(
        [
          normalizedRoom,
          normalizedRoom.replace(/-/g, ' '),
          this.normalize(trimmedRoomName),
          this.normalize(trimmedRoomName)?.replace(/\s+/g, '-'),
        ].filter((candidate): candidate is string => Boolean(candidate)),
      ),
    );
    const rawRoomCandidates = Array.from(
      new Set(
        [rawRoom, trimmedRoomName].filter((candidate): candidate is string =>
          Boolean(candidate?.trim()),
        ),
      ),
    );

    const roomEntity = await roomRepository
      .createQueryBuilder('room')
      .where(
        new Brackets((qb) => {
          qb.where('LOWER(room.name) IN (:...nameCandidates)', {
            nameCandidates: roomLookupCandidates,
          });

          if (rawRoomCandidates.length > 0) {
            qb.orWhere('room.voiceId IN (:...voiceIdCandidates)', {
              voiceIdCandidates: rawRoomCandidates,
            }).orWhere(
              'LOWER(room.voiceId) IN (:...normalizedVoiceIdCandidates)',
              {
                normalizedVoiceIdCandidates: rawRoomCandidates.map(
                  (candidate) => candidate.toLowerCase(),
                ),
              },
            );
          }
        }),
      )
      .getOne();

    return this.validateRoomJoinAccessAgainstRoom({
      roomEntity,
      normalizedUsername,
      trimmedUsername,
      isGuest,
      fallbackRoleStarCount,
    });
  }

  private async validateRoomJoinAccessAgainstRoom(params: {
    roomEntity: Room | null;
    normalizedUsername: string;
    trimmedUsername: string;
    isGuest: boolean;
    fallbackRoleStarCount: number;
  }): Promise<RoomJoinAccessResult> {
    const {
      roomEntity,
      normalizedUsername,
      trimmedUsername,
      isGuest,
      fallbackRoleStarCount,
    } = params;

    let effectiveStarCount = 0;
    let persistedModerationState:
      | {
          globalMuted: boolean;
          globalMutedByStarCount: number;
          micBanned: boolean;
          micBannedByStarCount: number;
          cameraBanned: boolean;
          cameraBannedByStarCount: number;
        }
      | undefined;
    let persistedUser: User | null = null;
    let canUseRoofMode = false;

    if (isGuest) {
      effectiveStarCount = 0;
      canUseRoofMode = false;
    } else {
      if (!this.userRepository?.createQueryBuilder) {
        this.logger?.warn?.(
          `User repository unavailable during join validation for ${trimmedUsername}. Falling back to legacy join behavior.`,
        );
        return {
          allowed: true,
          roomEntity: roomEntity ?? null,
          effectiveStarCount: fallbackRoleStarCount,
          canUseRoofMode: false,
          persistedUser: null,
        };
      }

      persistedUser = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where(
          'LOWER(user.username) = :username AND user.deletedAt IS NULL AND user.isGuest = :isGuest',
          {
          username: normalizedUsername,
            isGuest: false,
          },
        )
        .getOne();

      effectiveStarCount = persistedUser?.role?.starCount ?? 0;
      if (
        persistedUser &&
        this.normalize(persistedUser.username) !== normalizedUsername
      ) {
        this.logger?.warn?.(
          `Join star lookup username mismatch for ${trimmedUsername}`,
        );
      }

      if (persistedUser) {
        persistedModerationState = {
          globalMuted: persistedUser.globalMuted ?? false,
          globalMutedByStarCount: persistedUser.globalMutedByStarCount ?? 0,
          micBanned: persistedUser.micBanned ?? false,
          micBannedByStarCount: persistedUser.micBannedByStarCount ?? 0,
          cameraBanned: persistedUser.cameraBanned ?? false,
          cameraBannedByStarCount: persistedUser.cameraBannedByStarCount ?? 0,
        };
      }

      canUseRoofMode =
        effectiveStarCount >= 1 &&
        hasPermissionForUser(persistedUser, PERMISSION_LABELS.ROOF_ACCESS);
    }

    if (isGuest && roomEntity && (roomEntity.minStar ?? 0) > 0) {
      return {
        allowed: false,
        code: 'minimum_star_required',
        message: `Bu odaya girmek için en az ${roomEntity.minStar} yıldız gerekir.`,
        requiredMinStar: roomEntity.minStar,
        effectiveStarCount,
        roomEntity,
      };
    }

    if (isGuest && this.userRepository?.createQueryBuilder) {
      persistedUser = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where(
          'LOWER(user.username) = :username AND user.deletedAt IS NULL AND user.isGuest = :isGuest',
          {
            username: normalizedUsername,
            isGuest: true,
          },
        )
        .getOne();
    }

    if (!roomEntity) {
      return {
        allowed: true,
        roomEntity: null,
        effectiveStarCount,
        canUseRoofMode,
        persistedUser,
        persistedModerationState,
      };
    }

    if (
      isMeetingRoomName(roomEntity.name) &&
      !hasPermissionForUser(persistedUser, PERMISSION_LABELS.MEETING_ROOM)
    ) {
      return {
        allowed: false,
        code: 'meeting_permission_required',
        message: 'Toplantı odasına giriş yetkiniz yok.',
        requiredMinStar: roomEntity.minStar ?? 0,
        effectiveStarCount,
        roomEntity,
      };
    }

    if (
      (roomEntity.minStar ?? 0) > 0 &&
      effectiveStarCount < roomEntity.minStar
    ) {
      return {
        allowed: false,
        code: 'minimum_star_required',
        message: `Bu odaya girmek için en az ${roomEntity.minStar} yıldız gerekir.`,
        requiredMinStar: roomEntity.minStar,
        effectiveStarCount,
        roomEntity,
      };
    }

    return {
      allowed: true,
      roomEntity,
      effectiveStarCount,
      canUseRoofMode,
      persistedUser,
      persistedModerationState,
    };
  }

  private isUserMutedForRoom(member: RoomMember): {
    muted: boolean;
    scope: 'room' | 'global' | null;
    reason: 'room_muted' | 'global_muted' | null;
  } {
    if (member.globalMuted) {
      return { muted: true, scope: 'global', reason: 'global_muted' };
    }
    if (member.roomMuted) {
      return { muted: true, scope: 'room', reason: 'room_muted' };
    }
    return { muted: false, scope: null, reason: null };
  }

  private emitMuteActionDenied(
    member: RoomMember,
    roomKey: string,
    reason: 'room_muted' | 'global_muted',
  ): void {
    const roomName = this.getRoomDisplayName(roomKey);
    this.server.to(member.socketId).emit('moderation:muteActionDenied', {
      username: member.username,
      scope: reason === 'global_muted' ? 'global' : 'room',
      reason,
      room: roomKey,
      roomName,
    });
  }

  private async findPersistedUserByUsername(
    username: string,
  ): Promise<User | null> {
    const normalizedUsername = this.normalize(username);
    if (!normalizedUsername) {
      return null;
    }

    if (!this.userRepository) {
      this.logger?.warn?.(
        `User lookup skipped because userRepository is not available (username: ${normalizedUsername})`,
      );
      return null;
    }

    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.username) = :username AND user.deletedAt IS NULL', {
        username: normalizedUsername,
      })
      .getOne();
  }

  private async syncPersistedRolesForRoom(roomKey: string): Promise<void> {
    if (!this.userRepository?.createQueryBuilder) {
      return;
    }

    const members = this.getRoomsStore().get(roomKey);
    if (!members || members.size === 0) {
      return;
    }

    const normalizedUsernames = Array.from(members.values())
      .filter((member) => member.isGuest !== true)
      .map((member) => this.normalize(member.username))
      .filter((value): value is string => Boolean(value));

    if (normalizedUsernames.length === 0) {
      return;
    }

    const persistedUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where(
        'LOWER(user.username) IN (:...usernames) AND user.deletedAt IS NULL AND user.isGuest = :isGuest',
        {
        usernames: normalizedUsernames,
          isGuest: false,
        },
      )
      .getMany();

    const persistedByUsername = new Map(
      persistedUsers.map((user) => [this.normalize(user.username), user]),
    );

    for (const [, member] of members.entries()) {
      if (member.isGuest === true) {
        continue;
      }

      const persistedUser = persistedByUsername.get(
        this.normalize(member.username),
      );

      if (!persistedUser) {
        continue;
      }

      member.userId = persistedUser.id;
      member.roleName = persistedUser.role?.name?.trim() || undefined;
      member.roleStarCount = persistedUser.role?.starCount ?? undefined;
      member.roleStarColor =
        typeof persistedUser.role?.starColor === 'string' &&
        persistedUser.role.starColor.trim()
          ? persistedUser.role.starColor.trim()
          : undefined;
      member.roleIcon =
        typeof persistedUser.role?.icon === 'string' &&
        persistedUser.role.icon.trim()
          ? persistedUser.role.icon.trim()
          : undefined;
    }
  }

  private async syncPersistedRolesForTenant(tenantId: string): Promise<void> {
    const normalizedTenantId = tenantId.replace(/^tenant_/, '');
    const roomKeys = Array.from(this.getRoomsStore().entries())
      .filter(([, members]) =>
        Array.from(members.values()).some(
          (member) => (member.tenantId || 'tenant_master') === normalizedTenantId,
        ),
      )
      .map(([roomKey]) => roomKey);

    await Promise.all(
      roomKeys.map(async (roomKey) => {
        await this.syncPersistedRolesForRoom(roomKey);
      }),
    );
  }

  @SubscribeMessage('voice:offer')
  async handleVoiceOffer(
    @MessageBody() payload: VoiceOfferPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, targetUsername, offer } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedTarget = this.normalize(targetUsername);

    if (!normalizedRoom || !normalizedTarget || !offer) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const targetMember = roomMembers?.get(normalizedTarget);

    if (!roomMembers || !targetMember) {
      return { status: 'error', message: 'Target user not found' };
    }

    const senderUsername = this.getUsernameBySocketId(
      normalizedRoom,
      client.id,
    );
    if (!senderUsername) {
      return { status: 'error', message: 'Sender not in room' };
    }

    this.server.to(targetMember.socketId).emit('voice:offer', {
      room: normalizedRoom,
      fromUsername: senderUsername,
      offer,
    });

    return { status: 'ok' };
  }

  @SubscribeMessage('call:request')
  async handleCallRequest(
    @MessageBody() payload: CallRequestPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      targetUsername,
      targetAgentNickname,
      callerUsername,
      callerAgentNickname,
      callerIsGuest,
      tenantId,
      callId,
      callType,
    } =
      payload ?? {};
    const normalizedTarget = this.normalize(targetUsername);
    const socketUsername = (client as any).username as string | undefined;
    const resolvedCaller = this.normalize(socketUsername || callerUsername);
    const trimmedTenantId = tenantId?.trim();
    const normalizedTenantId = trimmedTenantId
      ? trimmedTenantId.replace(/^tenant_/, '')
      : ((client as any).tenantId as string | undefined) || 'tenant_master';
    const normalizedCallType = callType === 'video' ? 'video' : 'voice';

    if (!normalizedTarget || !resolvedCaller || !callId) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const callerKey = this.buildUserKey(
      normalizedTenantId,
      resolvedCaller,
      callerAgentNickname,
    );
    const targetKey = this.buildUserKey(
      normalizedTenantId,
      normalizedTarget,
      targetAgentNickname,
    );

    if (!callerKey || !targetKey) {
      return { status: 'error', message: 'Invalid users' };
    }

    if (resolvedCaller === normalizedTarget) {
      return { status: 'error', message: 'self_call' };
    }

    const blockedBetweenUsers = await this.isBlockedBetweenUsernames(
      resolvedCaller,
      normalizedTarget,
    );
    if (blockedBetweenUsers) {
      this.server.to(client.id).emit('call:rejected', {
        callId,
        reason: 'not_allowed',
        code: 'blocked_user',
      } as CallRejectPayload);
      return { status: 'error', message: 'not_allowed' };
    }

    if (
      this.getUserActiveCallsStore().has(callerKey) ||
      this.getUserActiveCallsStore().has(targetKey)
    ) {
      this.server.to(client.id).emit('call:rejected', {
        callId,
        reason: 'busy',
      });
      return { status: 'error', message: 'busy' };
    }

    if (this.getActiveCallsStore().has(callId)) {
      return { status: 'error', message: 'call_exists' };
    }

    const targetMember = this.findActiveMember(
      normalizedTenantId,
      normalizedTarget,
      targetAgentNickname,
    );
    if (!targetMember) {
      return { status: 'error', message: 'Target not found' };
    }

    const targetRejectsIncomingCalls =
      targetMember.isGuest !== true &&
      targetMember.rejectIncomingCalls === true;

    if (targetRejectsIncomingCalls) {
      this.server.to(client.id).emit('call:rejected', {
        callId,
        reason: 'not_allowed',
        code: 'target_rejects_incoming_calls',
      });
      return { status: 'error', message: 'not_allowed' };
    }

    const callerMember = this.findActiveMember(
      normalizedTenantId,
      resolvedCaller,
      callerAgentNickname,
    );
    const settings = await this.getVoiceCallSettingsSafe();
    const isCallerGuest =
      callerMember?.isGuest === true || callerIsGuest === true;
    const callerCanStartVoiceCall = isCallerGuest
      ? settings.guestVoiceCallEnabled
      : settings.membersVoiceCallEnabled;

    if (!callerCanStartVoiceCall) {
      const rejectCode = isCallerGuest
        ? 'guest_voice_call_disabled'
        : 'member_voice_call_disabled';
      this.server.to(client.id).emit('call:rejected', {
        callId,
        reason: 'not_allowed',
        code: rejectCode,
      });
      return { status: 'error', message: 'not_allowed' };
    }

    const callerDisplay =
      callerMember?.username ||
      socketUsername ||
      callerUsername ||
      resolvedCaller;
    const targetDisplay = targetMember.username;

    const record: ActiveCallRecord = {
      callId,
      callType: normalizedCallType,
      tenantId: normalizedTenantId,
      callerUsername: callerDisplay,
      callerAgentNickname: callerMember?.agentNickname ?? callerAgentNickname ?? null,
      targetUsername: targetDisplay,
      targetAgentNickname: targetMember.agentNickname ?? targetAgentNickname ?? null,
      callerSocketId: client.id,
      targetSocketId: targetMember.socketId,
      status: 'ringing',
      createdAt: Date.now(),
    };

    record.timeoutId = setTimeout(() => {
      const current = this.getActiveCallsStore().get(callId);
      if (!current || current.status !== 'ringing') return;
      const callerViewName = this.getDisplayUsernameForCallViewer(
        callerMember || { username: current.callerUsername },
        targetMember.roleStarCount || 0,
      );
      const targetViewName = this.getDisplayUsernameForCallViewer(
        targetMember || { username: current.targetUsername },
        callerMember?.roleStarCount || 0,
      );
      this.server.to(current.callerSocketId).emit('call:missed', {
        callId,
        callType: current.callType,
        callerUsername: current.callerUsername,
        targetUsername: targetViewName,
      });
      this.server.to(current.targetSocketId).emit('call:missed', {
        callId,
        callType: current.callType,
        callerUsername: callerViewName,
        targetUsername: current.targetUsername,
      });
      this.clearActiveCall(callId);
    }, 20000);

    this.getActiveCallsStore().set(callId, record);
    this.getUserActiveCallsStore().set(callerKey, callId);
    this.getUserActiveCallsStore().set(targetKey, callId);

    const targetViewerStars = targetMember.roleStarCount || 0;
    const callerDisplayForTarget = this.getDisplayUsernameForCallViewer(
      callerMember || { username: callerDisplay },
      targetViewerStars,
    );
    this.server.to(targetMember.socketId).emit('call:incoming', {
      callId,
      callType: normalizedCallType,
      fromUsername: callerDisplayForTarget,
      fromIcon: callerMember?.agentNickname ? null : callerMember?.icon || null,
      fromGender: callerMember?.gender || null,
      fromRoleName: callerMember?.agentNickname
        ? 'Misafir'
        : callerMember?.roleName || null,
      fromIsGuest:
        isCallerGuest || Boolean(callerMember?.agentNickname),
    });

    return { status: 'ok' };
  }

  @SubscribeMessage('call:accept')
  handleCallAccept(
    @MessageBody() payload: CallAcceptPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { callId } = payload ?? {};
    const call = callId ? this.getActiveCallsStore().get(callId) : null;
    if (!call || call.status !== 'ringing') {
      return { status: 'error', message: 'call_not_found' };
    }
    if (call.targetSocketId !== client.id) {
      return { status: 'error', message: 'not_authorized' };
    }

    call.status = 'active';
    call.acceptedAt = Date.now();
    if (call.timeoutId) {
      clearTimeout(call.timeoutId);
      call.timeoutId = undefined;
    }
    this.server
      .to(call.callerSocketId)
      .emit('call:accepted', { callId, callType: call.callType });
    return { status: 'ok' };
  }

  @SubscribeMessage('call:reject')
  handleCallReject(
    @MessageBody() payload: CallRejectPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { callId, reason } = payload ?? {};
    const call = callId ? this.getActiveCallsStore().get(callId) : null;
    if (!call || call.status !== 'ringing') {
      return { status: 'error', message: 'call_not_found' };
    }
    if (call.targetSocketId !== client.id) {
      return { status: 'error', message: 'not_authorized' };
    }

    this.server.to(call.callerSocketId).emit('call:rejected', {
      callId,
      callType: call.callType,
      reason,
    });
    this.clearActiveCall(callId);
    return { status: 'ok' };
  }

  @SubscribeMessage('call:cancel')
  handleCallCancel(
    @MessageBody() payload: CallCancelPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { callId } = payload ?? {};
    const call = callId ? this.getActiveCallsStore().get(callId) : null;
    if (!call || call.status !== 'ringing') {
      return { status: 'error', message: 'call_not_found' };
    }
    if (call.callerSocketId !== client.id) {
      return { status: 'error', message: 'not_authorized' };
    }

    this.server
      .to(call.targetSocketId)
      .emit('call:canceled', { callId, callType: call.callType });
    this.clearActiveCall(callId);
    return { status: 'ok' };
  }

  @SubscribeMessage('call:end')
  handleCallEnd(
    @MessageBody() payload: CallEndPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { callId, durationSec } = payload ?? {};
    const call = callId ? this.getActiveCallsStore().get(callId) : null;
    if (!call || call.status !== 'active') {
      return { status: 'error', message: 'call_not_found' };
    }
    if (
      call.callerSocketId !== client.id &&
      call.targetSocketId !== client.id
    ) {
      return { status: 'error', message: 'not_authorized' };
    }

    const otherSocketId =
      call.callerSocketId === client.id
        ? call.targetSocketId
        : call.callerSocketId;
    this.server.to(otherSocketId).emit('call:ended', {
      callId,
      callType: call.callType,
      durationSec,
    });
    this.clearActiveCall(callId);
    return { status: 'ok' };
  }

  @SubscribeMessage('voice:answer')
  async handleVoiceAnswer(
    @MessageBody() payload: VoiceAnswerPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, targetUsername, answer } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedTarget = this.normalize(targetUsername);

    if (!normalizedRoom || !normalizedTarget || !answer) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const targetMember = roomMembers?.get(normalizedTarget);

    if (!roomMembers || !targetMember) {
      return { status: 'error', message: 'Target user not found' };
    }

    const senderUsername = this.getUsernameBySocketId(
      normalizedRoom,
      client.id,
    );
    if (!senderUsername) {
      return { status: 'error', message: 'Sender not in room' };
    }

    this.server.to(targetMember.socketId).emit('voice:answer', {
      room: normalizedRoom,
      fromUsername: senderUsername,
      answer,
    });

    return { status: 'ok' };
  }

  @SubscribeMessage('voice:iceCandidate')
  async handleVoiceIceCandidate(
    @MessageBody() payload: VoiceIceCandidatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, targetUsername, candidate } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedTarget = this.normalize(targetUsername);

    if (!normalizedRoom || !normalizedTarget || !candidate) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const targetMember = roomMembers?.get(normalizedTarget);

    if (!roomMembers || !targetMember) {
      return { status: 'error', message: 'Target user not found' };
    }

    const senderUsername = this.getUsernameBySocketId(
      normalizedRoom,
      client.id,
    );
    if (!senderUsername) {
      return { status: 'error', message: 'Sender not in room' };
    }

    this.server.to(targetMember.socketId).emit('voice:iceCandidate', {
      room: normalizedRoom,
      fromUsername: senderUsername,
      candidate,
    });

    return { status: 'ok' };
  }

  @SubscribeMessage('voice:toggleMute')
  async handleVoiceToggleMute(
    @MessageBody() payload: VoiceToggleMutePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, isMuted } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);

    if (!normalizedRoom || !normalizedUsername || isMuted === undefined) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'Not authorized' };
    }

    if (!isMuted) {
      const muteStatus = this.isUserMutedForRoom(member);
      if (muteStatus.muted && muteStatus.reason) {
        this.emitMuteActionDenied(member, normalizedRoom, muteStatus.reason);
        return { status: 'error', message: muteStatus.reason };
      }

      if (member.micBanned) {
        client.emit('voice:error', { message: 'mic_banned' });
        return { status: 'error', message: 'mic_banned' };
      }
    }

    member.isMuted = isMuted;
    this.syncSocketPresenceFromMember(client, member);

    this.server.to(normalizedRoom).emit('voice:userMuted', {
      room: normalizedRoom,
      username: member.username,
      isMuted,
    });

    this.emitRoomUsers(normalizedRoom);
    this.server.emit('tenant:userStateUpdate', {
      tenantId: member.tenantId || 'tenant_master',
      username: member.username,
      isInVoiceChat: member.isInVoiceChat ?? false,
      isMuted: member.isMuted ?? false,
      isHandRaised: member.isHandRaised ?? false,
      isCameraOn: member.isCameraOn ?? false,
      handRaisedAt: member.handRaisedAt ?? null,
    });

    return { status: 'ok' };
  }

  @SubscribeMessage('voice:toggleState')
  async handleVoiceToggleState(
    @MessageBody() payload: VoiceUserStatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, isInVoiceChat, isMuted } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);

    if (!normalizedRoom || !normalizedUsername || isInVoiceChat === undefined) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'Not authorized' };
    }

    const muteStatus = this.isUserMutedForRoom(member);
    if (isInVoiceChat && (member.micBanned || muteStatus.muted)) {
      // Allow joining but force muted
      member.isInVoiceChat = true;
      member.isMuted = true;
    } else {
      member.isInVoiceChat = isInVoiceChat;
      if (isMuted !== undefined) {
        member.isMuted = isMuted;
      }
    }

    if (!member.isInVoiceChat) {
      member.isInVoiceSeat = false;
      member.voiceSeatJoinedAt = undefined;
      member.voiceSeatIndex = undefined;
    }
    this.syncSocketPresenceFromMember(client, member);

    this.server.to(normalizedRoom).emit('voice:userStateChanged', {
      room: normalizedRoom,
      username: member.username,
      isInVoiceChat: member.isInVoiceChat,
      isMuted: member.isMuted,
      isInVoiceSeat: member.isInVoiceSeat ?? false,
      voiceSeatJoinedAt: member.voiceSeatJoinedAt ?? null,
      voiceSeatIndex: member.voiceSeatIndex ?? null,
    });

    this.emitRoomUsers(normalizedRoom);
    this.server.emit('tenant:userStateUpdate', {
      tenantId: member.tenantId || 'tenant_master',
      username: member.username,
      isInVoiceChat: member.isInVoiceChat ?? false,
      isMuted: member.isMuted ?? false,
      isHandRaised: member.isHandRaised ?? false,
      isCameraOn: member.isCameraOn ?? false,
      handRaisedAt: member.handRaisedAt ?? null,
    });

    return { status: 'ok' };
  }

  @SubscribeMessage('voice:takeSeat')
  async handleVoiceTakeSeat(
    @MessageBody() payload: VoiceSeatPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username, seatIndex } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);
    const requestedSeatIndex =
      typeof seatIndex === 'number' && Number.isInteger(seatIndex)
        ? seatIndex
        : undefined;

    if (!normalizedRoom || !normalizedUsername) {
      return { status: 'error', message: 'Invalid payload' };
    }

    if (
      requestedSeatIndex !== undefined &&
      requestedSeatIndex < 0
    ) {
      return { status: 'error', message: 'Invalid seat index' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'Not authorized' };
    }

    if (member.statusModeName === 'Çatıda') {
      if (member.isInVoiceSeat || member.voiceSeatIndex !== undefined) {
        member.isInVoiceSeat = false;
        member.voiceSeatJoinedAt = undefined;
        member.voiceSeatIndex = undefined;
        this.syncSocketPresenceFromMember(client, member);
        this.server.to(normalizedRoom).emit('voice:seatChanged', {
          room: normalizedRoom,
          username: member.username,
          isInVoiceChat: member.isInVoiceChat ?? false,
          isMuted: member.isMuted ?? false,
          isInVoiceSeat: false,
          voiceSeatJoinedAt: null,
          voiceSeatIndex: null,
        });
        this.emitRoomUsers(normalizedRoom);
      }
      return { status: 'error', message: 'on_roof' };
    }

    let microphoneLimit = 5;
    try {
      const roomEntity = await this.getRoomRepository()
        ?.createQueryBuilder('room')
        .where('LOWER(room.name) = :roomName', { roomName: normalizedRoom })
        .orWhere('LOWER(room.voiceId) = :voiceId', { voiceId: normalizedRoom })
        .getOne();
      microphoneLimit = Math.max(1, Math.min(20, Number(roomEntity?.microphoneLimit ?? 5)));
    } catch {
      microphoneLimit = 5;
    }

    if (!member.isInVoiceSeat && this.getActiveVoiceSeatCount(roomMembers) >= microphoneLimit) {
      return { status: 'error', message: 'voice_seats_full' };
    }
    if (requestedSeatIndex !== undefined && requestedSeatIndex >= microphoneLimit) {
      return { status: 'error', message: 'Invalid seat index' };
    }

    if (requestedSeatIndex !== undefined) {
      const seatTaken = Array.from(roomMembers.values()).some((roomMember) => {
        const sameUser =
          this.normalize(roomMember.username) === normalizedUsername;
        return (
          !sameUser &&
          roomMember.isInVoiceSeat === true &&
          roomMember.voiceSeatIndex === requestedSeatIndex
        );
      });

      if (seatTaken) {
        return { status: 'error', message: 'voice_seat_taken' };
      }
    }

    member.isInVoiceSeat = true;
    member.isInVoiceChat = true;
    member.voiceSeatJoinedAt = member.voiceSeatJoinedAt ?? Date.now();
    member.voiceSeatIndex = requestedSeatIndex ?? member.voiceSeatIndex;
    this.syncSocketPresenceFromMember(client, member);

    this.server.to(normalizedRoom).emit('voice:seatChanged', {
      room: normalizedRoom,
      username: member.username,
      isInVoiceChat: member.isInVoiceChat,
      isMuted: member.isMuted ?? false,
      isInVoiceSeat: true,
      voiceSeatJoinedAt: member.voiceSeatJoinedAt,
      voiceSeatIndex: member.voiceSeatIndex ?? null,
    });
    this.emitRoomUsers(normalizedRoom);

    return {
      status: 'ok',
      isInVoiceSeat: true,
      voiceSeatJoinedAt: member.voiceSeatJoinedAt,
      voiceSeatIndex: member.voiceSeatIndex ?? null,
    };
  }

  @SubscribeMessage('voice:releaseSeat')
  async handleVoiceReleaseSeat(
    @MessageBody() payload: VoiceSeatPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { room, username } = payload ?? {};
    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);

    if (!normalizedRoom || !normalizedUsername) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!roomMembers || !member || member.socketId !== client.id) {
      return { status: 'error', message: 'Not authorized' };
    }

    member.isInVoiceSeat = false;
    member.voiceSeatJoinedAt = undefined;
    member.voiceSeatIndex = undefined;
    this.syncSocketPresenceFromMember(client, member);

    this.server.to(normalizedRoom).emit('voice:seatChanged', {
      room: normalizedRoom,
      username: member.username,
      isInVoiceSeat: false,
      voiceSeatJoinedAt: null,
      voiceSeatIndex: null,
    });
    this.emitRoomUsers(normalizedRoom);

    return {
      status: 'ok',
      isInVoiceSeat: false,
      isInVoiceChat: member.isInVoiceChat ?? false,
    };
  }

  @SubscribeMessage('voice:speaking')
  handleVoiceSpeaking(
    @MessageBody()
    data: { room: string; username: string; isSpeaking: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    // Odadaki diğer kullanıcılara yayınla (gönderen hariç)
    client.to(data.room).emit('voice:userSpeaking', {
      username: data.username,
      isSpeaking: data.isSpeaking,
    });
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    client: Socket,
    payload: { room: string; username: string },
  ) {
    const normalizedRoom = this.normalize(payload?.room);
    const normalizedUsername = this.normalize(payload?.username);
    if (!normalizedRoom || !normalizedUsername) return;

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);
    if (!member || member.socketId !== client.id) return;

    const muteStatus = this.isUserMutedForRoom(member);
    if (muteStatus.muted && muteStatus.reason) {
      this.emitMuteActionDenied(member, normalizedRoom, muteStatus.reason);
      return;
    }

    // O odadaki diğer herkese (gönderen hariç) bildir
    client.to(normalizedRoom).emit('room:typing', {
      username: member.username,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    client: Socket,
    payload: { room: string; username: string },
  ) {
    client.to(payload.room).emit('room:typing', {
      username: payload.username,
      isTyping: false,
    });
  }

  @SubscribeMessage('moderation:toggleRoomMute')
  async handleModerationToggleRoomMute(
    @MessageBody() payload: ModerationToggleRoomMutePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const normalizedRoom = this.resolveRoomKey(payload?.room || '');
      const normalizedTarget = this.normalize(payload?.targetUsername);
      const normalizedSender = this.normalize((client as any).username || '');

      if (!normalizedRoom || !normalizedTarget || !normalizedSender) {
        return { status: 'error', message: 'invalid_payload' };
      }

      const roomMembers = this.getRoomsStore().get(normalizedRoom);
      const senderMember = roomMembers?.get(normalizedSender);
      const targetMember = roomMembers?.get(normalizedTarget);

      if (
        !roomMembers ||
        !senderMember ||
        senderMember.socketId !== client.id
      ) {
        return { status: 'error', message: 'not_in_room' };
      }

      if (!targetMember) {
        return { status: 'error', message: 'target_not_found_in_room' };
      }

      if (normalizedSender === normalizedTarget) {
        return { status: 'error', message: 'cannot_mute_self' };
      }

      const senderIsRoot = senderMember.username?.toLowerCase() === 'root';
      const senderStars = senderMember.roleStarCount ?? 0;
      const targetStars = targetMember.roleStarCount ?? 0;

      if (!senderIsRoot) {
        const persistedSender = await this.findPersistedUserByUsername(
          senderMember.username,
        );
        if (
          !hasPermissionForUser(
            persistedSender,
            PERMISSION_LABELS.MICROPHONE_MODERATION,
          )
        ) {
          return { status: 'error', message: 'insufficient_privileges' };
        }
      }

      if (!senderIsRoot && senderStars <= targetStars) {
        return {
          status: 'error',
          message: 'insufficient_star_for_room_mute',
        };
      }

      const persistedUser = await this.findPersistedUserByUsername(
        targetMember.username,
      );
      if (
        isProtectedActionBlocked({
          actorStarCount: senderStars,
          isRoot: senderIsRoot,
          targetProtection: persistedUser?.protection,
          targetProtectedByStarCount: persistedUser?.protectedByStarCount,
        })
      ) {
        return { status: 'error', message: 'target_is_protected' };
      }

      if (
        targetMember.roomMuted &&
        !senderIsRoot &&
        senderStars < (targetMember.roomMutedByStarCount ?? 0)
      ) {
        return {
          status: 'error',
          message: 'insufficient_star_to_lift_room_mute',
        };
      }

      const roomMuted = !targetMember.roomMuted;
      const updated = this.setRoomMuteState(
        targetMember.username,
        normalizedRoom,
        roomMuted,
        roomMuted ? senderStars : 0,
        senderMember.username,
      );

      if (!updated) {
        return { status: 'error', message: 'target_not_found_in_room' };
      }

      return {
        status: 'ok',
        room: normalizedRoom,
        username: targetMember.username,
        roomMuted,
      };
    } catch (error) {
      this.logger?.error?.(
        `moderation:toggleRoomMute failed for client ${client.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { status: 'error', message: 'unknown_error' };
    }
  }

  @SubscribeMessage('moderation:dropFromMic')
  async handleModerationDropFromMic(
    @MessageBody() payload: ModerationDropFromMicPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedRoom = this.resolveRoomKey(payload?.room || '');
    const normalizedTarget = this.normalize(payload?.targetUsername);
    const normalizedSender = this.normalize((client as any).username || '');

    if (!normalizedRoom || !normalizedTarget || !normalizedSender) {
      return { status: 'error', message: 'invalid_payload' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const senderMember = roomMembers?.get(normalizedSender);
    const targetMember = roomMembers?.get(normalizedTarget);

    if (!roomMembers || !senderMember || senderMember.socketId !== client.id) {
      return { status: 'error', message: 'not_in_room' };
    }

    if (!targetMember) {
      return { status: 'error', message: 'target_not_found_in_room' };
    }

    if (normalizedSender === normalizedTarget) {
      return { status: 'error', message: 'cannot_mute_self' };
    }

    const senderIsRoot = senderMember.username?.toLowerCase() === 'root';
    const senderStars = senderMember.roleStarCount ?? 0;
    const targetStars = targetMember.roleStarCount ?? 0;

    if (!senderIsRoot) {
      const persistedSender = await this.findPersistedUserByUsername(
        senderMember.username,
      );
      if (
        !hasPermissionForUser(
          persistedSender,
          PERMISSION_LABELS.MICROPHONE_MODERATION,
        )
      ) {
        return { status: 'error', message: 'insufficient_privileges' };
      }
    }

    if (!senderIsRoot && senderStars <= targetStars) {
      return {
        status: 'error',
        message: 'insufficient_star_for_force_mic_drop',
      };
    }

    const persistedUser = await this.findPersistedUserByUsername(
      targetMember.username,
    );
    if (
      isProtectedActionBlocked({
        actorStarCount: senderStars,
        isRoot: senderIsRoot,
        targetProtection: persistedUser?.protection,
        targetProtectedByStarCount: persistedUser?.protectedByStarCount,
      })
    ) {
      return { status: 'error', message: 'target_is_protected' };
    }

    if (!targetMember.isInVoiceChat) {
      return { status: 'error', message: 'target_not_in_voice' };
    }

    const wasInVoiceSeat =
      targetMember.isInVoiceSeat === true ||
      targetMember.voiceSeatJoinedAt !== undefined ||
      targetMember.voiceSeatIndex !== undefined;

    targetMember.isMuted = true;
    targetMember.isInVoiceChat = false;
    targetMember.isInVoiceSeat = false;
    targetMember.voiceSeatJoinedAt = undefined;
    targetMember.voiceSeatIndex = undefined;
    this.syncSocketPresenceFromMember(targetMember.socketId, targetMember);

    const dropEventSockets = await this.server.in(normalizedRoom).fetchSockets();
    for (const s of dropEventSockets) {
      const userStarCount = (s as any).roleStarCount || 0;
      const socketUsername = (s as any).username?.toLowerCase();
      const isDropTarget =
        socketUsername === targetMember.username?.toLowerCase();
      if (
        userStarCount >= senderStars ||
        socketUsername === 'root' ||
        isDropTarget
      ) {
        s.emit('voice:userMuted', {
          room: normalizedRoom,
          username: targetMember.username,
          isMuted: true,
        });
      }
    }
    if (wasInVoiceSeat) {
      this.server.to(normalizedRoom).emit('voice:seatChanged', {
        room: normalizedRoom,
        username: targetMember.username,
        isInVoiceChat: targetMember.isInVoiceChat ?? false,
        isMuted: true,
        isInVoiceSeat: false,
        voiceSeatJoinedAt: null,
        voiceSeatIndex: null,
      });
    }
    this.server.to(targetMember.socketId).emit('moderation:forceMute', {
      room: normalizedRoom,
      username: targetMember.username,
      reason: 'mic_drop',
    });

    this.emitRoomUsers(normalizedRoom);
    this.server.emit('tenant:userStateUpdate', {
      tenantId: targetMember.tenantId || 'tenant_master',
      username: targetMember.username,
      isInVoiceChat: targetMember.isInVoiceChat ?? false,
      isMuted: targetMember.isMuted ?? true,
      isInVoiceSeat: false,
      voiceSeatJoinedAt: null,
      voiceSeatIndex: null,
      isHandRaised: targetMember.isHandRaised ?? false,
      isCameraOn: targetMember.isCameraOn ?? false,
      handRaisedAt: targetMember.handRaisedAt ?? null,
    });

    return {
      status: 'ok',
      room: normalizedRoom,
      username: targetMember.username,
      isMuted: true,
      isInVoiceChat: false,
      isInVoiceSeat: false,
    };
  }

  @SubscribeMessage('moderation:toggleGlobalMute')
  async handleModerationToggleGlobalMute(
    @MessageBody() payload: ModerationToggleGlobalMutePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const normalizedTarget = this.normalize(payload?.targetUsername);
    const senderUsername = String((client as any).username || '').trim();
    const normalizedSender = this.normalize(senderUsername);

    if (!normalizedTarget || !normalizedSender) {
      return { status: 'error', message: 'invalid_payload' };
    }

    if (normalizedTarget === normalizedSender) {
      return { status: 'error', message: 'cannot_mute_self' };
    }

    const senderStars = Number((client as any).roleStarCount || 0);
    const senderIsRoot = normalizedSender === 'root';

    if (!senderIsRoot) {
      const persistedSender =
        await this.findPersistedUserByUsername(senderUsername);
      if (
        !hasPermissionForUser(
          persistedSender,
          PERMISSION_LABELS.MICROPHONE_MODERATION,
        )
      ) {
        return { status: 'error', message: 'insufficient_privileges' };
      }
    }

    const targetMember = this.findActiveMemberForModeration(
      payload.targetUsername,
    );
    const persistedUser = await this.findPersistedUserByUsername(
      payload.targetUsername,
    );

    if (!targetMember && !persistedUser) {
      return { status: 'error', message: 'target_not_found' };
    }

    const effectiveTargetUsername =
      targetMember?.username ||
      persistedUser?.username ||
      payload.targetUsername;
    const targetStar =
      targetMember?.roleStarCount ?? persistedUser?.role?.starCount ?? 0;
    const currentGlobalMuted =
      persistedUser?.globalMuted ?? targetMember?.globalMuted ?? false;
    const currentGlobalMutedByStarCount =
      persistedUser?.globalMutedByStarCount ??
      targetMember?.globalMutedByStarCount ??
      0;

    if (!senderIsRoot && senderStars <= targetStar) {
      return { status: 'error', message: 'insufficient_star_for_global_mute' };
    }

    if (
      currentGlobalMuted &&
      !senderIsRoot &&
      senderStars < currentGlobalMutedByStarCount
    ) {
      return {
        status: 'error',
        message: 'insufficient_star_to_lift_global_mute',
      };
    }

    const globalMuted = !currentGlobalMuted;

    if (persistedUser) {
      if (
        isProtectedActionBlocked({
          actorStarCount: senderStars,
          isRoot: senderIsRoot,
          targetProtection: persistedUser.protection,
          targetProtectedByStarCount: persistedUser.protectedByStarCount,
        })
      ) {
        return { status: 'error', message: 'target_is_protected' };
      }

      persistedUser.globalMuted = globalMuted;
      persistedUser.globalMutedByStarCount = globalMuted ? senderStars : 0;
      await this.userRepository.save(persistedUser);
    }

    this.setGlobalMuteState(
      effectiveTargetUsername,
      globalMuted,
      globalMuted ? senderStars : 0,
      senderUsername || 'Sistem',
    );

    return {
      status: 'ok',
      username: effectiveTargetUsername,
      globalMuted,
    };
  }

  @SubscribeMessage('user:styleUpdate')
  handleStyleUpdate(
    @MessageBody() payload: StyleUpdatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger?.log?.(
      `user:styleUpdate event received from ${client.id}:`,
      payload,
    );
    const { room, username, fontName, granite, nickColor, userGif } =
      payload ?? {};

    const normalizedRoom = this.normalize(room);
    const normalizedUsername = this.normalize(username);

    if (!normalizedRoom || !normalizedUsername) {
      this.logger?.warn?.(`Invalid styleUpdate payload from ${client.id}`);
      return { status: 'error', message: 'room and username are required' };
    }

    const roomMembers = this.getRoomsStore().get(normalizedRoom);
    const member = roomMembers?.get(normalizedUsername);

    if (!member) {
      this.logger?.warn?.(
        `User ${normalizedUsername} not found in room ${normalizedRoom}`,
      );
      return { status: 'error', message: 'user_not_found_in_room' };
    }

    // Update member's style
    if (fontName !== undefined) {
      member.fontName = fontName?.trim() || undefined;
    }
    if (granite !== undefined) {
      member.granite = granite?.trim() || undefined;
    }
    if (nickColor !== undefined) {
      member.nickColor = nickColor?.trim() || undefined;
    }
    if (userGif !== undefined) {
      member.userGif = userGif?.trim() || undefined;
    }

    // Broadcast to all users in the room (including sender)
    this.server.to(normalizedRoom).emit('user:styleUpdated', {
      room: normalizedRoom,
      username: member.username,
      fontName: member.fontName,
      granite: member.granite,
      nickColor: member.nickColor,
      userGif: member.userGif,
    });

    this.logger?.log?.(
      `Style updated for ${member.username} in room ${normalizedRoom}`,
    );

    return { status: 'ok' };
  }

  private getRoomUsers(roomKey: string): RoomUser[] {
    const members = this.getRoomsStore().get(roomKey);
    if (!members) {
      return [];
    }

    const users: RoomUser[] = [];

    for (const [usernameKey, member] of members.entries()) {
      const isSocketActive = this.server?.sockets?.sockets?.has(member.socketId);
      
      if (!isSocketActive && !member.isBot) {
        members.delete(usernameKey);
        continue;
      }

      const roleVisual = this.resolveRoleVisualForMember(member);

      users.push({
        id: member.socketId,
        userId: member.userId,
        username: member.username,
        loginHistoryId: member.loginHistoryId,
        displayUsername: this.getDisplayUsername(member),
        gender: member.gender,
        isGuest: member.isGuest,
        guestAlias: member.guestAlias,
        guestAliasReleased: member.guestAliasReleased,
        tenantId: member.tenantId,
        isInVoiceChat: member.isInVoiceChat ?? false,
        isMuted: member.isMuted ?? false,
        isInVoiceSeat: member.isInVoiceSeat ?? false,
        voiceSeatJoinedAt: member.voiceSeatJoinedAt,
        voiceSeatIndex: member.voiceSeatIndex,
        isHandRaised: member.isHandRaised ?? false,
        isCameraOn: member.isCameraOn ?? false,
        isBot: member.isBot ?? false,
        deviceType: member.deviceType,
        device: member.device,
        clientType: member.clientType,
        statusModeId: member.statusModeId,
        statusModeName: member.statusModeName,
        roleName: roleVisual.roleName,
        roleStarColor: roleVisual.roleStarColor,
        roleStarCount: roleVisual.roleStarCount,
        roleIcon: roleVisual.roleIcon,
        frame: member.frame,
        icon: member.icon,
        fontName: member.fontName,
        granite: member.granite,
        nickColor: member.nickColor,
        userGif: member.userGif,
        flashNick: member.flashNick,
        joinEffect: member.joinEffect,
        agentNickname: member.agentNickname,
        micBanned: member.micBanned || false,
        micBannedByStarCount: member.micBannedByStarCount ?? 0,
        cameraBanned: member.cameraBanned || false,
        cameraBannedByStarCount: member.cameraBannedByStarCount ?? 0,
        roomMuted: member.roomMuted || false,
        roomMutedByStarCount: member.roomMutedByStarCount ?? 0,
        globalMuted: member.globalMuted || false,
        globalMutedByStarCount: member.globalMutedByStarCount ?? 0,
      });
    }

    if (members.size === 0) {
      this.getRoomsStore().delete(roomKey);
    }

    return users;
  }

  private async resolvePersistentBotRoomKey(room?: string | null): Promise<string | null> {
    const normalizedRoom = this.normalize(room ?? undefined);
    if (!normalizedRoom) return null;
    if (this.isLobbyRoomAlias(normalizedRoom)) {
      return this.resolveCanonicalLobbyRoomKey();
    }

    const roomRepository = this.getRoomRepository();
    if (!roomRepository?.createQueryBuilder) {
      return room?.trim() || null;
    }
    const roomEntity = await roomRepository
      .createQueryBuilder('room')
      .where('LOWER(room.name) = :roomName', { roomName: normalizedRoom })
      .orWhere('LOWER(room.voiceId) = :voiceId', { voiceId: normalizedRoom })
      .getOne();

    const resolvedRoomKey = roomEntity?.voiceId || roomEntity?.name || room?.trim() || null;
    const resolvedRoomName = roomEntity?.name?.trim();
    if (resolvedRoomKey && resolvedRoomName) {
      this.getRoomNamesStore().set(resolvedRoomKey, resolvedRoomName);
    }

    return resolvedRoomKey;
  }

  private async getPersistentBotUsersForRoom(roomKey: string): Promise<RoomUser[]> {
    const normalizedTargetRoom = this.normalize(roomKey);
    if (!normalizedTargetRoom) return [];

    const runtimeBotsForRoom = Array.from(this.getPersistentBotsStore().values()).filter(
      (bot) => this.normalize(bot.roomKey) === normalizedTargetRoom,
    );
    if (runtimeBotsForRoom.length > 0) {
      return runtimeBotsForRoom.map((bot) => ({
        id: bot.socketId,
        username: bot.username,
        displayUsername: bot.username,
        gender: bot.gender,
        isGuest: false,
        isBot: true,
        isInVoiceChat: bot.isInVoiceChat ?? false,
        isMuted: bot.isMuted ?? false,
        isHandRaised: bot.isHandRaised ?? false,
        isCameraOn: bot.isCameraOn ?? false,
        handRaisedAt: bot.handRaisedAt,
        statusModeName: bot.statusModeName,
        roleName: bot.roleName,
        roleStarColor: bot.roleStarColor,
        roleStarCount: bot.roleStarCount,
        roleIcon: bot.roleIcon,
        icon: bot.icon,
        fontName: bot.fontName,
        granite: bot.granite,
        userGif: bot.userGif,
        deviceType: bot.deviceType,
        device: bot.device,
        clientType: bot.clientType,
        rooms: [
          {
            roomKey,
            roomName: this.getRoomDisplayName(roomKey),
          },
        ],
      }));
    }

    const botRepository = this.getBotRepository();
    if (!botRepository) {
      return [];
    }

    let bots: Bot[] = [];
    try {
      bots = await botRepository.find();
    } catch (error) {
      this.logWarn(
        `Persistent bot lookup failed for room "${roomKey}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
    const botUsers: RoomUser[] = [];

    for (const bot of bots) {
      let botRoomKey: string | null = null;
      try {
        botRoomKey = await this.resolvePersistentBotRoomKey(bot.room);
      } catch (error) {
        this.logWarn(
          `Persistent bot room lookup failed for "${bot.username}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }
      if (this.normalize(botRoomKey ?? undefined) !== normalizedTargetRoom) {
        continue;
      }
      const roleVisual = await this.resolveRoleVisualByName(bot.role);
      const runtimeBot = this.getPersistentBotsStore().get(
        this.normalize(bot.username) ?? '',
      );

      botUsers.push({
        id: `bot_${bot.id}`,
        username: bot.username,
        displayUsername: bot.username,
        gender: bot.gender,
        isGuest: false,
        isBot: true,
        isAI: bot.isAI === true,
        isInVoiceChat: runtimeBot?.isInVoiceChat ?? false,
        isMuted: runtimeBot?.isMuted ?? false,
        isHandRaised: runtimeBot?.isHandRaised ?? false,
        isCameraOn: runtimeBot?.isCameraOn ?? false,
        handRaisedAt: runtimeBot?.handRaisedAt,
        statusModeName: bot.statusMode ?? undefined,
        roleName: roleVisual.roleName ?? bot.role ?? undefined,
        roleStarColor: roleVisual.roleStarColor,
        roleStarCount: roleVisual.roleStarCount,
        roleIcon: roleVisual.roleIcon,
        icon: bot.avatar ?? undefined,
        fontName: bot.fontName ?? undefined,
        granite: bot.granite ?? undefined,
        userGif: bot.userGif ?? undefined,
        deviceType: bot.loginType ?? undefined,
        device: bot.loginType ?? undefined,
        clientType: bot.loginType ?? undefined,
        rooms: [
          {
            roomKey,
            roomName: this.getRoomDisplayName(roomKey),
          },
        ],
      });
    }

    return botUsers;
  }

  private async getPersistentBotUsersForTenantSnapshot(): Promise<
    Array<
      Omit<RoomUser, 'id'> & {
        socketId: string;
      }
    >
  > {
    const runtimeBots = Array.from(this.getPersistentBotsStore().values());
    if (runtimeBots.length > 0) {
      return runtimeBots.map((bot) => ({
        socketId: bot.socketId,
        username: bot.username,
        displayUsername: bot.username,
        gender: bot.gender,
        isGuest: false,
        isBot: true,
        isAI: bot.isAI === true,
        rooms: [
          {
            roomKey: bot.roomKey,
            roomName: this.getRoomDisplayName(bot.roomKey),
          },
        ],
        isInVoiceChat: bot.isInVoiceChat ?? false,
        isMuted: bot.isMuted ?? false,
        isHandRaised: bot.isHandRaised ?? false,
        isCameraOn: bot.isCameraOn ?? false,
        handRaisedAt: bot.handRaisedAt,
        statusModeName: bot.statusModeName,
        roleName: bot.roleName,
        roleStarColor: bot.roleStarColor,
        roleStarCount: bot.roleStarCount,
        roleIcon: bot.roleIcon,
        icon: bot.icon,
        fontName: bot.fontName,
        granite: bot.granite,
        userGif: bot.userGif,
        deviceType: bot.deviceType,
        device: bot.device,
        clientType: bot.clientType,
      }));
    }

    const botRepository = this.getBotRepository();
    if (!botRepository) {
      return [];
    }

    let bots: Bot[] = [];
    try {
      bots = await botRepository.find();
    } catch (error) {
      this.logWarn(
        `Persistent bot tenant snapshot lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
    const botUsers: Array<Omit<RoomUser, 'id'> & { socketId: string }> = [];

    for (const bot of bots) {
      let botRoomKey: string | null = null;
      try {
        botRoomKey = await this.resolvePersistentBotRoomKey(bot.room);
      } catch (error) {
        this.logWarn(
          `Persistent bot room lookup failed for "${bot.username}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }
      if (!botRoomKey) {
        continue;
      }
      const roleVisual = await this.resolveRoleVisualByName(bot.role);
      const runtimeBot = this.getPersistentBotsStore().get(
        this.normalize(bot.username) ?? '',
      );

      botUsers.push({
        socketId: `bot_${bot.id}`,
        username: bot.username,
        displayUsername: bot.username,
        gender: bot.gender,
        isGuest: false,
        isBot: true,
        rooms: [
          {
            roomKey: botRoomKey,
            roomName: this.getRoomDisplayName(botRoomKey),
          },
        ],
        isInVoiceChat: runtimeBot?.isInVoiceChat ?? false,
        isMuted: runtimeBot?.isMuted ?? false,
        isHandRaised: runtimeBot?.isHandRaised ?? false,
        isCameraOn: runtimeBot?.isCameraOn ?? false,
        handRaisedAt: runtimeBot?.handRaisedAt,
        statusModeName: bot.statusMode ?? undefined,
        roleName: roleVisual.roleName ?? bot.role ?? undefined,
        roleStarColor: roleVisual.roleStarColor,
        roleStarCount: roleVisual.roleStarCount,
        roleIcon: roleVisual.roleIcon,
        icon: bot.avatar ?? undefined,
        fontName: bot.fontName ?? undefined,
        granite: bot.granite ?? undefined,
        userGif: bot.userGif ?? undefined,
        deviceType: bot.loginType ?? undefined,
        device: bot.loginType ?? undefined,
        clientType: bot.loginType ?? undefined,
      });
    }

    return botUsers;
  }

  private mergeRoomUsersWithPersistentBots(
    liveUsers: RoomUser[],
    botUsers: RoomUser[],
  ): RoomUser[] {
    const byUsername = new Map<string, RoomUser>();
    for (const user of liveUsers) {
      byUsername.set(this.normalize(user.username) || user.id, user);
    }
    for (const bot of botUsers) {
      byUsername.set(this.normalize(bot.username) || bot.id, bot);
    }
    return Array.from(byUsername.values());
  }

  private getRoomUserCount(roomKey: string): number {
    const mapCount = this.getRoomsStore().get(roomKey)?.size ?? 0;
    const adapterCount =
      this.server?.sockets?.adapter?.rooms?.get(roomKey)?.size ?? 0;

    let socketRoomsCount = 0;
    for (const [socketId, rooms] of this.getSocketRoomsStore().entries()) {
      if (rooms.has(roomKey) && this.server?.sockets?.sockets?.has(socketId)) {
        socketRoomsCount += 1;
      }
    }

    return Math.max(mapCount, adapterCount, socketRoomsCount);
  }

  private getActiveTenantUsers(tenantId: string): {
    count: number;
    users: Array<{
      socketId: string;
      username: string;
      displayUsername?: string;
      gender: 'male' | 'female';
      isGuest: boolean;
      guestAlias?: string;
      guestAliasReleased?: boolean;
      rooms: Array<{ roomKey: string; roomName: string }>;
      statusModeId?: number;
      statusModeName?: string;
      roleName?: string;
      roleStarColor?: string;
      roleStarCount?: number;
      roleIcon?: string;
      frame?: string;
      icon?: string;
      fontName?: string;
      granite?: string;
      nickColor?: string;
      userGif?: string;
      flashNick?: string | null;
      joinEffect?: string;
      agentNickname?: string;
      micBanned?: boolean;
      micBannedByStarCount?: number;
      cameraBanned?: boolean;
      cameraBannedByStarCount?: number;
      roomMuted?: boolean;
      roomMutedByStarCount?: number;
      globalMuted?: boolean;
      globalMutedByStarCount?: number;
      isBot?: boolean;
      deviceType?: string;
      device?: string;
      clientType?: string;
    }>;
  } {
    this.repairMissingRoomMembersFromSocketState({ tenantId });

    const activeSockets = this.getServer()?.sockets?.sockets;
    const normalizedTenantId = this.normalizeTenantScope(tenantId) ?? 'master';

    // socketId bazlı kullanıcı bilgilerini ve bulundukları odaları takip et
    const userMap = new Map<
      string,
      {
        socketId: string;
        username: string;
        displayUsername?: string;
        gender: 'male' | 'female';
        isGuest: boolean;
        guestAlias?: string;
        guestAliasReleased?: boolean;
        rooms: Array<{ roomKey: string; roomName: string }>;
        statusModeId?: number;
        statusModeName?: string;
        roleName?: string;
        roleStarColor?: string;
        roleStarCount?: number;
        roleIcon?: string;
        frame?: string;
        icon?: string;
        fontName?: string;
        granite?: string;
        nickColor?: string;
        userGif?: string;
        flashNick?: string | null;
        joinEffect?: string;
        agentNickname?: string;
        micBanned?: boolean;
        micBannedByStarCount?: number;
        cameraBanned?: boolean;
        cameraBannedByStarCount?: number;
        roomMuted?: boolean;
        roomMutedByStarCount?: number;
        globalMuted?: boolean;
        globalMutedByStarCount?: number;
        isBot?: boolean;
        deviceType?: string;
        device?: string;
        clientType?: string;
        isInVoiceChat?: boolean;
        isMuted?: boolean;
        isHandRaised?: boolean;
        isCameraOn?: boolean;
        handRaisedAt?: number;
      }
    >();

    for (const [socketId, roomKeys] of this.getSocketRoomsStore().entries()) {
      const socket = activeSockets?.get(socketId);
      if (!socket) {
        continue;
      }

      const stateMember = this.buildRoomMemberFromSocketState(socket);
      if (!stateMember) {
        continue;
      }

      const memberTenantId =
        this.normalizeTenantScope(stateMember.tenantId) ?? 'master';
      if (memberTenantId !== normalizedTenantId) {
        continue;
      }

      const roleVisual = this.resolveRoleVisualForMember(stateMember);

      const rooms = Array.from(roomKeys.values())
        .filter((roomKey) => roomKey && roomKey !== socketId)
        .map((roomKey) => ({
          roomKey,
          roomName: this.getRoomNamesStore().get(roomKey) || roomKey,
        }));

      userMap.set(socketId, {
        socketId,
        username: stateMember.username,
        displayUsername: this.getDisplayUsername(stateMember),
        gender: stateMember.gender,
        isGuest: stateMember.isGuest,
        guestAlias: stateMember.guestAlias,
        guestAliasReleased: stateMember.guestAliasReleased,
        rooms,
        statusModeId: stateMember.statusModeId,
        statusModeName: stateMember.statusModeName,
        roleName: roleVisual.roleName,
        roleStarColor: roleVisual.roleStarColor,
        roleStarCount: roleVisual.roleStarCount,
        roleIcon: roleVisual.roleIcon,
        frame: stateMember.frame,
        icon: stateMember.icon,
        fontName: stateMember.fontName,
        granite: stateMember.granite,
        nickColor: stateMember.nickColor,
        userGif: stateMember.userGif,
        flashNick: stateMember.flashNick,
        joinEffect: stateMember.joinEffect,
        agentNickname: stateMember.agentNickname,
        micBanned: stateMember.micBanned,
        micBannedByStarCount: stateMember.micBannedByStarCount,
        cameraBanned: stateMember.cameraBanned,
        cameraBannedByStarCount: stateMember.cameraBannedByStarCount,
        roomMuted: stateMember.roomMuted,
        roomMutedByStarCount: stateMember.roomMutedByStarCount,
        globalMuted: stateMember.globalMuted,
        globalMutedByStarCount: stateMember.globalMutedByStarCount,
        isInVoiceChat: stateMember.isInVoiceChat ?? false,
        isMuted: stateMember.isMuted ?? false,
        isHandRaised: stateMember.isHandRaised ?? false,
        isCameraOn: stateMember.isCameraOn ?? false,
        handRaisedAt: stateMember.handRaisedAt,
        isBot: stateMember.isBot ?? false,
        deviceType: stateMember.deviceType,
        device: stateMember.device,
        clientType: stateMember.clientType,
      });
    }

    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      for (const member of members.values()) {
        const isSocketActive = activeSockets?.has(member.socketId);
        if (!isSocketActive && !member.isBot) {
          continue;
        }

        const memberTenantId =
          this.normalizeTenantScope(member.tenantId) ?? 'master';
        if (memberTenantId !== normalizedTenantId) {
          continue;
        }

        const roleVisual = this.resolveRoleVisualForMember(member);
        let existingUser = userMap.get(member.socketId);
        if (!existingUser) {
          existingUser = {
            socketId: member.socketId,
            username: member.username,
            displayUsername: this.getDisplayUsername(member),
            gender: member.gender,
            isGuest: member.isGuest,
            guestAlias: member.guestAlias,
            guestAliasReleased: member.guestAliasReleased,
            rooms: [],
            statusModeId: member.statusModeId,
            statusModeName: member.statusModeName,
            roleName: roleVisual.roleName,
            roleStarColor: roleVisual.roleStarColor,
            roleStarCount: roleVisual.roleStarCount,
            roleIcon: roleVisual.roleIcon,
            frame: member.frame,
            icon: member.icon,
            fontName: member.fontName,
            granite: member.granite,
            nickColor: member.nickColor,
            userGif: member.userGif,
            flashNick: member.flashNick,
            joinEffect: member.joinEffect,
            agentNickname: member.agentNickname,
            micBanned: member.micBanned,
            micBannedByStarCount: member.micBannedByStarCount,
            cameraBanned: member.cameraBanned,
            cameraBannedByStarCount: member.cameraBannedByStarCount,
            roomMuted: member.roomMuted,
            roomMutedByStarCount: member.roomMutedByStarCount,
            globalMuted: member.globalMuted,
            globalMutedByStarCount: member.globalMutedByStarCount,
            isInVoiceChat: member.isInVoiceChat ?? false,
            isMuted: member.isMuted ?? false,
            isHandRaised: member.isHandRaised ?? false,
            isCameraOn: member.isCameraOn ?? false,
            handRaisedAt: member.handRaisedAt,
            isBot: member.isBot ?? false,
            deviceType: member.deviceType,
            device: member.device,
            clientType: member.clientType,
          };
          userMap.set(member.socketId, existingUser);
        }

        existingUser.username = member.username;
        existingUser.displayUsername = this.getDisplayUsername(member);
        existingUser.gender = member.gender;
        existingUser.isGuest = member.isGuest;
        existingUser.guestAlias = member.guestAlias;
        existingUser.guestAliasReleased = member.guestAliasReleased;
        existingUser.statusModeId = member.statusModeId;
        existingUser.statusModeName = member.statusModeName;
        existingUser.roleName = roleVisual.roleName;
        existingUser.roleStarColor = roleVisual.roleStarColor;
        existingUser.roleStarCount = roleVisual.roleStarCount;
        existingUser.roleIcon = roleVisual.roleIcon;
        existingUser.frame = member.frame;
        existingUser.icon = member.icon;
        existingUser.fontName = member.fontName;
        existingUser.granite = member.granite;
        existingUser.nickColor = member.nickColor;
        existingUser.userGif = member.userGif;
        existingUser.flashNick = member.flashNick;
        existingUser.joinEffect = member.joinEffect;
        existingUser.agentNickname = member.agentNickname;
        existingUser.isBot = member.isBot ?? false;
        existingUser.deviceType = member.deviceType;
        existingUser.device = member.device;
        existingUser.clientType = member.clientType;

        if (!existingUser.rooms.some((room) => room.roomKey === roomKey)) {
          existingUser.rooms.push({
            roomKey,
            roomName: this.getRoomNamesStore().get(roomKey) || roomKey,
          });
        }

        if (member.isInVoiceChat !== undefined) {
          existingUser.isInVoiceChat =
            existingUser.isInVoiceChat || member.isInVoiceChat;
          if (member.isInVoiceChat) {
            existingUser.isMuted = member.isMuted ?? false;
          }
        }
        if (member.isHandRaised !== undefined) {
          existingUser.isHandRaised =
            existingUser.isHandRaised || member.isHandRaised;
          if (member.isHandRaised && member.handRaisedAt !== undefined) {
            existingUser.handRaisedAt = member.handRaisedAt;
          }
        }
        existingUser.isCameraOn =
          existingUser.isCameraOn || member.isCameraOn;
        existingUser.roomMuted = existingUser.roomMuted || member.roomMuted;
        existingUser.globalMuted = existingUser.globalMuted || member.globalMuted;
        existingUser.micBanned = existingUser.micBanned || member.micBanned;
        existingUser.cameraBanned =
          existingUser.cameraBanned || member.cameraBanned;
        existingUser.micBannedByStarCount = Math.max(
          existingUser.micBannedByStarCount ?? 0,
          member.micBannedByStarCount ?? 0,
        );
        existingUser.cameraBannedByStarCount = Math.max(
          existingUser.cameraBannedByStarCount ?? 0,
          member.cameraBannedByStarCount ?? 0,
        );
        existingUser.roomMutedByStarCount = Math.max(
          existingUser.roomMutedByStarCount ?? 0,
          member.roomMutedByStarCount ?? 0,
        );
        existingUser.globalMutedByStarCount = Math.max(
          existingUser.globalMutedByStarCount ?? 0,
          member.globalMutedByStarCount ?? 0,
        );
      }
    }

    const users = Array.from(userMap.values());

    return {
      count: users.length,
      users,
    };
  }

  private getUsernameBySocketId(
    roomKey: string,
    socketId: string,
  ): string | null {
    const members = this.getRoomsStore().get(roomKey);
    if (!members) {
      return null;
    }

    for (const [, member] of members.entries()) {
      if (member.socketId === socketId) {
        return member.username;
      }
    }

    return null;
  }

  private findRoomMemberEntry(
    members: Map<string, RoomMember>,
    normalizedUsername: string,
  ): { key: string; member: RoomMember } | null {
    const directMember = members.get(normalizedUsername);
    if (directMember) {
      return { key: normalizedUsername, member: directMember };
    }

    for (const [memberKey, member] of members.entries()) {
      if (this.normalize(member.username) === normalizedUsername) {
        return { key: memberKey, member };
      }
    }

    return null;
  }

  private findActiveRoomMember(params: {
    roomKey?: string | null;
    username?: string | null;
    userId?: number;
  }): RoomMember | null {
    const normalizedRoomKey = this.normalize(params.roomKey ?? undefined);
    const normalizedUsername = this.normalize(params.username ?? undefined);

    const findInMembers = (
      members?: Map<string, RoomMember>,
    ): RoomMember | null => {
      if (!members) return null;

      if (normalizedUsername) {
        const directEntry = this.findRoomMemberEntry(
          members,
          normalizedUsername,
        );
        if (directEntry?.member) {
          return directEntry.member;
        }
      }

      for (const member of members.values()) {
        if (
          this.roomMemberMatchesIdentity(member, {
            userId: params.userId,
            normalizedUsername,
          })
        ) {
          return member;
        }
      }

      return null;
    };

    if (normalizedRoomKey) {
      const roomScopedMember = findInMembers(
        this.getRoomsStore().get(normalizedRoomKey),
      );
      if (roomScopedMember) {
        return roomScopedMember;
      }
    }

    for (const members of this.getRoomsStore().values()) {
      const member = findInMembers(members);
      if (member) {
        return member;
      }
    }

    return null;
  }

  private roomMemberMatchesIdentity(
    member: RoomMember,
    params: {
      userId?: number;
      normalizedUsername?: string | null;
    },
  ): boolean {
    if (
      typeof params.userId === 'number' &&
      Number.isFinite(params.userId) &&
      member.userId === params.userId
    ) {
      return true;
    }

    if (!params.normalizedUsername) {
      return false;
    }

    return this.normalize(member.username) === params.normalizedUsername;
  }

  private resolveRoleVisualForMember(
    member: Pick<
      RoomMember,
      | 'userId'
      | 'username'
      | 'roleName'
      | 'roleStarColor'
      | 'roleStarCount'
      | 'roleIcon'
    >,
  ): RoleVisualOverride {
    const roleOverride = this.getRoleVisualOverride({
      userId: member.userId,
      username: member.username,
    });

    return {
      roleName: roleOverride?.roleName ?? member.roleName,
      roleStarColor: roleOverride?.roleStarColor ?? member.roleStarColor,
      roleStarCount: roleOverride?.roleStarCount ?? member.roleStarCount,
      roleIcon: roleOverride?.roleIcon ?? member.roleIcon,
    };
  }

  private async hydrateRoleVisualsFromDatabase<
    T extends {
      userId?: number;
      username: string;
      roleName?: string | null;
      roleStarColor?: string | null;
      roleStarCount?: number | null;
      roleIcon?: string | null;
    },
  >(users: T[]): Promise<T[]> {
    const normalizedUsernames = Array.from(
      new Set(
        users
          .map((user) => this.normalize(user.username))
          .filter((username): username is string => Boolean(username)),
      ),
    );

    if (normalizedUsernames.length === 0) {
      return users;
    }

    const userRepository = this.getUserRepository();
    if (!userRepository?.createQueryBuilder) {
      if (!this.roleHydrationRepositoryWarned) {
        this.roleHydrationRepositoryWarned = true;
        this.logWarn(
          'Role visual hydration skipped because userRepository is not available.',
        );
      }
      return users;
    }

    let persistedUsers: User[] = [];
    try {
      persistedUsers = await userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('LOWER(user.username) IN (:...usernames)', {
          usernames: normalizedUsernames,
        })
        .andWhere('user.deletedAt IS NULL')
        .getMany();
    } catch (error) {
      this.logWarn(
        `Role visual hydration failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return users;
    }

    const roleByUsername = new Map<string, RoleVisualOverride | null>();
    for (const user of persistedUsers) {
      const usernameKey = this.normalize(user.username);
      if (!usernameKey) continue;

      const roleVisual = user.role
        ? {
            roleName: user.role.name || undefined,
            roleStarColor: user.role.starColor || undefined,
            roleStarCount: user.role.starCount ?? undefined,
            roleIcon: user.role.icon || undefined,
          }
        : null;

      roleByUsername.set(usernameKey, roleVisual);
      this.setRoleVisualOverride({
        userId: user.id,
        username: user.username,
        role: roleVisual,
      });
    }

    return users.map((user) => {
      const usernameKey = this.normalize(user.username);
      if (!usernameKey || !roleByUsername.has(usernameKey)) {
        return user;
      }

      const roleVisual = roleByUsername.get(usernameKey);
      return {
        ...user,
        roleName: roleVisual?.roleName,
        roleStarColor: roleVisual?.roleStarColor,
        roleStarCount: roleVisual?.roleStarCount,
        roleIcon: roleVisual?.roleIcon,
      };
    });
  }

  private async buildRoomUsersSnapshot(roomKey: string): Promise<{
    users: RoomUser[];
    liveUsers: RoomUser[];
    persistentBotUsers: RoomUser[];
  }> {
    this.repairMissingRoomMembersFromSocketState();
    this.repairMissingRoomMembersForRoomFromAdapter(roomKey);
    const liveUsers = this.getRoomUsers(roomKey);
    let persistentBotUsers: RoomUser[] = [];
    try {
      persistentBotUsers = await this.getPersistentBotUsersForRoom(roomKey);
    } catch (error) {
      this.logWarn(
        `Room users bot hydration failed for room "${roomKey}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    let users = this.mergeRoomUsersWithPersistentBots(
      liveUsers,
      persistentBotUsers,
    );
    try {
      users = await this.hydrateRoleVisualsFromDatabase(users);
    } catch (error) {
      this.logWarn(
        `Room users role hydration failed for room "${roomKey}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return { users, liveUsers, persistentBotUsers };
  }

  private async emitRoomUsers(roomKey: string) {
    const server = this.getServer();
    if (!server?.to) {
      this.logger.warn(
        `Skipping room users emit because socket server is not ready (room: ${roomKey})`,
      );
      return;
    }

    const { users, liveUsers, persistentBotUsers } =
      await this.buildRoomUsersSnapshot(roomKey);
    const hasLiveHumanUsers = liveUsers.some((user) => !user.isBot);
    const activeSocketCount =
      server.sockets?.adapter?.rooms?.get(roomKey)?.size ?? 0;

    if (
      !hasLiveHumanUsers &&
      persistentBotUsers.length > 0 &&
      activeSocketCount > 0
    ) {
      this.logWarn(
        `Skipping bot-only room users snapshot for room "${roomKey}" because ${activeSocketCount} live socket(s) are still joined.`,
      );
      return;
    }

    this.logRoleDebug('emitRoomUsers', {
      roomKey,
      users: users.map((user) => ({
        socketId: user.id,
        userId: user.userId,
        username: user.username,
        tenantId: user.tenantId,
        roleName: user.roleName,
        roleStarCount: user.roleStarCount,
        roleStarColor: user.roleStarColor,
        roleIcon: user.roleIcon,
        statusModeName: user.statusModeName,
      })),
    });
    server.to(roomKey).emit('room:users', {
      room: roomKey,
      users,
    });
  }

  private async emitRoomUsersToClient(roomKey: string, client: Socket) {
    if (!client?.emit) {
      return;
    }

    const { users } = await this.buildRoomUsersSnapshot(roomKey);
    client.emit('room:users', {
      room: roomKey,
      users,
    });
  }

  private async emitRoomBotUsers(roomKey: string) {
    const server = this.getServer();
    if (!server?.to) {
      this.logger.warn(
        `Skipping room bot users emit because socket server is not ready (room: ${roomKey})`,
      );
      return;
    }

    let users: RoomUser[] = [];
    try {
      users = await this.hydrateRoleVisualsFromDatabase(
        await this.getPersistentBotUsersForRoom(roomKey),
      );
    } catch (error) {
      this.logWarn(
        `Room bot users emit failed for room "${roomKey}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    server.to(roomKey).emit('room:botUsers', {
      room: roomKey,
      users,
    });
  }

  private async emitRoomBotUserChanged(
    roomKey: string,
    username: string,
    action: 'upsert' | 'remove',
  ) {
    const server = this.getServer();
    if (!server?.to) {
      this.logger.warn(
        `Skipping room bot user change emit because socket server is not ready (room: ${roomKey})`,
      );
      return;
    }

    const normalizedUsername = this.normalize(username);
    let users: RoomUser[] = [];
    if (action === 'upsert') {
      try {
        users = await this.hydrateRoleVisualsFromDatabase(
          await this.getPersistentBotUsersForRoom(roomKey),
        );
      } catch (error) {
        this.logWarn(
          `Room bot user change emit failed for room "${roomKey}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    const user =
      action === 'upsert'
        ? users.find((bot) => this.normalize(bot.username) === normalizedUsername) ??
          null
        : null;

    server.to(roomKey).emit('room:botUserChanged', {
      room: roomKey,
      action,
      username,
      user,
    });
  }

  private async emitTenantBotUserChanged(
    username: string,
    action: 'upsert' | 'remove',
  ) {
    const server = this.getServer();
    if (!server?.emit) {
      this.logger.warn(
        `Skipping tenant bot user change emit because socket server is not ready (username: ${username})`,
      );
      return;
    }

    const normalizedUsername = this.normalize(username);
    const bot = normalizedUsername
      ? this.getPersistentBotsStore().get(normalizedUsername)
      : undefined;
    const user =
      action === 'upsert' && bot
        ? {
            socketId: bot.socketId,
            username: bot.username,
            displayUsername: bot.username,
            gender: bot.gender,
            isGuest: false,
            isBot: true,
            isAI: bot.isAI === true,
            rooms: [
              {
                roomKey: bot.roomKey,
                roomName: this.getRoomDisplayName(bot.roomKey),
              },
            ],
            isInVoiceChat: bot.isInVoiceChat ?? false,
            isMuted: bot.isMuted ?? false,
            isHandRaised: bot.isHandRaised ?? false,
            isCameraOn: bot.isCameraOn ?? false,
            handRaisedAt: bot.handRaisedAt ?? null,
            statusModeName: bot.statusModeName,
            roleName: bot.roleName,
            roleStarColor: bot.roleStarColor,
            roleStarCount: bot.roleStarCount,
            roleIcon: bot.roleIcon,
            icon: bot.icon,
            fontName: bot.fontName,
            granite: bot.granite,
            userGif: bot.userGif,
            deviceType: bot.deviceType,
            device: bot.device,
            clientType: bot.clientType,
            roomMuted: bot.roomMuted ?? false,
            roomMutedByStarCount: bot.roomMutedByStarCount ?? 0,
            globalMuted: bot.globalMuted ?? false,
            globalMutedByStarCount: bot.globalMutedByStarCount ?? 0,
          }
        : null;

    server.emit('tenant:botUserChanged', {
      tenantId: bot?.tenantId || 'tenant_master',
      action,
      username,
      user,
    });
  }

  private async emitTenantActiveUserSnapshot(tenantId: string | undefined) {
    const server = this.getServer();
    if (!tenantId) return;
    if (!server?.emit) {
      this.logger.warn(
        `Skipping tenant active user snapshot emit because socket server is not ready (tenant: ${tenantId})`,
      );
      return;
    }

    const normalizedTenantId = tenantId.replace(/^tenant_/, '');
    const { count, users } = this.getActiveTenantUsers(normalizedTenantId);
    let persistentBotUsers: Array<Omit<RoomUser, 'id'> & { socketId: string }> =
      [];
    try {
      persistentBotUsers = await this.getPersistentBotUsersForTenantSnapshot();
    } catch (error) {
      this.logWarn(
        `Tenant active user bot hydration failed for tenant "${normalizedTenantId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const liveUserKeys = new Set(
      users.map((user) => this.normalize(user.username)).filter(Boolean),
    );
    const mergedUsers = [
      ...users,
      ...persistentBotUsers.filter(
        (bot) => !liveUserKeys.has(this.normalize(bot.username)),
      ),
    ];
    let hydratedUsers = mergedUsers;
    try {
      hydratedUsers = await this.hydrateRoleVisualsFromDatabase(mergedUsers);
    } catch (error) {
      this.logWarn(
        `Tenant active user role hydration failed for tenant "${normalizedTenantId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    this.logJoinEffectDebug('emitTenantActiveUserSnapshot', {
      tenantId: normalizedTenantId,
      count: hydratedUsers.length,
      users: hydratedUsers.map((user) => ({
        socketId: user.socketId,
        username: user.username,
        statusModeName: user.statusModeName ?? null,
        joinEffect: user.joinEffect ?? null,
        roomCount: Array.isArray(user.rooms) ? user.rooms.length : 0,
      })),
    });

    server.emit('tenant:activeUserCount', {
      tenantId: normalizedTenantId,
      count: hydratedUsers.length,
      users: hydratedUsers,
    });
  }

  private emitWithRetry(
    eventName: string,
    payload: unknown,
    contextLabel: string,
    retries = 8,
  ): void {
    const server = this.getServer();
    if (server?.emit) {
      server.emit(eventName, payload);
      return;
    }

    if (retries <= 0) {
      const queue = this.pendingServerEmits ?? [];
      if (!this.pendingServerEmits) {
        this.pendingServerEmits = queue;
      }
      queue.push({ eventName, payload, contextLabel });
      this.logger.warn(
        `Queueing ${contextLabel} emit because socket server is not ready`,
      );
      return;
    }

    setTimeout(() => {
      this.emitWithRetry(eventName, payload, contextLabel, retries - 1);
    }, 250);
  }

  private isUsernameTakenInRoom(
    roomKey: string,
    normalizedUsername: string,
    clientId: string,
  ): boolean {
    const members = this.getRoomsStore().get(roomKey);
    if (!members) {
      return false;
    }

    const existing = members.get(normalizedUsername);
    if (!existing) {
      return false;
    }

    if (!this.server?.sockets?.sockets) {
      this.logger.warn(
        `Socket server not ready while checking duplicate username (${normalizedUsername})`,
      );
      return existing.socketId !== clientId;
    }

    if (!this.server.sockets.sockets.has(existing.socketId)) {
      members.delete(normalizedUsername);
      return false;
    }

    return existing.socketId !== clientId;
  }

  public updateUserRoleInAllRooms(
    username: string,
    roleInfo: {
      name: string;
      starCount: number;
      starColor?: string | null;
      icon?: string | null;
    } | null,
    userId?: number,
  ): void {
    const normalizedUsername = this.normalize(username);
    if (!normalizedUsername && userId === undefined) {
      return;
    }

    this.repairMissingRoomMembersFromSocketState({
      userId,
      normalizedUsername,
    });

    this.logRoleDebug('updateUserRoleInAllRooms:start', {
      username,
      normalizedUsername,
      userId,
      nextRole: roleInfo,
    });

    const sockets = this.getServer()?.sockets?.sockets;
    const affectedTenantIds = new Set<string>();
    // Update role in all rooms where this user exists
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      let roomUpdated = false;

      for (const [, member] of members.entries()) {
        if (
          !this.roomMemberMatchesIdentity(member, {
            userId,
            normalizedUsername,
          })
        ) {
          continue;
        }

        const previousRole = {
          roleName: member.roleName,
          roleStarCount: member.roleStarCount,
          roleStarColor: member.roleStarColor,
          roleIcon: member.roleIcon,
        };

        member.roleName = roleInfo?.name || undefined;
        member.roleStarCount = roleInfo?.starCount ?? undefined;
        member.roleStarColor = roleInfo?.starColor || undefined;
        member.roleIcon =
          (typeof roleInfo?.icon === 'string' && roleInfo.icon.trim()) ||
          undefined;
        if (member.tenantId) {
          affectedTenantIds.add(member.tenantId);
        }
        // Keep socket metadata in sync for permission filtering.
        const socket = sockets?.get(member.socketId);
        if (socket) {
          (socket as any).roleStarCount = roleInfo?.starCount || 0;
          this.syncSocketPresenceFromMember(socket, member);
        }

        this.logRoleDebug('updateUserRoleInAllRooms:matchedMember', {
          roomKey,
          socketId: member.socketId,
          userId: member.userId,
          username: member.username,
          tenantId: member.tenantId,
          previousRole,
          nextRole: {
            roleName: member.roleName,
            roleStarCount: member.roleStarCount,
            roleStarColor: member.roleStarColor,
            roleIcon: member.roleIcon,
          },
        });

        roomUpdated = true;
      }

      if (roomUpdated) {
        // Emit updated room users list to all users in this room
        this.emitRoomUsers(roomKey);
      }
    }

    this.setRoleVisualOverride({
      userId,
      username,
      role: roleInfo
        ? {
            roleName: roleInfo.name || undefined,
            roleStarCount: roleInfo.starCount ?? undefined,
            roleStarColor: roleInfo.starColor || undefined,
            roleIcon:
              (typeof roleInfo.icon === 'string' && roleInfo.icon.trim()) ||
              undefined,
          }
        : null,
    });

    // Publish fresh tenant snapshots immediately so sidebar "All" updates without polling.
    const socketTenantIds = this.updateSocketPresenceForIdentity(
      {
        userId,
        normalizedUsername,
      },
      {
        roleName: roleInfo?.name || undefined,
        roleStarCount: roleInfo?.starCount ?? undefined,
        roleStarColor: roleInfo?.starColor || undefined,
        roleIcon:
          (typeof roleInfo?.icon === 'string' && roleInfo.icon.trim()) ||
          undefined,
      },
    );

    for (const tenantId of socketTenantIds) {
      affectedTenantIds.add(tenantId);
    }

    for (const tenantId of affectedTenantIds) {
      this.emitTenantActiveUserSnapshot(tenantId);
    }

    this.logRoleDebug('updateUserRoleInAllRooms:done', {
      username,
      normalizedUsername,
      userId,
      affectedTenantIds: Array.from(affectedTenantIds),
    });
  }

  public updateRoleInAllUsers(roleInfo: {
    id: number;
    name: string;
    previousName?: string;
    starColor?: string | null;
    starCount?: number | null;
    icon?: string | null;
  }): void {
    const sockets = this.server?.sockets?.sockets;
    const affectedTenantIds = new Set<string>();
    const previousName = roleInfo.previousName?.trim();
    const newName = roleInfo.name?.trim();

    // 1. Update role in all rooms where users with this role exist
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      let updated = false;
      for (const member of members.values()) {
        const matchesRole =
          (typeof member.roleName === 'string' &&
            typeof newName === 'string' &&
            member.roleName === newName) ||
          (typeof member.roleName === 'string' &&
            typeof previousName === 'string' &&
            previousName.length > 0 &&
            member.roleName === previousName);

        // Match by role name (assuming names are unique as per role.service constraints)
        if (matchesRole) {
          if (newName) {
            member.roleName = newName;
          }
          if (roleInfo.starColor !== undefined)
            member.roleStarColor = roleInfo.starColor || undefined;
          if (roleInfo.starCount !== undefined) {
            member.roleStarCount = roleInfo.starCount ?? undefined;
          }
          if (roleInfo.icon !== undefined)
            member.roleIcon = roleInfo.icon || undefined;

          const socket = sockets?.get(member.socketId);
          if (socket) {
            (socket as any).roleStarCount = member.roleStarCount ?? 0;
            this.syncSocketPresenceFromMember(socket, member);
          }
          affectedTenantIds.add(member.tenantId || 'tenant_master');
          updated = true;
        }
      }
      if (updated) {
        this.emitRoomUsers(roomKey);
      }
    }

    // 2. Broadcast to all clients (tenant-wide update) for the sidebar's "All" tab
    this.emitWithRetry(
      'tenant:roleUpdate',
      roleInfo,
      `tenant role update (roleId: ${roleInfo.id})`,
    );

    for (const tenantId of affectedTenantIds) {
      this.emitTenantActiveUserSnapshot(tenantId);
    }
  }

  public emitUserRoleChanged(payload: {
    userId: number;
    username: string;
    tenantId?: string;
    roleId: number | null;
    role: {
      id: number;
      name: string;
      starCount: number;
      starColor: string | null;
      icon: string;
    } | null;
  }): void {
    this.setRoleVisualOverride({
      userId: payload.userId,
      username: payload.username,
      role: payload.role
        ? {
            roleName: payload.role.name || undefined,
            roleStarCount: payload.role.starCount ?? undefined,
            roleStarColor: payload.role.starColor || undefined,
            roleIcon:
              (typeof payload.role.icon === 'string' &&
                payload.role.icon.trim()) ||
              undefined,
          }
        : null,
    });

    this.emitWithRetry(
      'user:roleChanged',
      payload,
      `user role changed (user: ${payload.username})`,
    );
  }

  public findActiveMemberForModeration(
    username: string,
    room?: string,
  ): {
    username: string;
    isGuest: boolean;
    roleStarCount: number;
    micBanned: boolean;
    micBannedByStarCount: number;
    cameraBanned: boolean;
    cameraBannedByStarCount: number;
    roomMuted: boolean;
    roomMutedByStarCount: number;
    globalMuted: boolean;
    globalMutedByStarCount: number;
    ipAddress?: string | null;
    loginHistoryId?: number | null;
    socketId?: string | null;
  } | null {
    const normalizedUsername = this.normalize(username);
    const normalizedRoom = room ? this.resolveRoomKey(room) : null;
    if (!normalizedUsername) return null;

    const server = this.getServer();
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      if (normalizedRoom && roomKey !== normalizedRoom) continue;
      const member = members.get(normalizedUsername);
      if (!member) continue;
      if (
        server?.sockets?.sockets &&
        !server.sockets.sockets.has(member.socketId)
      )
        continue;

      return {
        username: member.username,
        isGuest: member.isGuest === true,
        roleStarCount: member.roleStarCount ?? 0,
        micBanned: member.micBanned === true,
        micBannedByStarCount: member.micBannedByStarCount ?? 0,
        cameraBanned: member.cameraBanned === true,
        cameraBannedByStarCount: member.cameraBannedByStarCount ?? 0,
        roomMuted: member.roomMuted === true,
        roomMutedByStarCount: member.roomMutedByStarCount ?? 0,
        globalMuted: member.globalMuted === true,
        globalMutedByStarCount: member.globalMutedByStarCount ?? 0,
        ipAddress: member.ipAddress ?? null,
        loginHistoryId: member.loginHistoryId ?? null,
        socketId: member.socketId ?? null,
      };
    }

    return null;
  }

  public disconnectMembersByIpAddress(
    ipAddress: string,
    payload: {
      bannedByUsername: string;
      reason?: string;
    },
  ): string[] {
    const normalizedIp = String(ipAddress ?? '').trim();
    if (!normalizedIp) return [];

    const affectedUsers = new Set<string>();
    const server = this.getServer();

    for (const members of this.getRoomsStore().values()) {
      for (const member of members.values()) {
        if (String(member.ipAddress ?? '').trim() !== normalizedIp) continue;
        const socket = server?.sockets?.sockets?.get(member.socketId);
        if (!socket) continue;

        affectedUsers.add(member.username);
        socket.emit('moderation:userBanned', {
          userId: member.userId ?? null,
          username: member.username,
          bannedByUsername: payload.bannedByUsername,
          reason: payload.reason ?? null,
          expiresAt: null,
          createdAt: new Date(),
          isGuest: member.isGuest === true,
        });
        socket.disconnect(true);
      }
    }

    return Array.from(affectedUsers);
  }

  public setMicBanState(
    username: string,
    micBanned: boolean,
    bannedByStarCount: number,
  ): boolean {
    const normalizedUsername = this.normalize(username);
    if (!normalizedUsername) return false;

    let updated = false;
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      const member = members.get(normalizedUsername);
      if (!member) continue;

      updated = true;
      member.micBanned = micBanned;
      member.micBannedByStarCount = micBanned ? bannedByStarCount : 0;

      if (micBanned && member.isInVoiceChat) {
        member.isMuted = true;
        this.server.to(roomKey).emit('voice:userStateChanged', {
          room: roomKey,
          username: member.username,
          isInVoiceChat: true,
          isMuted: true,
        });
      }

      this.syncSocketPresenceFromMember(member.socketId, member);
      this.emitRoomUsers(roomKey);
    }

    return updated;
  }

  public setCameraBanState(
    username: string,
    cameraBanned: boolean,
    bannedByStarCount: number,
  ): boolean {
    const normalizedUsername = this.normalize(username);
    if (!normalizedUsername) return false;

    let updated = false;
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      const member = members.get(normalizedUsername);
      if (!member) continue;

      updated = true;
      member.cameraBanned = cameraBanned;
      member.cameraBannedByStarCount = cameraBanned ? bannedByStarCount : 0;

      if (cameraBanned && member.isCameraOn) {
        member.isCameraOn = false;
        this.getServer()?.to(roomKey).emit('room:userCameraChanged', {
          room: roomKey,
          username: member.username,
          isCameraOn: false,
        });
      }

      this.syncSocketPresenceFromMember(member.socketId, member);
      this.emitRoomUsers(roomKey);
      this.getServer()?.emit('tenant:userStateUpdate', {
        tenantId: member.tenantId || 'tenant_master',
        username: member.username,
        isInVoiceChat: member.isInVoiceChat ?? false,
        isMuted: member.isMuted ?? false,
        isHandRaised: member.isHandRaised ?? false,
        isCameraOn: member.isCameraOn ?? false,
        handRaisedAt: member.handRaisedAt ?? null,
      });
      this.emitTenantActiveUserSnapshot(member.tenantId);
    }

    return updated;
  }

  public setRoomMuteState(
    username: string,
    room: string,
    roomMuted: boolean,
    mutedByStarCount: number,
    mutedByUsername?: string,
  ): boolean {
    const normalizedUsername = this.normalize(username);
    const normalizedRoom = this.resolveRoomKey(room);
    if (!normalizedUsername || !normalizedRoom) return false;

    const members = this.getRoomsStore().get(normalizedRoom);
    const member = members?.get(normalizedUsername);
    if (!members || !member) return false;

    member.roomMuted = roomMuted;
    member.roomMutedByStarCount = roomMuted ? mutedByStarCount : 0;

    if (roomMuted && member.isInVoiceChat) {
      member.isMuted = true;
      this.getServer()?.to(normalizedRoom).emit('voice:userStateChanged', {
        room: normalizedRoom,
        username: member.username,
        isInVoiceChat: true,
        isMuted: true,
      });
    }
    this.syncSocketPresenceFromMember(member.socketId, member);

    const roomName = this.getRoomDisplayName(normalizedRoom);
    this.getServer()?.emit('moderation:muteStateChanged', {
      username: member.username,
      scope: 'room',
      room: normalizedRoom,
      roomName,
      roomMuted,
      mutedByUsername: mutedByUsername || 'Sistem',
    });

    this.emitRoomUsers(normalizedRoom);
    this.emitTenantActiveUserSnapshot(member.tenantId);

    return true;
  }

  public clearRoomMuteStates(
    room: string,
    adminStarCount: number,
    adminUsername: string,
    isRoot = false,
  ): { clearedCount: number; skippedCount: number } {
    const normalizedRoom = this.resolveRoomKey(room);
    if (!normalizedRoom) return { clearedCount: 0, skippedCount: 0 };

    const members = this.getRoomsStore().get(normalizedRoom);
    if (!members) return { clearedCount: 0, skippedCount: 0 };

    let clearedCount = 0;
    let skippedCount = 0;
    const clearedUsernames: string[] = [];

    for (const member of members.values()) {
      if (!member.roomMuted) continue;

      const canClear =
        isRoot ||
        (adminStarCount > (member.roleStarCount ?? 0) &&
          adminStarCount >= (member.roomMutedByStarCount ?? 0));

      if (!canClear) {
        skippedCount += 1;
        continue;
      }

      member.roomMuted = false;
      member.roomMutedByStarCount = 0;
      this.syncSocketPresenceFromMember(member.socketId, member);
      clearedUsernames.push(member.username);
      clearedCount += 1;
    }

    if (clearedCount > 0) {
      const roomName = this.getRoomDisplayName(normalizedRoom);
      for (const username of clearedUsernames) {
        this.getServer()?.emit('moderation:muteStateChanged', {
          username,
          scope: 'room',
          room: normalizedRoom,
          roomName,
          roomMuted: false,
          mutedByUsername: adminUsername || 'Sistem',
        });
      }
      this.emitRoomUsers(normalizedRoom);
      for (const member of members.values()) {
        this.emitTenantActiveUserSnapshot(member.tenantId);
      }
    }

    return { clearedCount, skippedCount };
  }

  public setGlobalMuteState(
    username: string,
    globalMuted: boolean,
    mutedByStarCount: number,
    mutedByUsername?: string,
  ): boolean {
    const normalizedUsername = this.normalize(username);
    if (!normalizedUsername) return false;

    let updated = false;
    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      const member = members.get(normalizedUsername);
      if (!member) continue;

      updated = true;
      member.globalMuted = globalMuted;
      member.globalMutedByStarCount = globalMuted ? mutedByStarCount : 0;

      if (globalMuted && member.isInVoiceChat) {
        member.isMuted = true;
        this.getServer()?.to(roomKey).emit('voice:userStateChanged', {
          room: roomKey,
          username: member.username,
          isInVoiceChat: true,
          isMuted: true,
        });
      }

      this.syncSocketPresenceFromMember(member.socketId, member);
      this.emitRoomUsers(roomKey);
      this.emitTenantActiveUserSnapshot(member.tenantId);
    }

    this.getServer()?.emit('moderation:muteStateChanged', {
      username,
      scope: 'global',
      globalMuted,
      mutedByUsername: mutedByUsername || 'Sistem',
    });

    return updated;
  }

  public clearGlobalMuteStates(
    adminStarCount: number,
    adminUsername: string,
    isRoot = false,
    excludedUsernames: Iterable<string> = [],
  ): { clearedCount: number; skippedCount: number } {
    const excluded = new Set(
      Array.from(excludedUsernames)
        .map((username) => this.normalize(username))
        .filter(Boolean),
    );
    const candidates = new Map<
      string,
      {
        username: string;
        roleStarCount: number;
        globalMutedByStarCount: number;
      }
    >();

    for (const members of this.getRoomsStore().values()) {
      for (const member of members.values()) {
        if (!member.globalMuted) continue;

        const normalizedUsername = this.normalize(member.username);
        if (!normalizedUsername || excluded.has(normalizedUsername)) continue;

        const existing = candidates.get(normalizedUsername);
        candidates.set(normalizedUsername, {
          username: existing?.username ?? member.username,
          roleStarCount: Math.max(
            existing?.roleStarCount ?? 0,
            member.roleStarCount ?? 0,
          ),
          globalMutedByStarCount: Math.max(
            existing?.globalMutedByStarCount ?? 0,
            member.globalMutedByStarCount ?? 0,
          ),
        });
      }
    }

    let clearedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates.values()) {
      const canClear =
        isRoot ||
        (adminStarCount > candidate.roleStarCount &&
          adminStarCount >= candidate.globalMutedByStarCount);

      if (!canClear) {
        skippedCount += 1;
        continue;
      }

      if (this.setGlobalMuteState(candidate.username, false, 0, adminUsername)) {
        clearedCount += 1;
      }
    }

    return { clearedCount, skippedCount };
  }

  public syncFlashNickInAllRooms(
    username: string,
    flashNick: string | null,
  ): boolean {
    const normalizedUsername = this.normalize(username);
    if (!normalizedUsername) return false;

    this.repairMissingRoomMembersFromSocketState({
      normalizedUsername,
    });

    const server = this.getServer();
    let updated = false;
    const affectedTenantIds = new Set<string>();
    const socketMatchedRooms = new Set<string>();

    for (const [roomKey, members] of this.getRoomsStore().entries()) {
      const member = members.get(normalizedUsername);
      if (!member) continue;

      updated = true;
      member.flashNick = flashNick;
      this.syncSocketPresenceFromMember(member.socketId, member);
      affectedTenantIds.add(member.tenantId || 'tenant_master');

      this.getServer()?.to(roomKey).emit('room:userFlashNickChanged', {
        room: roomKey,
        username: member.username,
        flashNick: member.flashNick ?? null,
      });

      this.emitRoomUsers(roomKey);
    }

    if (server?.sockets?.sockets) {
      for (const socket of server.sockets.sockets.values()) {
        if (this.normalize((socket as any).username) !== normalizedUsername) {
          continue;
        }

        this.updateSocketPresenceState(socket, {
          flashNick,
        });

        affectedTenantIds.add((socket as any).tenantId || 'tenant_master');

        for (const roomKey of socket.rooms.values()) {
          if (!roomKey || roomKey === socket.id) continue;
          socketMatchedRooms.add(roomKey);
        }
      }
    }

    for (const roomKey of socketMatchedRooms) {
      this.getServer()?.to(roomKey).emit('room:userFlashNickChanged', {
        room: roomKey,
        username,
        flashNick,
      });
    }

    this.getServer()?.emit('tenant:userFlashNickChanged', {
      username,
      flashNick,
    });

    for (const tenantId of affectedTenantIds) {
      this.emitTenantActiveUserSnapshot(tenantId);
    }

    this.logger?.log?.(
      `[FLASH_NICK] http sync username=${username} updated=${updated} storeRooms=${this.getRoomsStore().size} socketRooms=${Array.from(socketMatchedRooms).join(',') || 'none'} tenants=${Array.from(affectedTenantIds).join(',') || 'none'} value=${flashNick ? 'set' : 'cleared'}`,
    );

    return updated;
  }

  public getMutedStateForUserInRoom(
    username: string,
    room: string,
  ): {
    muted: boolean;
    reason: 'room_muted' | 'global_muted' | null;
  } {
    const normalizedUsername = this.normalize(username);
    const normalizedRoom = this.resolveRoomKey(room);
    if (!normalizedUsername || !normalizedRoom) {
      return { muted: false, reason: null };
    }

    const member = this.getRoomsStore()
      .get(normalizedRoom)
      ?.get(normalizedUsername);
    if (!member) {
      return { muted: false, reason: null };
    }

    const status = this.isUserMutedForRoom(member);
    return { muted: status.muted, reason: status.reason };
  }

  public forceMicKick(username: string): void {
    this.setMicBanState(username, true, 0);
  }

  public liftMicBanInternal(username: string): void {
    this.setMicBanState(username, false, 0);
  }
}
