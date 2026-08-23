import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot } from './entities/bot.entity';
import { BotMutePreference } from './entities/bot-mute-preference.entity';
import { Message } from '../messages/entities/message.entity';
import { RoomsGateway } from '../rooms/rooms.gateway';
import { Room } from '../rooms/entities/room.entity';
import { Role } from '../role/entities/role.entity';

@Injectable()
export class BotService implements OnModuleInit {
  private static readonly MAX_BOT_ROLE_STAR_COUNT = 24;
  private static readonly LOBBY_ROOM_ALIASES = new Set(['lobby', 'lobi']);
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(BotMutePreference)
    private readonly botMutePreferenceRepository: Repository<BotMutePreference>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @Inject(forwardRef(() => RoomsGateway))
    private readonly roomsGateway: RoomsGateway,
  ) {}

  async onModuleInit() {
    // Wait a bit for RoomsGateway to be fully initialized
    setTimeout(async () => {
      const bots = await this.findAll();
      for (const bot of bots) {
        await this.syncBotPresence(bot);
      }
    }, 5000);
  }

  private normalize(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }

  private normalizePermission(value?: string | null): string {
    return (value || '').trim().toLocaleLowerCase('tr-TR');
  }

  private isLobbyAlias(value?: string | null): boolean {
    const normalized = this.normalize(value);
    return Boolean(
      normalized && BotService.LOBBY_ROOM_ALIASES.has(normalized),
    );
  }

  private async findRoleByName(roleName?: string | null): Promise<Role | null> {
    const normalizedRole = this.normalize(roleName);
    if (!normalizedRole) return null;

    return this.roleRepository
      .createQueryBuilder('role')
      .where('LOWER(role.name) = :roleName', { roleName: normalizedRole })
      .getOne();
  }

  private async ensureBotRoleIsAllowed(roleName?: string | null): Promise<void> {
    const role = await this.findRoleByName(roleName);
    if (
      role &&
      (role.starCount ?? 0) > BotService.MAX_BOT_ROLE_STAR_COUNT
    ) {
      throw new BadRequestException(
        `Bot rolü en fazla ${BotService.MAX_BOT_ROLE_STAR_COUNT} yıldız olabilir.`,
      );
    }
  }

  private async ensureSingleAiBot(
    isAI?: boolean,
    currentBotId?: number,
  ): Promise<void> {
    if (isAI !== true) return;

    const existingAiBot = await this.botRepository.findOne({
      where: { isAI: true },
    });

    if (existingAiBot && existingAiBot.id !== currentBotId) {
      throw new BadRequestException('Yalnızca bir yapay zeka botu olabilir.');
    }
  }

  private async resolveLobbyRoomKey(): Promise<string> {
    const roomEntity = await this.roomRepository
      .createQueryBuilder('room')
      .where('LOWER(room.voiceId) = :lobby', { lobby: 'lobby' })
      .orWhere('LOWER(room.name) IN (:...names)', {
        names: ['lobby', 'lobi'],
      })
      .getOne();

    return roomEntity?.voiceId || roomEntity?.name || 'lobby';
  }

  private async normalizeBotData(botData: Partial<Bot>): Promise<Partial<Bot>> {
    const next = { ...botData };

    if (next.isAI !== true) {
      next.isAI = false;
      next.welcomeMessage = null;
      next.welcomeAutoSendEnabled = true;
      next.welcomeManualPromptEnabled = true;
    } else {
      const manualEnabled = next.welcomeManualPromptEnabled === true;
      next.welcomeManualPromptEnabled = manualEnabled;
      next.welcomeAutoSendEnabled = !manualEnabled;
      next.room = await this.resolveLobbyRoomKey();
    }

    return next;
  }

  private async reconcileSingleAiBot(bots?: Bot[]): Promise<Bot[]> {
    const currentBots = bots ?? (await this.botRepository.find());
    const aiBots = currentBots.filter((bot) => bot.isAI);

    if (aiBots.length <= 1) {
      return currentBots;
    }

    const keepBot = [...aiBots].sort((a, b) => {
      const updatedDiff =
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime();
      return updatedDiff || b.id - a.id;
    })[0];

    const duplicateAiBotIds = aiBots
      .filter((bot) => bot.id !== keepBot.id)
      .map((bot) => bot.id);

    if (duplicateAiBotIds.length > 0) {
      await this.botRepository
        .createQueryBuilder()
        .update(Bot)
        .set({
          isAI: false,
          welcomeMessage: null,
        })
        .whereInIds(duplicateAiBotIds)
        .execute();
    }

    return this.botRepository.find();
  }

  private hasMessagePermission(bot: Bot): boolean {
    return this.normalizePermission(bot.messagePermission) ===
      this.normalizePermission('Mesaj Yazabilir');
  }

  private async resolveBotRoomKey(room?: string | null): Promise<string | null> {
    const normalizedRoom = this.normalize(room);
    if (!normalizedRoom) return null;
    if (this.isLobbyAlias(normalizedRoom)) {
      return this.resolveLobbyRoomKey();
    }

    const roomEntity = await this.roomRepository
      .createQueryBuilder('room')
      .where('LOWER(room.name) = :roomName', { roomName: normalizedRoom })
      .orWhere('LOWER(room.voiceId) = :voiceId', { voiceId: normalizedRoom })
      .getOne();

    return roomEntity?.voiceId || roomEntity?.name || room?.trim() || null;
  }

  private async resolveRoleVisual(roleName?: string | null): Promise<{
    roleName?: string;
    roleStarColor?: string;
    roleStarCount?: number;
    roleIcon?: string;
  }> {
    const normalizedRole = this.normalize(roleName);
    if (!normalizedRole) return {};

    const role = await this.findRoleByName(roleName);

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

  private async syncBotPresence(
    bot: Bot,
    options: { broadcast?: boolean } = {},
  ) {
    const roomKey = await this.resolveBotRoomKey(bot.room);
    if (roomKey) {
      const roleVisual = await this.resolveRoleVisual(bot.role);
      this.logger.log(
        `Syncing bot "${bot.username}" into room "${roomKey}" (configured: "${bot.room}")`,
      );
      this.roomsGateway.registerBotMember(
        roomKey,
        {
          socketId: `bot_${bot.id}`,
          username: bot.username,
          gender: bot.gender,
          isGuest: false,
          icon: bot.avatar,
          roleName: roleVisual.roleName ?? bot.role,
          roleStarColor: roleVisual.roleStarColor,
          roleStarCount: roleVisual.roleStarCount,
          roleIcon: roleVisual.roleIcon,
          statusModeName: bot.statusMode,
          deviceType: bot.loginType,
          device: bot.loginType,
          clientType: bot.loginType,
          fontName: bot.fontName,
          granite: bot.granite,
          userGif: bot.userGif,
          isBot: true,
          isAI: bot.isAI === true,
          roomMuted: bot.roomMuted && bot.roomMutedRoomKey === roomKey,
          roomMutedByStarCount:
            bot.roomMuted && bot.roomMutedRoomKey === roomKey ? 1 : 0,
          globalMuted: bot.globalMuted,
          globalMutedByStarCount: bot.globalMuted ? 1 : 0,
        },
        { broadcast: options.broadcast },
      );
    } else {
      this.logger.warn(
        `Bot "${bot.username}" was not synced because it has no room configured.`,
      );
    }
  }

  async findAll(): Promise<Bot[]> {
    return this.reconcileSingleAiBot();
  }

  async findOne(id: number): Promise<Bot> {
    const bot = await this.botRepository.findOne({ where: { id } });
    if (!bot) throw new NotFoundException('Bot bulunamadı');
    return bot;
  }

  async getPreferences() {
    const bots = await this.botRepository.find({
      where: [{ globalMuted: true }, { roomMuted: true }],
      order: { id: 'ASC' },
    });

    return bots.flatMap((bot) => {
      const preferences: Array<{
        botId: number;
        username: string;
        roomKey: string | null;
        muted: boolean;
        scope: 'room' | 'global';
      }> = [];

      if (bot.globalMuted) {
        preferences.push({
          botId: bot.id,
          username: bot.username,
          roomKey: null,
          muted: true,
          scope: 'global',
        });
      }

      if (bot.roomMuted && bot.roomMutedRoomKey) {
        preferences.push({
          botId: bot.id,
          username: bot.username,
          roomKey: bot.roomMutedRoomKey,
          muted: true,
          scope: 'room',
        });
      }

      return preferences;
    });
  }

  async toggleRoomMute(botId: number, roomKey: string) {
    const bot = await this.findOne(botId);
    const resolvedRoomKey = await this.resolveBotRoomKey(roomKey);
    if (!resolvedRoomKey) {
      throw new BadRequestException('Oda bulunamadı');
    }

    const currentMutedRoomKey = await this.resolveBotRoomKey(
      bot.roomMutedRoomKey,
    );
    const shouldUnmute =
      bot.roomMuted === true && currentMutedRoomKey === resolvedRoomKey;

    bot.roomMuted = !shouldUnmute;
    bot.roomMutedRoomKey = shouldUnmute ? null : resolvedRoomKey;

    const saved = await this.botRepository.save(bot);
    await this.syncBotPresence(saved, { broadcast: true });
    this.roomsGateway.notifyBotPresenceChanged({
      type: 'updated',
      username: saved.username,
      roomKey: await this.resolveBotRoomKey(saved.room),
    });

    return {
      botId,
      username: bot.username,
      roomKey: saved.roomMuted ? resolvedRoomKey : null,
      muted: saved.roomMuted,
      scope: 'room',
    };
  }

  async toggleGlobalMute(botId: number) {
    const bot = await this.findOne(botId);
    bot.globalMuted = !bot.globalMuted;

    const saved = await this.botRepository.save(bot);
    await this.syncBotPresence(saved, { broadcast: true });
    this.roomsGateway.notifyBotPresenceChanged({
      type: 'updated',
      username: saved.username,
      roomKey: await this.resolveBotRoomKey(saved.room),
    });

    return {
      botId,
      username: bot.username,
      roomKey: null,
      muted: saved.globalMuted,
      scope: 'global',
    };
  }

  async speak(
    botId: number,
    message: string,
    speakerUsername: string,
    speakerDisplayName?: string | null,
  ) {
    const bot = await this.findOne(botId);
    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Mesaj boş olamaz');
    }
    if (!this.hasMessagePermission(bot)) {
      throw new ForbiddenException('İzin yok');
    }

    const roomKey = await this.resolveBotRoomKey(bot.room);
    if (!roomKey) {
      throw new BadRequestException('Bot odada değil');
    }
    if (bot.globalMuted) {
      throw new ForbiddenException('Susturuldu');
    }
    const mutedRoomKey = await this.resolveBotRoomKey(bot.roomMutedRoomKey);
    if (bot.roomMuted && mutedRoomKey === roomKey) {
      throw new ForbiddenException('Susturuldu');
    }

    // Find the room entity to get the roomId for persistence
    const normalizedRoom = (roomKey || '').trim().toLowerCase();
    const roomEntity = await this.roomRepository
      .createQueryBuilder('room')
      .where('LOWER(room.name) = :roomName', { roomName: normalizedRoom })
      .orWhere('LOWER(room.voiceId) = :voiceId', { voiceId: normalizedRoom })
      .getOne();

    let savedMessageId: number | undefined;

    if (roomEntity) {
      try {
        const savedMessage = await this.messageRepository.save(
          this.messageRepository.create({
            content: trimmedMessage,
            type: 'normal' as any,
            userId: null,
            roomId: roomEntity.id,
            botId: bot.id,
            botUsername: bot.username,
            botSpeakerUsername: speakerUsername,
            botSpeakerDisplayName: speakerDisplayName ?? speakerUsername,
            botAvatar: bot.avatar ?? null,
            botGender: bot.gender ?? null,
            botFontName: bot.fontName ?? null,
            botGranite: bot.granite ?? null,
            senderPublicName: bot.username,
            senderIdentityKey: `bot_${bot.id}`,
            senderIdentityType: 'normal',
          }),
        );
        savedMessageId = savedMessage.id;
      } catch (error) {
        this.logger.warn(
          `Failed to persist bot message for bot "${bot.username}": ${error?.message || error}`,
        );
      }
    }

    this.roomsGateway.emitBotMessage(roomKey, {
      botId: bot.id,
      username: bot.username,
      message: trimmedMessage,
      gender: bot.gender,
      icon: bot.avatar,
      botSpeakerUsername: speakerUsername,
      botSpeakerDisplayName: speakerDisplayName,
      messageId: savedMessageId,
    });

    return { status: 'ok', room: roomKey };
  }

  async create(botData: Partial<Bot>): Promise<Bot> {
    await this.ensureBotRoleIsAllowed(botData.role);
    const bot = this.botRepository.create(
      await this.normalizeBotData({
        ...botData,
        isAI: false,
        welcomeMessage: null,
      }),
    );
    const saved = await this.botRepository.save(bot);
    await this.syncBotPresence(saved, { broadcast: false });
    this.roomsGateway.notifyBotPresenceChanged({
      type: 'created',
      username: saved.username,
      roomKey: await this.resolveBotRoomKey(saved.room),
    });
    return saved;
  }

  async update(id: number, botData: Partial<Bot>): Promise<Bot> {
    if (Object.prototype.hasOwnProperty.call(botData, 'role')) {
      await this.ensureBotRoleIsAllowed(botData.role);
    }
    const existing = await this.findOne(id);
    const nextIsAI = Object.prototype.hasOwnProperty.call(botData, 'isAI')
      ? botData.isAI === true
      : existing.isAI === true;
    await this.ensureSingleAiBot(nextIsAI, id);
    if (nextIsAI) {
      await this.botRepository
        .createQueryBuilder()
        .update(Bot)
        .set({
          isAI: false,
          welcomeMessage: null,
        })
        .where('id != :id', { id })
        .andWhere('isAI = :isAI', { isAI: true })
        .execute();
    }

    const previousRoomKey = existing.room
      ? await this.resolveBotRoomKey(existing.room)
      : null;
    const hasRoomUpdate = Object.prototype.hasOwnProperty.call(botData, 'room');
    const hasUsernameUpdate = Object.prototype.hasOwnProperty.call(
      botData,
      'username',
    );
    const usernameChanged =
      hasUsernameUpdate &&
      this.normalize(existing.username) !== this.normalize(botData.username);
    if (
      existing.room &&
      ((hasRoomUpdate && existing.room !== botData.room) || usernameChanged)
    ) {
      if (previousRoomKey) {
        this.roomsGateway.unregisterBotMember(previousRoomKey, existing.username, {
          broadcast: false,
        });
      }
    }
    await this.botRepository.update(
      id,
      await this.normalizeBotData({
        ...botData,
        isAI: nextIsAI,
      }),
    );
    const updated = await this.findOne(id);
    await this.syncBotPresence(updated, { broadcast: false });
    this.roomsGateway.notifyBotPresenceChanged({
      type: 'updated',
      username: updated.username,
      previousUsername: usernameChanged ? existing.username : null,
      roomKey: await this.resolveBotRoomKey(updated.room),
      previousRoomKey,
    });
    return updated;
  }

  async remove(id: number): Promise<void> {
    const bot = await this.findOne(id);
    if (bot.isAI) {
      throw new BadRequestException('Yapay zeka botu silinemez.');
    }

    let roomKey: string | null = null;
    if (bot.room) {
      roomKey = await this.resolveBotRoomKey(bot.room);
      if (roomKey) {
        this.roomsGateway.unregisterBotMember(roomKey, bot.username, {
          broadcast: false,
        });
      }
    }
    await this.botRepository.delete(id);
    this.roomsGateway.notifyBotPresenceChanged({
      type: 'deleted',
      username: bot.username,
      previousRoomKey: roomKey,
    });
  }
}
