import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageClear } from './entities/message-clear.entity';
import { RoomMessageVisibilitySession } from './entities/room-message-visibility-session.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MarkMessagesReadDto } from './dto/mark-messages-read.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessageType } from './enums/message-type.enum';
import { Room } from '../rooms/entities/room.entity';
import { RoomsGateway } from '../rooms/rooms.gateway';
import { User } from '../user/entities/user.entity';
import { SystemSettingsService } from '../settings/system-settings.service';
import { RoomsStateService } from '../rooms/rooms-state.service';
import {
  buildIdentity,
  buildNormalIdentityKey,
} from '../common/agent-identity.util';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private visibilitySessionTableReady?: Promise<void>;
  private readonly visibilitySessionTableName = `"${(
    process.env.POSTGRES_SCHEMA || 'public'
  ).replace(/"/g, '""')}"."room_message_visibility_sessions"`;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MessageRead)
    private readonly messageReadRepository: Repository<MessageRead>,
    @InjectRepository(MessageClear)
    private readonly messageClearRepository: Repository<MessageClear>,
    private readonly roomsGateway: RoomsGateway,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly roomsState: RoomsStateService,
    @Optional()
    @InjectRepository(RoomMessageVisibilitySession)
    private readonly visibilitySessionRepository?: Repository<RoomMessageVisibilitySession>,
  ) {}

  private readonly roomVisibilitySessionFilter =
    `EXISTS (SELECT 1 FROM ${this.visibilitySessionTableName} visibilitySession WHERE visibilitySession."userId" = :userId AND visibilitySession."identityKey" = :identityKey AND visibilitySession."roomId" = message."roomId" AND message.id > visibilitySession."joinedAfterMessageId" AND (visibilitySession."leftMessageId" IS NULL OR message.id <= visibilitySession."leftMessageId") AND (visibilitySession."leftMessageId" IS NOT NULL OR visibilitySession."socketId" IN (:...activeVisibilitySocketIds)))`;

  private readonly activeRoomVisibilitySessionFilter =
    `EXISTS (SELECT 1 FROM ${this.visibilitySessionTableName} visibilitySession WHERE visibilitySession."userId" = :userId AND visibilitySession."identityKey" = :identityKey AND visibilitySession."roomId" = message."roomId" AND message.id > visibilitySession."joinedAfterMessageId" AND visibilitySession."leftMessageId" IS NULL AND visibilitySession."socketId" IN (:...activeVisibilitySocketIds))`;

  private getActiveVisibilitySocketIds(): string[] {
    const socketIds = new Set<string>();
    for (const members of this.roomsState?.rooms?.values?.() ?? []) {
      for (const member of members.values()) {
        if (typeof member.socketId === 'string' && member.socketId.trim()) {
          socketIds.add(member.socketId);
        }
      }
    }
    return socketIds.size > 0 ? Array.from(socketIds) : ['__no_active_socket__'];
  }

  private applyRoomVisibilitySessionFilter(
    queryBuilder: {
      andWhere: (
        condition: string,
        parameters?: Record<string, unknown>,
      ) => unknown;
    },
    userId: number,
    identityKey: string,
    options?: { activeOnly?: boolean },
  ): void {
    queryBuilder.andWhere(
      options?.activeOnly
        ? this.activeRoomVisibilitySessionFilter
        : this.roomVisibilitySessionFilter,
      {
        userId,
        identityKey,
        activeVisibilitySocketIds: this.getActiveVisibilitySocketIds(),
      },
    );
  }

  private async shouldKeepRoomChatHistory(userId: number): Promise<boolean> {
    if (!this.userRepository?.findOne) return true;

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'chatPreferences'],
    });

    return user?.chatPreferences?.keepRoomChatHistory !== false;
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

  private resolveAgentNickname(username?: string | null): string | null {
    const normalizedUsername = (username || '').trim().toLowerCase();
    if (!normalizedUsername) return null;
    for (const members of this.roomsState.rooms.values()) {
      const member = members.get(normalizedUsername);
      const nickname = member?.agentNickname?.trim();
      if (nickname) return nickname;
    }
    return null;
  }

  private cleanDisplayName(value?: string | null): string | null {
    const normalized = (value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeStoredAssetPath(value?: string | null): string | null {
    const normalized = (value || '').trim();
    if (!normalized) return null;
    if (normalized.startsWith('uploads/')) {
      return `/${normalized}`;
    }
    return normalized;
  }

  private isImageDataUrl(value?: string | null): boolean {
    const normalized = (value || '').trim();
    return /^data:image\/[^;]+;base64,/i.test(normalized);
  }

  private mimeToExtension(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };

    return map[normalized] ?? 'bin';
  }

  private async persistDataUrlAsset(
    dataUrl: string,
    folder: string,
  ): Promise<string | null> {
    const trimmed = dataUrl.trim();
    const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!match) {
      return null;
    }

    const mimeType = match[1];
    const rawBase64 = match[2].replace(/\s+/g, '');
    if (!rawBase64) {
      return null;
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (!buffer.length) {
      return null;
    }

    const extension = this.mimeToExtension(mimeType);
    const digest = createHash('sha256').update(buffer).digest('hex');
    const fileName = `${digest}-${randomUUID()}.${extension}`;
    const relativePath = path.join('uploads', folder, fileName);
    const fullPath = path.join(process.cwd(), relativePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return `/${relativePath.replace(/\\/g, '/')}`;
  }

  private async normalizeHistoryAsset(
    value: string | null | undefined,
    folder: string,
  ): Promise<string | null> {
    const normalized = this.normalizeStoredAssetPath(value);
    if (!normalized) return null;
    if (!this.isImageDataUrl(normalized)) {
      return normalized;
    }

    return this.persistDataUrlAsset(normalized, folder);
  }

  private async normalizeHistoryMessageAssets(
    messages: Message[],
  ): Promise<void> {
    const migratedUserIcons = new Map<number, string | null>();
    const migratedBotAvatars = new Map<string, string | null>();

    for (const message of messages) {
      const user = message.user;
      if (user?.id) {
        if (!migratedUserIcons.has(user.id)) {
          const nextIcon = await this.normalizeHistoryAsset(
            user.icon ?? null,
            'user-icons',
          );
          migratedUserIcons.set(user.id, nextIcon);

          if (nextIcon && nextIcon !== user.icon) {
            await this.userRepository.update(user.id, { icon: nextIcon });
          }
        }

        user.icon = migratedUserIcons.get(user.id) ?? null;
      }

      const botAvatar = message.botAvatar ?? null;
      if (botAvatar) {
        if (!migratedBotAvatars.has(botAvatar)) {
          const nextAvatar = await this.normalizeHistoryAsset(
            botAvatar,
            'bot-avatars',
          );
          migratedBotAvatars.set(botAvatar, nextAvatar);
        }

        const normalizedBotAvatar = migratedBotAvatars.get(botAvatar) ?? null;
        if (normalizedBotAvatar && normalizedBotAvatar !== botAvatar) {
          message.botAvatar = normalizedBotAvatar;
          if (message.id) {
            await this.messageRepository.update(message.id, {
              botAvatar: normalizedBotAvatar,
            });
          }
        }
      }
    }
  }

  private toIsoDate(value: Date | string | null | undefined): string {
    const normalizedString =
      typeof value === 'string' ? this.normalizeTimestampString(value) : null;

    if (normalizedString) {
      return normalizedString;
    }

    if (value instanceof Date) {
      return this.toUtcPreservingClockTime(value);
    }

    const date = new Date(value ?? '');
    if (!Number.isFinite(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  }

  private normalizeTimestampString(value: string): string | null {
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;

    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmedValue);
    if (hasExplicitTimezone) {
      const match = trimmedValue.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:\d{2})$/,
      );
      if (match) {
        const [, year, month, day, hour, minute, second = '00', millisecond] =
          match;
        const normalizedMillisecond = (millisecond ?? '000').padEnd(3, '0');
        return `${year}-${month}-${day}T${hour}:${minute}:${second}.${normalizedMillisecond}Z`;
      }

      const zonedDate = new Date(trimmedValue);
      return Number.isFinite(zonedDate.getTime())
        ? zonedDate.toISOString()
        : null;
    }

    const match = trimmedValue.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
    );
    if (!match) return null;

    const [, year, month, day, hour, minute, second = '00', millisecond] =
      match;
    const normalizedMillisecond = (millisecond ?? '000').padEnd(3, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${normalizedMillisecond}Z`;
  }

  private toUtcPreservingClockTime(value: Date): string {
    const normalizedDate = new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
        value.getMilliseconds(),
      ),
    );
    return normalizedDate.toISOString();
  }

  private async findRoomByName(roomName: string): Promise<Room | null> {
    const trimmedRoomName = roomName.trim();
    const normalizedRoomName = trimmedRoomName.toLocaleLowerCase('tr-TR');
    if (!normalizedRoomName) return null;

    const exactRoom = await this.roomRepository.findOne({
      where: { name: trimmedRoomName },
    });
    if (exactRoom) return exactRoom;

    return this.roomRepository
      .createQueryBuilder('room')
      .where('LOWER(room.name) = :roomName', { roomName: normalizedRoomName })
      .getOne();
  }

  private async resolveSenderStyleSnapshot({
    userId,
    username,
    roomKey,
    agentNickname,
  }: {
    userId: number;
    username?: string;
    roomKey?: string;
    agentNickname?: string;
  }): Promise<{
    userFontName: string | null;
    userGranite: string | null;
    userNickColor: string | null;
  }> {
    if (agentNickname?.trim()) {
      return { userFontName: null, userGranite: null, userNickColor: null };
    }

    const normalizedUsername = username?.trim().toLocaleLowerCase('tr-TR');
    const normalizedRoomKey = roomKey?.trim().toLocaleLowerCase('tr-TR');
    const candidateRooms = normalizedRoomKey
      ? [
          this.roomsState.rooms.get(normalizedRoomKey),
          ...Array.from(this.roomsState.rooms.values()),
        ]
      : Array.from(this.roomsState.rooms.values());

    for (const members of candidateRooms) {
      if (!members) continue;
      const member =
        (normalizedUsername ? members.get(normalizedUsername) : undefined) ??
        Array.from(members.values()).find(
          (candidate) =>
            candidate.userId === userId ||
            (normalizedUsername &&
              candidate.username.trim().toLocaleLowerCase('tr-TR') ===
                normalizedUsername),
        );
      if (member) {
        return {
          userFontName: this.cleanDisplayName(member.fontName),
          userGranite: this.cleanDisplayName(member.granite),
          userNickColor: this.cleanDisplayName(member.nickColor),
        };
      }
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'fontName', 'granite', 'nickColor'],
    });

    return {
      userFontName: this.cleanDisplayName(user?.fontName),
      userGranite: this.cleanDisplayName(user?.granite),
      userNickColor: this.cleanDisplayName(user?.nickColor),
    };
  }

  private resolveRequestIdentity(
    userId: number,
    username?: string,
    agentNickname?: string,
  ) {
    const identity = buildIdentity(userId, agentNickname);
    return {
      identityKey: identity.identityKey,
      identityType: identity.identityType,
      publicName: identity.normalizedAgentNickname || (username || ''),
      normalIdentityKey: buildNormalIdentityKey(userId),
    };
  }

  private async ensureLegacyClearRecordMigrated(
    clearRecord: MessageClear | null,
  ): Promise<MessageClear | null> {
    if (!clearRecord || clearRecord.lastClearedMessageId != null) {
      return clearRecord;
    }

    const boundaryMessage = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.id', 'id')
      .where('message.roomId = :roomId', { roomId: clearRecord.roomId })
      .andWhere('message.createdAt <= :clearedAt', {
        clearedAt: clearRecord.clearedAt,
      })
      .orderBy('message.id', 'DESC')
      .limit(1)
      .getRawOne<{ id?: string | number }>();

    clearRecord.lastClearedMessageId =
      boundaryMessage?.id != null ? Number(boundaryMessage.id) : 0;
    await this.messageClearRepository.save(clearRecord);

    this.logger.log(
      `Migrated legacy clearRecord id=${clearRecord.id} roomId=${clearRecord.roomId} lastClearedMessageId=${clearRecord.lastClearedMessageId}`,
    );

    return clearRecord;
  }

  private async assertUserCanWrite(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isGuest', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const settings = await this.systemSettingsService.getSettings();
    if (user.isGuest && !settings.guestCanWrite) {
      throw new ForbiddenException('Misafirler için mesaj gönderme kapalı.');
    }

    const createdAtMs = new Date(user.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) {
      return;
    }

    const guestWaitSeconds = Number(settings.guestWaitSeconds) || 0;
    if (user.isGuest && guestWaitSeconds > 0) {
      const guestWaitUpdatedAtMs = new Date(
        settings.guestWaitUpdatedAt ?? '',
      ).getTime();
      const guestWaitStartedAtMs = Number.isFinite(guestWaitUpdatedAtMs)
        ? Math.max(createdAtMs, guestWaitUpdatedAtMs)
        : createdAtMs;
      const elapsedSeconds = Math.floor(
        (Date.now() - guestWaitStartedAtMs) / 1000,
      );
      const remainingSeconds = guestWaitSeconds - elapsedSeconds;
      if (remainingSeconds > 0) {
        throw new ForbiddenException(
          `Misafir bekleme süresi: ${remainingSeconds} saniye`,
        );
      }
    }

    if (!settings.firstMessageDelayEnabled) {
      return;
    }

    const delaySeconds = Number(settings.firstMessageDelaySeconds) || 0;
    if (delaySeconds <= 0) {
      return;
    }

    const delayUpdatedAtMs = new Date(
      settings.firstMessageDelayUpdatedAt ?? '',
    ).getTime();
    const delayStartedAtMs = Number.isFinite(delayUpdatedAtMs)
      ? Math.max(createdAtMs, delayUpdatedAtMs)
      : createdAtMs;
    const elapsedSeconds = Math.floor((Date.now() - delayStartedAtMs) / 1000);
    const remainingSeconds = delaySeconds - elapsedSeconds;
    if (remainingSeconds > 0) {
      throw new ForbiddenException(
        `İlk mesajınızı ${remainingSeconds} saniye sonra gönderebilirsiniz.`,
      );
    }
  }

  private async assertGeneralBroadcastPermission(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedUsername = String(user.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    if (!hasPermissionForUser(user, PERMISSION_LABELS.GENERAL_BROADCAST)) {
      throw new ForbiddenException('Genel atma yetkiniz yok.');
    }
  }

  async create(
    createMessageDto: CreateMessageDto,
    userId: number,
    username?: string,
    agentNickname?: string,
  ): Promise<MessageResponseDto> {
    await this.assertUserCanWrite(userId);
    const requestIdentity = this.resolveRequestIdentity(
      userId,
      username,
      agentNickname,
    );

    // Oda adına göre odayı bul
    const room = await this.findRoomByName(createMessageDto.roomName);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (username?.trim()) {
      const mutedState = this.roomsGateway.getMutedStateForUserInRoom(
        username,
        room.voiceId || room.name,
      );
      if (mutedState.muted) {
        throw new ForbiddenException(
          mutedState.reason === 'global_muted'
            ? 'Tüm odalarda susturuldunuz'
            : `${room.name} odasında susturuldunuz`,
        );
      }
    }

    // Eğer reply ise, replyToMessageId gerekli
    if (
      createMessageDto.type === MessageType.REPLY &&
      !createMessageDto.replyToMessageId
    ) {
      throw new BadRequestException(
        'replyToMessageId is required for reply messages',
      );
    }

    // Eğer normal mesaj ise, replyToMessageId olmamalı
    if (
      createMessageDto.type === MessageType.NORMAL &&
      createMessageDto.replyToMessageId
    ) {
      throw new BadRequestException(
        'replyToMessageId should not be provided for normal messages',
      );
    }

    // Reply yapılan mesajın var olduğunu kontrol et
    if (createMessageDto.replyToMessageId) {
      const replyToMessage = await this.messageRepository.findOne({
        where: { id: createMessageDto.replyToMessageId },
      });

      if (!replyToMessage) {
        throw new NotFoundException('Reply to message not found');
      }
    }

    const trimmedContent = createMessageDto.content?.trim() ?? '';
    const targetGroup = createMessageDto.targetGroup ?? null;
    const senderStyleSnapshot = await this.resolveSenderStyleSnapshot({
      userId,
      username,
      roomKey: room.voiceId || room.name,
      agentNickname,
    });

    if (targetGroup) {
      await this.assertGeneralBroadcastPermission(userId);
      const rooms = await this.roomRepository.find();
      const messages = rooms.map((targetRoom) => {
        const isSenderRoom = targetRoom.id === room.id;
        const shouldNormalizeReply =
          createMessageDto.type === MessageType.REPLY && !isSenderRoom;
        return this.messageRepository.create({
          content: trimmedContent,
          type: shouldNormalizeReply
            ? MessageType.NORMAL
            : createMessageDto.type,
          userId,
          senderIdentityKey: requestIdentity.identityKey,
          senderIdentityType: requestIdentity.identityType,
          senderPublicName: requestIdentity.publicName || username || null,
          roomId: targetRoom.id,
          replyToMessageId: isSenderRoom
            ? (createMessageDto.replyToMessageId ?? null)
            : null,
          image: createMessageDto.image ?? null,
          audio: createMessageDto.audio ?? null,
          audioFileName: createMessageDto.audioFileName ?? null,
          fontColor: createMessageDto.fontColor ?? null,
          ...senderStyleSnapshot,
          targetGroup,
        });
      });

      const savedMessages = await this.messageRepository.save(messages);
      let senderResponse: MessageResponseDto | null = null;

      for (const savedMessage of savedMessages) {
        const targetRoom =
          rooms.find((candidate) => candidate.id === savedMessage.roomId) ?? room;
        const response = await this.findOne(
          savedMessage.id,
          userId,
          agentNickname,
          { ignoreClearedHistory: true, ignoreVisibilitySession: true },
        );
        this.roomsGateway.emitPersistedMessage(
          targetRoom.voiceId || targetRoom.name,
          response,
        );

        if (savedMessage.roomId === room.id) {
          senderResponse = response;
        }
      }

      return (
        senderResponse ??
        this.findOne(savedMessages[0].id, userId, agentNickname, {
          ignoreClearedHistory: true,
          ignoreVisibilitySession: true,
        })
      );
    }

    const message = this.messageRepository.create({
      content: trimmedContent,
      type: createMessageDto.type,
      userId,
      senderIdentityKey: requestIdentity.identityKey,
      senderIdentityType: requestIdentity.identityType,
      senderPublicName: requestIdentity.publicName || username || null,
      roomId: room.id,
      replyToMessageId: createMessageDto.replyToMessageId ?? null,
      image: createMessageDto.image ?? null,
      audio: createMessageDto.audio ?? null,
      audioFileName: createMessageDto.audioFileName ?? null,
      fontColor: createMessageDto.fontColor ?? null,
      ...senderStyleSnapshot,
      targetGroup,
    });

    const saved = await this.messageRepository.save(message);
    const response = await this.findOne(saved.id, userId, agentNickname, {
      ignoreClearedHistory: true,
      ignoreVisibilitySession: true,
    });
    this.roomsGateway.emitPersistedMessage(room.voiceId || room.name, response);
    return response;
  }

  async findAll(
    userId: number,
    roomName?: string,
    agentNickname?: string,
    includeCleared = false,
  ): Promise<MessageResponseDto[]> {
    await this.ensureVisibilitySessionTable();
    const requestIdentity = this.resolveRequestIdentity(
      userId,
      undefined,
      agentNickname,
    );
    const keepRoomChatHistory = await this.shouldKeepRoomChatHistory(userId);

    if (!includeCleared && roomName?.trim()) {
      const clearRecord = await this.ensureLegacyClearRecordMigrated(
        await this.messageClearRepository.findOne({
          where: {
            userId,
            identityKey: requestIdentity.identityKey,
            room: { name: roomName.trim() },
          },
          relations: ['room'],
        }),
      );

      this.logger.log(
        `findAll debug room="${roomName.trim()}" userId=${userId} identityKey="${requestIdentity.identityKey}" clearRecord=${
          clearRecord
            ? JSON.stringify({
                id: clearRecord.id,
                roomId: clearRecord.roomId,
                roomName: clearRecord.room?.name ?? null,
                clearedAt: clearRecord.clearedAt,
                lastClearedMessageId: clearRecord.lastClearedMessageId,
              })
            : 'null'
        }`,
      );
    }

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('message.replyToMessage', 'replyToMessage')
      .leftJoinAndSelect('replyToMessage.user', 'replyToUser')
      .leftJoinAndSelect('replyToUser.role', 'replyToUserRole')
      .leftJoinAndSelect('message.room', 'room')
      .where('1 = 1')
      .orderBy('message.createdAt', 'DESC');

    if (!includeCleared) {
      queryBuilder
        // Geçmiş temizleme kontrolü
        .leftJoin(
          MessageClear,
          'messageClear',
          'messageClear.userId = :userId AND messageClear.roomId = message.roomId AND messageClear.identityKey = :identityKey',
          { userId, identityKey: requestIdentity.identityKey },
        )
        .andWhere(
          '(messageClear.id IS NULL OR (messageClear.lastClearedMessageId IS NOT NULL AND message.id > messageClear.lastClearedMessageId) OR (messageClear.lastClearedMessageId IS NULL AND message.createdAt >= messageClear.clearedAt))',
        );
    }

    this.applyRoomVisibilitySessionFilter(
      queryBuilder,
      userId,
      requestIdentity.identityKey,
      { activeOnly: !keepRoomChatHistory },
    );

    if (roomName) {
      const trimmedRoomName = roomName.trim();
      queryBuilder.andWhere('LOWER(room.name) = :roomName', {
        roomName: trimmedRoomName.toLocaleLowerCase('tr-TR'),
      });
    }

    const messages = await queryBuilder.getMany();
    await this.normalizeHistoryMessageAssets(messages);
    return messages.map((message) => this.toResponse(message));
  }

  async findOne(
    id: number,
    userId?: number,
    agentNickname?: string,
    options?: {
      ignoreClearedHistory?: boolean;
      ignoreVisibilitySession?: boolean;
    },
  ): Promise<MessageResponseDto> {
    await this.ensureVisibilitySessionTable();
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: [
        'user',
        'user.role',
        'replyToMessage',
        'replyToMessage.user',
        'replyToMessage.user.role',
      ],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.normalizeHistoryMessageAssets([message]);

    if (userId) {
      const requestIdentity = this.resolveRequestIdentity(
        userId,
        undefined,
        agentNickname,
      );
      const clearRecord = await this.messageClearRepository.findOne({
        where: {
          userId,
          roomId: message.roomId,
          identityKey: requestIdentity.identityKey,
        },
      });

      if (
        !options?.ignoreClearedHistory &&
        clearRecord &&
        ((clearRecord.lastClearedMessageId != null &&
          message.id <= clearRecord.lastClearedMessageId) ||
          (clearRecord.lastClearedMessageId == null &&
            message.createdAt < clearRecord.clearedAt))
      ) {
        throw new NotFoundException('Message not found (cleared history)');
      }

      if (!options?.ignoreVisibilitySession) {
        const visibleSessionCount = this.visibilitySessionRepository
          ? await this.visibilitySessionRepository
              .createQueryBuilder('visibilitySession')
              .where('visibilitySession.userId = :userId', { userId })
              .andWhere('visibilitySession.identityKey = :identityKey', {
                identityKey: requestIdentity.identityKey,
              })
              .andWhere('visibilitySession.roomId = :roomId', {
                roomId: message.roomId,
              })
              .andWhere(':messageId > visibilitySession.joinedAfterMessageId', {
                messageId: message.id,
              })
              .andWhere(
                '(visibilitySession.leftMessageId IS NULL OR :messageId <= visibilitySession.leftMessageId)',
                { messageId: message.id },
              )
              .andWhere(
                '(visibilitySession.leftMessageId IS NOT NULL OR visibilitySession.socketId IN (:...activeVisibilitySocketIds))',
                {
                  activeVisibilitySocketIds: this.getActiveVisibilitySocketIds(),
                },
              )
              .getCount()
          : 1;

        if (visibleSessionCount === 0) {
          throw new NotFoundException(
            'Message not found (outside room session)',
          );
        }
      }

      if (
        message.userId === userId &&
        (message.senderIdentityKey || requestIdentity.normalIdentityKey) !==
          requestIdentity.identityKey
      ) {
        throw new NotFoundException('Message not found');
      }
    }

    return this.toResponse(message);
  }

  async update(
    id: number,
    updateMessageDto: UpdateMessageDto,
    userId: number,
  ): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Sadece kendi mesajını güncelleyebilir
    if (message.userId !== userId) {
      throw new ForbiddenException('You can only update your own messages');
    }

    if (updateMessageDto.content !== undefined) {
      message.content = updateMessageDto.content.trim();
    }

    message.updatedAt = new Date();
    await this.messageRepository.save(message);

    return this.findOne(id, userId);
  }

  async remove(id: number, userId: number): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Sadece kendi mesajını silebilir
    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageRepository.softDelete(id);
  }

  async markAsRead(
    markMessagesReadDto: MarkMessagesReadDto,
    userId: number,
    agentNickname?: string,
  ): Promise<{
    markedCount: number;
    alreadyReadCount: number;
    notFoundCount: number;
  }> {
    const requestIdentity = this.resolveRequestIdentity(
      userId,
      undefined,
      agentNickname,
    );
    const { messageIds } = markMessagesReadDto;

    // Var olan mesajları kontrol et
    const existingMessages = await this.messageRepository.find({
      where: { id: In(messageIds) },
      select: ['id'],
    });

    const existingMessageIds = existingMessages.map((m) => m.id);
    const notFoundCount = messageIds.length - existingMessageIds.length;

    if (existingMessageIds.length === 0) {
      return { markedCount: 0, alreadyReadCount: 0, notFoundCount };
    }

    // Kullanıcının daha önce okuduğu mesajları bul
    const alreadyRead = await this.messageReadRepository.find({
      where: {
        userId,
        messageId: In(existingMessageIds),
        identityKey: requestIdentity.identityKey,
      },
      select: ['messageId'],
    });

    const alreadyReadIds = new Set(alreadyRead.map((r) => r.messageId));

    // Sadece okunmamış mesajlar için kayıt oluştur
    const newReads = existingMessageIds
      .filter((id) => !alreadyReadIds.has(id))
      .map((messageId) => ({
        messageId,
        userId,
        identityKey: requestIdentity.identityKey,
      }));

    if (newReads.length > 0) {
      await this.messageReadRepository
        .createQueryBuilder()
        .insert()
        .into(MessageRead)
        .values(newReads)
        .orIgnore()
        .execute();
    }

    return {
      markedCount: newReads.length,
      alreadyReadCount: alreadyRead.length,
      notFoundCount,
    };
  }

  async getUnreadMessageIds(
    userId: number,
    roomName?: string,
    agentNickname?: string,
  ): Promise<number[]> {
    await this.ensureVisibilitySessionTable();
    const requestIdentity = this.resolveRequestIdentity(
      userId,
      undefined,
      agentNickname,
    );
    const keepRoomChatHistory = await this.shouldKeepRoomChatHistory(userId);
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.room', 'room')
      .leftJoin(
        MessageRead,
        'messageRead',
        'messageRead.messageId = message.id AND messageRead.userId = :userId AND messageRead.identityKey = :identityKey',
        { userId, identityKey: requestIdentity.identityKey },
      )
      .leftJoin(
        MessageClear,
        'messageClear',
        'messageClear.userId = :userId AND messageClear.roomId = message.roomId AND messageClear.identityKey = :identityKey',
        { userId, identityKey: requestIdentity.identityKey },
      )
      .where('messageRead.id IS NULL')
      .andWhere(
        '(message.botId IS NOT NULL OR message.userId IS NULL OR message.userId != :userId OR COALESCE(message.senderIdentityKey, :normalIdentityKey) = :identityKey)',
        {
          userId,
          identityKey: requestIdentity.identityKey,
          normalIdentityKey: requestIdentity.normalIdentityKey,
        },
      )
      .andWhere(
        '(messageClear.id IS NULL OR (messageClear.lastClearedMessageId IS NOT NULL AND message.id > messageClear.lastClearedMessageId) OR (messageClear.lastClearedMessageId IS NULL AND message.createdAt > messageClear.clearedAt))',
      )
      .select('message.id');

    this.applyRoomVisibilitySessionFilter(
      queryBuilder,
      userId,
      requestIdentity.identityKey,
      { activeOnly: !keepRoomChatHistory },
    );

    if (roomName) {
      queryBuilder.andWhere('LOWER(room.name) = :roomName', {
        roomName: roomName.trim().toLocaleLowerCase('tr-TR'),
      });
    }

    const unreadMessages = await queryBuilder.getRawMany();
    return unreadMessages.map((m) => m.message_id);
  }

  async clearHistory(
    roomName: string,
    userId: number,
    agentNickname?: string,
  ): Promise<void> {
    const requestIdentity = this.resolveRequestIdentity(
      userId,
      undefined,
      agentNickname,
    );
    const room = await this.findRoomByName(roomName);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const lastMessage = await this.messageRepository.findOne({
      where: { roomId: room.id },
      order: { id: 'DESC' },
      select: ['id'],
    });

    let clearRecord = await this.messageClearRepository.findOne({
      where: { userId, roomId: room.id, identityKey: requestIdentity.identityKey },
    });

    if (clearRecord) {
      clearRecord.clearedAt = new Date();
      clearRecord.lastClearedMessageId = lastMessage?.id ?? null;
    } else {
      clearRecord = this.messageClearRepository.create({
        userId,
        identityKey: requestIdentity.identityKey,
        roomId: room.id,
        clearedAt: new Date(),
        lastClearedMessageId: lastMessage?.id ?? null,
      });
    }

    await this.messageClearRepository.save(clearRecord);
  }

  async clearRoomHistoryForEveryone(roomName: string): Promise<{
    deletedMessagesCount: number;
  }> {
    const room = await this.findRoomByName(roomName);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const deleteResult = await this.messageRepository.softDelete({
      roomId: room.id,
      deletedAt: IsNull(),
    });

    this.roomsGateway.emitRoomHistoryCleared({
      room: room.voiceId || room.name,
      roomName: room.name,
    });

    return { deletedMessagesCount: deleteResult.affected ?? 0 };
  }

  async getReadMessages(
    userId: number,
    roomName?: string,
    agentNickname?: string,
  ): Promise<MessageResponseDto[]> {
    await this.ensureVisibilitySessionTable();
    const requestIdentity = this.resolveRequestIdentity(
      userId,
      undefined,
      agentNickname,
    );
    const keepRoomChatHistory = await this.shouldKeepRoomChatHistory(userId);
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .innerJoin(
        MessageRead,
        'messageRead',
        'messageRead.messageId = message.id AND messageRead.userId = :userId AND messageRead.identityKey = :identityKey',
        { userId, identityKey: requestIdentity.identityKey },
      )
      .leftJoin(
        MessageClear,
        'messageClear',
        'messageClear.userId = :userId AND messageClear.roomId = message.roomId AND messageClear.identityKey = :identityKey',
        { userId, identityKey: requestIdentity.identityKey },
      )
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('message.replyToMessage', 'replyToMessage')
      .leftJoinAndSelect('replyToMessage.user', 'replyToUser')
      .leftJoinAndSelect('replyToUser.role', 'replyToUserRole')
      .leftJoinAndSelect('message.room', 'room')
      .where(
        '(messageClear.id IS NULL OR (messageClear.lastClearedMessageId IS NOT NULL AND message.id > messageClear.lastClearedMessageId) OR (messageClear.lastClearedMessageId IS NULL AND message.createdAt > messageClear.clearedAt))',
      )
      .andWhere(
        '(message.botId IS NOT NULL OR message.userId IS NULL OR message.userId != :userId OR COALESCE(message.senderIdentityKey, :normalIdentityKey) = :identityKey)',
        {
          userId,
          identityKey: requestIdentity.identityKey,
          normalIdentityKey: requestIdentity.normalIdentityKey,
        },
      )
      .orderBy('message.createdAt', 'DESC');

    this.applyRoomVisibilitySessionFilter(
      queryBuilder,
      userId,
      requestIdentity.identityKey,
      { activeOnly: !keepRoomChatHistory },
    );

    if (roomName) {
      queryBuilder.andWhere('LOWER(room.name) = :roomName', {
        roomName: roomName.trim().toLocaleLowerCase('tr-TR'),
      });
    }

    const messages = await queryBuilder.getMany();
    await this.normalizeHistoryMessageAssets(messages);
    return messages.map((message) => this.toResponse(message));
  }

  private toResponse(message: Message): MessageResponseDto {
    const resolveHistoryIcon = (icon?: string | null): string | null =>
      this.normalizeStoredAssetPath(icon);

    const mapUser = (
      user:
        | (Message['user'] & {
            role?: Message['user']['role'] | null;
          })
        | null
        | undefined,
      fallbackUserId: number | null,
      fallbackPublicName?: string | null,
      styleSnapshot?: {
        fontName?: string | null;
        granite?: string | null;
        nickColor?: string | null;
      },
    ): MessageResponseDto['user'] => {
      const username = user?.username ?? 'Silinen Kullanıcı';
      const explicitPublicName = this.cleanDisplayName(fallbackPublicName);
      const agentNickname =
        explicitPublicName && explicitPublicName !== username
          ? explicitPublicName
          : this.resolveAgentNickname(username);
      return {
        id: user?.id ?? fallbackUserId ?? 0,
        username,
        displayUsername: explicitPublicName || agentNickname || username,
        agentNickname,
        gender: user?.gender ?? 'male',
        isGuest: user?.isGuest === true,
        icon: agentNickname ? null : resolveHistoryIcon(user?.icon),
        fontName: styleSnapshot?.fontName ?? (agentNickname ? null : (user?.fontName ?? null)),
        granite: styleSnapshot?.granite ?? (agentNickname ? null : (user?.granite ?? null)),
        nickColor: styleSnapshot?.nickColor ?? (agentNickname ? null : (user?.nickColor ?? null)),
        flashNick: agentNickname ? null : (user?.flashNick ?? null),
        role: user?.role
          ? {
              id: user.role.id,
              name: user.role.name,
              starCount: user.role.starCount,
              starColor: user.role.starColor,
              icon: user.role.icon ?? null,
            }
          : null,
      };
    };

    const replyContent =
      message.replyToMessage?.content ||
      (message.replyToMessage?.image
        ? '📷 Görsel'
        : message.replyToMessage?.audio
          ? '🎤 Sesli Mesaj'
          : '');

    const isBot = Boolean(message.botId);
    const botUser: MessageResponseDto['user'] | null = isBot
      ? {
          id: 0,
          username: message.botUsername || 'Bot',
          displayUsername: message.botUsername || 'Bot',
          agentNickname: null,
          gender: message.botGender || 'female',
          isGuest: false,
          icon: resolveHistoryIcon(message.botAvatar),
          fontName: message.botFontName ?? null,
          granite: message.botGranite ?? null,
          nickColor: null,
          flashNick: null,
          role: null,
        }
      : null;

    return {
      id: message.id,
      content: message.content,
      type: message.type,
      userId: message.userId,
      user:
        botUser ??
        mapUser(message.user, message.userId, message.senderPublicName, {
          fontName: message.userFontName ?? null,
          granite: message.userGranite ?? null,
          nickColor: message.userNickColor ?? null,
        }),
      roomId: message.roomId,
      replyToMessageId: message.replyToMessageId ?? null,
      replyToMessage: message.replyToMessage
        ? {
            id: message.replyToMessage.id,
            content: replyContent,
            user: mapUser(
              message.replyToMessage.user,
              message.replyToMessage.userId,
              message.replyToMessage.senderPublicName,
              {
                fontName: message.replyToMessage.userFontName ?? null,
                granite: message.replyToMessage.userGranite ?? null,
                nickColor: message.replyToMessage.userNickColor ?? null,
              },
            ),
            createdAt: this.toIsoDate(message.replyToMessage.createdAt) as any,
          }
        : null,
      image: message.image ?? null,
      audio: message.audio ?? null,
      audioFileName: message.audioFileName ?? null,
      fontColor: message.fontColor ?? null,
      targetGroup: message.targetGroup ?? null,
      botId: message.botId ?? null,
      botUsername: message.botUsername ?? null,
      botSpeakerUsername: message.botSpeakerUsername ?? null,
      botSpeakerDisplayName: message.botSpeakerDisplayName ?? null,
      createdAt: this.toIsoDate(message.createdAt) as any,
      updatedAt: this.toIsoDate(message.updatedAt) as any,
    };
  }
}
