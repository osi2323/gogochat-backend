import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { User } from '../user/entities/user.entity';
import { CreateDirectMessageDto } from './dto/create-direct-message.dto';
import { DirectMessagesGateway } from './direct-messages.gateway';
import { FriendsService } from '../friends/friends.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { RoomsStateService } from '../rooms/rooms-state.service';
import { buildIdentity } from '../common/agent-identity.util';
import { CommunicationPermissionsResponseDto } from '../settings/dto/communication-permissions-response.dto';

type UserIdentity = {
  userId: number;
  identityKey: string;
  identityType: 'normal' | 'agent';
  publicName: string;
};

@Injectable()
export class DirectMessagesService {
  constructor(
    @InjectRepository(DirectConversation)
    private readonly conversationRepository: Repository<DirectConversation>,
    @InjectRepository(DirectMessage)
    private readonly messageRepository: Repository<DirectMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dmGateway: DirectMessagesGateway,
    private readonly friendsService: FriendsService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly roomsState: RoomsStateService,
  ) {}

  private normalizeTenantId(tenantId?: string) {
    if (!tenantId) return 'tenant_master';
    return String(tenantId).replace(/^tenant_/, '') || 'tenant_master';
  }

  private resolveAgentNickname(
    tenantId: string | undefined,
    username: string | null | undefined,
  ): string | null {
    const normalizedUsername = (username || '').trim().toLowerCase();
    if (!normalizedUsername) return null;
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    for (const members of this.roomsState.rooms.values()) {
      const member = members.get(normalizedUsername);
      if (!member) continue;
      const memberTenant = member.tenantId || 'tenant_master';
      if (memberTenant !== normalizedTenantId) continue;
      const nickname = member.agentNickname?.trim();
      if (nickname) return nickname;
    }
    return null;
  }

  private cleanDisplayName(value?: string | null): string | null {
    const normalized = (value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toDirectMessageDisplayDate(value?: Date | string | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const displayDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);

    const parts = new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(displayDate);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '00';

    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart(
      'hour',
    )}:${getPart('minute')}:${getPart('second')}`;
  }

  private getDirectMessageReplyContent(message?: DirectMessage | null): string {
    if (!message) return '';
    const content = (message.content || '').trim();
    if (content) return content;
    if (message.image) return '📷 Görsel';
    if (message.audio) return '🎤 Sesli Mesaj';
    return '';
  }

  private mapDirectMessageReply(message?: DirectMessage | null) {
    if (!message) return null;
    return {
      id: message.id,
      content: this.getDirectMessageReplyContent(message),
      sender: {
        id: message.sender?.id ?? message.senderId,
        username: message.sender?.username ?? '',
        displayUsername:
          this.cleanDisplayName(message.senderDisplayName) ||
          message.sender?.username ||
          '',
        agentNickname:
          message.senderIdentityType === 'agent'
            ? this.cleanDisplayName(message.senderDisplayName)
            : null,
      },
      createdAt: this.toDirectMessageDisplayDate(message.createdAt),
    };
  }

  private resolveDisplayIcon(
    tenantId: string | undefined,
    username: string | null | undefined,
    icon: string | null | undefined,
    explicitAgentNickname?: string | null,
  ) {
    const nickname =
      this.cleanDisplayName(explicitAgentNickname) ||
      this.resolveAgentNickname(tenantId, username);
    if (nickname) return null;
    return icon ?? null;
  }

  private getStoredDisplayNameForUser(
    conversation: DirectConversation,
    userId: number,
    identityKey: string,
  ): string | null {
    if (
      conversation.user1Id === userId &&
      conversation.user1IdentityKey === identityKey
    ) {
      return this.cleanDisplayName(conversation.user1DisplayName);
    }
    if (
      conversation.user2Id === userId &&
      conversation.user2IdentityKey === identityKey
    ) {
      return this.cleanDisplayName(conversation.user2DisplayName);
    }
    return null;
  }

  private setStoredDisplayNameForIdentity(
    conversation: DirectConversation,
    identity: UserIdentity,
  ) {
    const normalized = this.cleanDisplayName(identity.publicName);
    if (!normalized) return;

    if (
      conversation.user1Id === identity.userId &&
      conversation.user1IdentityKey === identity.identityKey
    ) {
      conversation.user1DisplayName = normalized;
      return;
    }

    if (
      conversation.user2Id === identity.userId &&
      conversation.user2IdentityKey === identity.identityKey
    ) {
      conversation.user2DisplayName = normalized;
    }
  }

  private resolveConversationDisplayUsername(
    conversation: DirectConversation,
    identity: UserIdentity,
    fallbackUsername: string | null | undefined,
  ): string {
    const storedDisplayName = this.getStoredDisplayNameForUser(
      conversation,
      identity.userId,
      identity.identityKey,
    );
    if (storedDisplayName) return storedDisplayName;
    return this.cleanDisplayName(identity.publicName) || (fallbackUsername || '').trim();
  }

  private resolveConversationRoleName(
    user: User,
    identity: Pick<UserIdentity, 'identityType'>,
  ): string | null {
    if (identity.identityType === 'agent') return 'Misafir';
    return user.role?.name ?? null;
  }

  private resolveConversationAgentNickname(
    identity: Pick<UserIdentity, 'identityType' | 'publicName'>,
  ): string | null {
    if (identity.identityType !== 'agent') return null;
    return this.cleanDisplayName(identity.publicName);
  }

  private resolveConversationIdentity(
    conversation: DirectConversation,
    userId: number,
    fallbackUsername: string,
  ): UserIdentity {
    if (conversation.user1Id === userId) {
      return {
        userId: conversation.user1Id,
        identityKey: conversation.user1IdentityKey,
        identityType: conversation.user1IdentityType,
        publicName: conversation.user1DisplayName || fallbackUsername,
      };
    }

    return {
      userId: conversation.user2Id,
      identityKey: conversation.user2IdentityKey,
      identityType: conversation.user2IdentityType,
      publicName: conversation.user2DisplayName || fallbackUsername,
    };
  }

  private normalizePair(left: UserIdentity, right: UserIdentity) {
    if (left.userId < right.userId) {
      return { user1: left, user2: right };
    }
    if (left.userId > right.userId) {
      return { user1: right, user2: left };
    }
    return left.identityKey <= right.identityKey
      ? { user1: left, user2: right }
      : { user1: right, user2: left };
  }

  private resolveOtherUser(
    conversation: DirectConversation,
    userId: number,
    identityKey: string,
  ): User | null {
    if (conversation.user1Id === userId && conversation.user1IdentityKey === identityKey) {
      return conversation.user2 ?? null;
    }
    if (conversation.user2Id === userId && conversation.user2IdentityKey === identityKey) {
      return conversation.user1 ?? null;
    }
    return null;
  }

  private getLastReadAt(
    conversation: DirectConversation,
    userId: number,
    identityKey: string,
  ) {
    if (conversation.user1Id === userId && conversation.user1IdentityKey === identityKey) {
      return conversation.lastReadAtUser1;
    }
    if (conversation.user2Id === userId && conversation.user2IdentityKey === identityKey) {
      return conversation.lastReadAtUser2;
    }
    return null;
  }

  private getClearedAt(
    conversation: DirectConversation,
    userId: number,
    identityKey: string,
  ) {
    if (conversation.user1Id === userId && conversation.user1IdentityKey === identityKey) {
      return conversation.clearedAtUser1;
    }
    if (conversation.user2Id === userId && conversation.user2IdentityKey === identityKey) {
      return conversation.clearedAtUser2;
    }
    return null;
  }

  private getDeletedAt(
    conversation: DirectConversation,
    userId: number,
    identityKey: string,
  ) {
    if (conversation.user1Id === userId && conversation.user1IdentityKey === identityKey) {
      return conversation.deletedAtUser1;
    }
    if (conversation.user2Id === userId && conversation.user2IdentityKey === identityKey) {
      return conversation.deletedAtUser2;
    }
    return null;
  }

  private getVisibilityThreshold(
    conversation: DirectConversation,
    userId: number,
    identityKey: string,
  ) {
    const lastReadAt = this.getLastReadAt(conversation, userId, identityKey);
    const clearedAt = this.getClearedAt(conversation, userId, identityKey);
    if (!lastReadAt) return clearedAt ?? null;
    if (!clearedAt) return lastReadAt ?? null;
    return lastReadAt > clearedAt ? lastReadAt : clearedAt;
  }

  private normalizeDate(value?: Date | string | null): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private reviveRecipientConversationForMessage(
    conversation: DirectConversation,
    recipientIsUser1: boolean,
    messageCreatedAt: Date,
  ) {
    const visibleFrom = new Date(Math.max(0, messageCreatedAt.getTime() - 1));
    const currentClearedAt = recipientIsUser1
      ? this.normalizeDate(conversation.clearedAtUser1)
      : this.normalizeDate(conversation.clearedAtUser2);
    const currentLastReadAt = recipientIsUser1
      ? this.normalizeDate(conversation.lastReadAtUser1)
      : this.normalizeDate(conversation.lastReadAtUser2);

    if (recipientIsUser1) {
      conversation.deletedAtUser1 = null;
      if (currentClearedAt && currentClearedAt >= messageCreatedAt) {
        conversation.clearedAtUser1 = visibleFrom;
      }
      if (currentLastReadAt && currentLastReadAt >= messageCreatedAt) {
        conversation.lastReadAtUser1 = visibleFrom;
      }
      return;
    }

    conversation.deletedAtUser2 = null;
    if (currentClearedAt && currentClearedAt >= messageCreatedAt) {
      conversation.clearedAtUser2 = visibleFrom;
    }
    if (currentLastReadAt && currentLastReadAt >= messageCreatedAt) {
      conversation.lastReadAtUser2 = visibleFrom;
    }
  }

  private async computeUnreadCount(
    conversationId: number,
    identityKey: string,
    thresholdAt: Date | null | undefined,
  ) {
    const qb = this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .andWhere('m.senderIdentityKey != :identityKey', { identityKey });

    if (thresholdAt) {
      qb.andWhere('m.createdAt > :thresholdAt', { thresholdAt });
    }

    return qb.getCount();
  }

  private privateMessageDisabledError(
    isGuestUser: boolean,
  ): ForbiddenException {
    return new ForbiddenException(
      isGuestUser
        ? 'Misafirlere özel mesaj kapalı.'
        : 'Üyelere özel mesaj kapalı.',
    );
  }

  private isPrivateMessagingEnabledForUser(
    user: User,
    settings: CommunicationPermissionsResponseDto,
  ): boolean {
    return user.isGuest
      ? settings.guestPrivateMessageEnabled
      : settings.membersPrivateMessageEnabled;
  }

  private isAuthorityUser(user?: User | null): boolean {
    return Number(user?.role?.starCount ?? 0) > 0;
  }

  private canReplyWhenPrivateMessagingDisabled(peer?: User | null): boolean {
    return !!peer && peer.isGuest !== true;
  }

  private assertPrivateMessagePermission(
    user: User,
    settings: CommunicationPermissionsResponseDto,
  ): void {
    if (!this.isPrivateMessagingEnabledForUser(user, settings)) {
      throw this.privateMessageDisabledError(user.isGuest);
    }
  }

  private buildUserIdentity(
    userId: number,
    username: string,
    explicitAgentNickname?: string | null,
  ): UserIdentity {
    const identity = buildIdentity(userId, explicitAgentNickname);
    return {
      userId,
      identityKey: identity.identityKey,
      identityType: identity.identityType,
      publicName: identity.normalizedAgentNickname || username,
    };
  }

  async createConversation(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
    targetUsername: string,
    targetAgentNickname?: string,
  ) {
    const trimmedTarget = targetUsername?.trim();
    if (!trimmedTarget) {
      throw new BadRequestException('targetUsername is required');
    }

    const targetUser = await this.userRepository.findOne({
      where: { username: trimmedTarget },
      relations: ['role'],
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('Cannot start conversation with yourself');
    }

    const callerUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!callerUser) {
      throw new NotFoundException('User not found');
    }

    const settings =
      await this.systemSettingsService.getCommunicationPermissions();

    const callerIdentity = this.buildUserIdentity(
      callerUser.id,
      callerUser.username,
      agentNickname,
    );
    const targetIdentity = this.buildUserIdentity(
      targetUser.id,
      targetUser.username,
      targetAgentNickname?.trim() || this.resolveAgentNickname(tenantId, targetUser.username),
    );
    const { user1, user2 } = this.normalizePair(callerIdentity, targetIdentity);

    let conversation = await this.conversationRepository.findOne({
      where: {
        user1Id: user1.userId,
        user2Id: user2.userId,
        user1IdentityKey: user1.identityKey,
        user2IdentityKey: user2.identityKey,
      },
      relations: ['user1', 'user2', 'user1.role', 'user2.role'],
    });

    this.assertPrivateMessagePermission(callerUser, settings);

    await this.friendsService.ensureNotBlockedBetweenUsers(
      userId,
      targetUser.id,
    );

    if (!conversation) {
      const now = new Date();
      const newConversation = this.conversationRepository.create({
        user1Id: user1.userId,
        user2Id: user2.userId,
        user1IdentityKey: user1.identityKey,
        user1IdentityType: user1.identityType,
        user2IdentityKey: user2.identityKey,
        user2IdentityType: user2.identityType,
        user1DisplayName: this.cleanDisplayName(user1.publicName),
        user2DisplayName: this.cleanDisplayName(user2.publicName),
        lastReadAtUser1: user1.userId === callerUser.id ? now : null,
        lastReadAtUser2: user2.userId === callerUser.id ? now : null,
      });
      try {
        await this.conversationRepository.save(newConversation);
        conversation = await this.conversationRepository.findOne({
          where: { id: newConversation.id },
          relations: ['user1', 'user2', 'user1.role', 'user2.role'],
        });
      } catch (error) {
        const duplicateError =
          error instanceof QueryFailedError &&
          (error as any).driverError?.code === '23505';

        if (!duplicateError) {
          throw error;
        }

        conversation = await this.conversationRepository.findOne({
          where: {
            user1Id: user1.userId,
            user2Id: user2.userId,
            user1IdentityKey: user1.identityKey,
            user2IdentityKey: user2.identityKey,
          },
          relations: ['user1', 'user2', 'user1.role', 'user2.role'],
        });
      }
    }

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    this.setStoredDisplayNameForIdentity(conversation, callerIdentity);
    this.setStoredDisplayNameForIdentity(conversation, targetIdentity);
    if (
      conversation.user1Id === callerIdentity.userId &&
      conversation.user1IdentityKey === callerIdentity.identityKey
    ) {
      conversation.deletedAtUser1 = null;
      conversation.clearedAtUser1 = null;
    } else if (
      conversation.user2Id === callerIdentity.userId &&
      conversation.user2IdentityKey === callerIdentity.identityKey
    ) {
      conversation.deletedAtUser2 = null;
      conversation.clearedAtUser2 = null;
    }
    await this.conversationRepository.save(conversation);

    const otherUser = this.resolveOtherUser(
      conversation,
      callerIdentity.userId,
      callerIdentity.identityKey,
    );
    if (!otherUser) {
      throw new NotFoundException('Conversation peer not found');
    }

    return {
      conversationId: conversation.id,
      otherUser: {
        ...otherUser,
        displayUsername: this.resolveConversationDisplayUsername(
          conversation,
          targetIdentity,
          otherUser.username,
        ),
        icon: this.resolveDisplayIcon(
          tenantId,
          otherUser.username,
          otherUser.icon,
          targetIdentity.identityType === 'agent' ? targetIdentity.publicName : null,
        ),
        roleName: this.resolveConversationRoleName(otherUser, targetIdentity),
        agentNickname: this.resolveConversationAgentNickname(targetIdentity),
      },
      lastMessageAt: conversation.lastMessageAt,
    };
  }

  async listConversations(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
  ) {
    const callerIdentity = this.buildUserIdentity(
      userId,
      '',
      agentNickname,
    );
    const callerUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!callerUser) {
      throw new NotFoundException('User not found');
    }
    const settings =
      await this.systemSettingsService.getCommunicationPermissions();
    const callerAllowed = this.isPrivateMessagingEnabledForUser(
      callerUser,
      settings,
    );

    const conversations = await this.conversationRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user1', 'user1')
      .leftJoinAndSelect('c.user2', 'user2')
      .leftJoinAndSelect('user1.role', 'user1Role')
      .leftJoinAndSelect('user2.role', 'user2Role')
      .where(
        '(c.user1Id = :userId AND c.user1IdentityKey = :identityKey) OR (c.user2Id = :userId AND c.user2IdentityKey = :identityKey)',
        { userId, identityKey: callerIdentity.identityKey },
      )
      .orderBy('c.lastMessageAt', 'DESC')
      .addOrderBy('c.updatedAt', 'DESC')
      .getMany();
    const results = [] as any[];

    for (const conversation of conversations) {
      const deletedAt = this.getDeletedAt(
        conversation,
        callerIdentity.userId,
        callerIdentity.identityKey,
      );
      if (deletedAt) {
        continue;
      }

      const clearedAt = this.getClearedAt(
        conversation,
        callerIdentity.userId,
        callerIdentity.identityKey,
      );
      const lastMessageQb = this.messageRepository
        .createQueryBuilder('m')
        .where('m.conversationId = :conversationId', {
          conversationId: conversation.id,
        });
      if (clearedAt) {
        lastMessageQb.andWhere('m.createdAt > :clearedAt', { clearedAt });
      }
      const lastMessage = await lastMessageQb
        .leftJoinAndSelect('m.replyToMessage', 'replyToMessage')
        .leftJoinAndSelect('replyToMessage.sender', 'replyToSender')
        .orderBy('m.createdAt', 'DESC')
        .getOne();

      const thresholdAt = this.getVisibilityThreshold(
        conversation,
        callerIdentity.userId,
        callerIdentity.identityKey,
      );
      const unreadCount = await this.computeUnreadCount(
        conversation.id,
        callerIdentity.identityKey,
        thresholdAt,
      );
      if (callerUser.isGuest && !callerAllowed && unreadCount <= 0) {
        continue;
      }

      const otherUser = this.resolveOtherUser(
        conversation,
        callerIdentity.userId,
        callerIdentity.identityKey,
      );
      if (!otherUser) {
        continue;
      }

      const otherIdentity =
        conversation.user1Id === callerIdentity.userId &&
        conversation.user1IdentityKey === callerIdentity.identityKey
          ? {
              userId: conversation.user2Id,
              identityKey: conversation.user2IdentityKey,
              identityType: conversation.user2IdentityType,
              publicName: conversation.user2DisplayName || otherUser.username,
            }
          : {
              userId: conversation.user1Id,
              identityKey: conversation.user1IdentityKey,
              identityType: conversation.user1IdentityType,
              publicName: conversation.user1DisplayName || otherUser.username,
            };

      const isBlocked = await this.friendsService.isBlockedBetweenUsers(
        userId,
        otherUser.id,
      );
      let canCurrentUserSendMessage =
        callerAllowed ||
        this.canReplyWhenPrivateMessagingDisabled(otherUser);
      if (isBlocked) {
        canCurrentUserSendMessage = false;
      }

      results.push({
        id: conversation.id,
        otherUser: {
          ...otherUser,
          displayUsername: this.resolveConversationDisplayUsername(
            conversation,
            otherIdentity,
            otherUser.username,
          ),
          icon: this.resolveDisplayIcon(
            tenantId,
            otherUser.username,
            otherUser.icon,
            otherIdentity.identityType === 'agent' ? otherIdentity.publicName : null,
          ),
          roleName: this.resolveConversationRoleName(otherUser, otherIdentity),
          agentNickname: this.resolveConversationAgentNickname(otherIdentity),
          isOnline: await this.dmGateway.isUserOnline(
            tenantId,
            otherUser.username,
            this.resolveConversationAgentNickname(otherIdentity),
          ),
        },
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              image: lastMessage.image,
              audio: lastMessage.audio,
              audioFileName: lastMessage.audioFileName,
              replyToMessage: this.mapDirectMessageReply(
                lastMessage.replyToMessage,
              ),
              senderId: lastMessage.senderId,
              createdAt: this.toDirectMessageDisplayDate(lastMessage.createdAt),
            }
          : null,
        lastMessageAt: this.toDirectMessageDisplayDate(lastMessage?.createdAt),
        unreadCount,
        isBlocked,
        canCurrentUserSendMessage,
      });
    }

    return results.sort(
      (a, b) =>
        new Date(b.lastMessageAt || 0).getTime() -
        new Date(a.lastMessageAt || 0).getTime(),
    );
  }

  async getMessages(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
    conversationId: number,
    limit = 30,
    beforeId?: number,
  ) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isInConversation =
      (conversation.user1Id === userId &&
        conversation.user1IdentityKey === callerIdentity.identityKey) ||
      (conversation.user2Id === userId &&
        conversation.user2IdentityKey === callerIdentity.identityKey);

    if (!isInConversation) {
      throw new ForbiddenException();
    }

    const qb = this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.replyToMessage', 'replyToMessage')
      .leftJoinAndSelect('replyToMessage.sender', 'replyToSender')
      .where('m.conversationId = :conversationId', { conversationId })
      .orderBy('m.createdAt', 'DESC')
      .take(limit);

    const clearedAt = this.getClearedAt(
      conversation,
      callerIdentity.userId,
      callerIdentity.identityKey,
    );
    if (clearedAt) {
      qb.andWhere('m.createdAt > :clearedAt', { clearedAt });
    }

    if (beforeId) {
      qb.andWhere('m.id < :beforeId', { beforeId });
    }

    const messages = await qb.getMany();

    return messages.map((m) => ({
      id: m.id,
      content: m.content,
      image: m.image,
      audio: m.audio,
      audioFileName: m.audioFileName,
      replyToMessage: this.mapDirectMessageReply(m.replyToMessage),
      sender: {
        id: m.sender.id,
        username: m.sender.username,
        displayUsername: this.cleanDisplayName(m.senderDisplayName) || m.sender.username,
        agentNickname:
          m.senderIdentityType === 'agent'
            ? this.cleanDisplayName(m.senderDisplayName)
            : null,
        roleStarCount: m.sender.role?.starCount ?? null,
        gender: m.sender.gender,
        icon:
          m.senderIdentityType === 'agent'
            ? null
            : this.resolveDisplayIcon(
                tenantId,
                m.sender.username,
                m.sender.icon,
              ),
      },
      senderId: m.senderId,
      createdAt: this.toDirectMessageDisplayDate(m.createdAt),
    }));
  }

  async sendMessage(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
    conversationId: number,
    payload: CreateDirectMessageDto,
  ) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['user1', 'user2', 'user1.role', 'user2.role'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isCallerUser1 =
      conversation.user1Id === userId &&
      conversation.user1IdentityKey === callerIdentity.identityKey;
    const isCallerUser2 =
      conversation.user2Id === userId &&
      conversation.user2IdentityKey === callerIdentity.identityKey;

    if (!isCallerUser1 && !isCallerUser2) {
      throw new ForbiddenException();
    }

    const content = payload.content?.trim() ?? '';
    const hasContent = content.length > 0;
    const hasImage = !!payload.image;
    const hasAudio = !!payload.audio;

    if (!hasContent && !hasImage && !hasAudio) {
      throw new BadRequestException('Message content is empty');
    }

    let replyToMessage: DirectMessage | null = null;
    if (payload.replyToMessageId != null) {
      replyToMessage = await this.messageRepository.findOne({
        where: { id: payload.replyToMessageId },
        relations: ['sender'],
      });

      if (!replyToMessage || replyToMessage.conversationId !== conversationId) {
        throw new BadRequestException('Yanıtlanan mesaj bulunamadı.');
      }
    }

    const targetUser = isCallerUser1 ? conversation.user2 : conversation.user1;
    if (!targetUser) {
      throw new NotFoundException('Conversation peer not found');
    }

    const senderUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!senderUser) {
      throw new NotFoundException('Conversation sender not found');
    }
    const settings =
      await this.systemSettingsService.getCommunicationPermissions();
    const senderCanInitiate = this.isPrivateMessagingEnabledForUser(
      senderUser,
      settings,
    );
    const senderCanReplyToExistingMember =
      this.canReplyWhenPrivateMessagingDisabled(targetUser);
    if (!senderCanInitiate && !senderCanReplyToExistingMember) {
      throw this.privateMessageDisabledError(senderUser.isGuest);
    }

    await this.friendsService.ensureNotBlockedBetweenUsers(
      userId,
      targetUser.id,
    );

    const targetRejectsDirectMessages =
      targetUser.isGuest !== true &&
      targetUser.chatPreferences?.rejectDirectMessages === true;

    if (targetRejectsDirectMessages) {
      throw new ForbiddenException(
        'Bu kullanıcı özel mesajları kabul etmiyor.',
      );
    }

    const targetBlocksDmWhenOffline =
      targetUser.isGuest !== true &&
      targetUser.chatPreferences?.blockDmWhenTargetOffline === true;

    if (targetBlocksDmWhenOffline) {
      const isTargetOnline = await this.dmGateway.isUserOnline(
        tenantId,
        targetUser.username,
      );

      if (!isTargetOnline) {
        throw new ForbiddenException(
          'Kullanıcı çevrimdışıyken özel mesaj kabul etmiyor.',
        );
      }
    }

    const senderDisplayName =
      this.cleanDisplayName(
        isCallerUser1 ? conversation.user1DisplayName : conversation.user2DisplayName,
      ) || senderUser.username;

    const message = this.messageRepository.create({
      conversationId,
      senderId: userId,
      senderIdentityKey: callerIdentity.identityKey,
      senderIdentityType: callerIdentity.identityType,
      senderDisplayName,
      content: hasContent ? content : null,
      image: payload.image ?? null,
      audio: payload.audio ?? null,
      audioFileName: payload.audioFileName ?? null,
      replyToMessageId: replyToMessage?.id ?? null,
    });

    const saved = await this.messageRepository.save(message);

    const now = new Date();
    if (isCallerUser1) {
      conversation.lastReadAtUser1 = now;
      conversation.deletedAtUser1 = null;
      conversation.clearedAtUser1 = null;
    } else {
      conversation.lastReadAtUser2 = now;
      conversation.deletedAtUser2 = null;
      conversation.clearedAtUser2 = null;
    }
    conversation.lastMessageAt = now;

    const savedMessage = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['sender', 'sender.role', 'replyToMessage', 'replyToMessage.sender'],
    });

    if (!savedMessage) {
      throw new NotFoundException('Message not found');
    }

    const savedMessageCreatedAt =
      this.normalizeDate(savedMessage.createdAt) ?? now;
    this.reviveRecipientConversationForMessage(
      conversation,
      !isCallerUser1,
      savedMessageCreatedAt,
    );
    await this.conversationRepository.save(conversation);

    const targetIdentityKey = isCallerUser1
      ? conversation.user2IdentityKey
      : conversation.user1IdentityKey;

    const lastReadAtTarget = this.getVisibilityThreshold(
      conversation,
      targetUser.id,
      targetIdentityKey,
    );
    const unreadCount = await this.computeUnreadCount(
      conversation.id,
      targetIdentityKey,
      lastReadAtTarget,
    );

    const targetAgentNickname =
      targetIdentityKey === conversation.user1IdentityKey
        ? this.resolveConversationAgentNickname({
            identityType: conversation.user1IdentityType,
            publicName: conversation.user1DisplayName || targetUser.username,
          })
        : this.resolveConversationAgentNickname({
            identityType: conversation.user2IdentityType,
            publicName: conversation.user2DisplayName || targetUser.username,
          });

    await this.dmGateway.emitNewMessage(tenantId, targetUser.username, {
      conversationId: conversation.id,
      message: {
        id: savedMessage.id,
        content: savedMessage.content,
        image: savedMessage.image,
        audio: savedMessage.audio,
        audioFileName: savedMessage.audioFileName,
        replyToMessage: this.mapDirectMessageReply(savedMessage.replyToMessage),
        senderId: savedMessage.senderId,
        createdAt: this.toDirectMessageDisplayDate(savedMessage.createdAt),
      },
      sender: {
        id: savedMessage.sender.id,
        username: savedMessage.sender.username,
        displayUsername: this.cleanDisplayName(savedMessage.senderDisplayName) || savedMessage.sender.username,
        agentNickname:
          savedMessage.senderIdentityType === 'agent'
            ? this.cleanDisplayName(savedMessage.senderDisplayName)
            : null,
        roleStarCount: savedMessage.sender.role?.starCount ?? null,
        gender: savedMessage.sender.gender,
        icon: savedMessage.senderIdentityType === 'agent'
          ? null
          : this.resolveDisplayIcon(
              tenantId,
              savedMessage.sender.username,
              savedMessage.sender.icon,
            ),
      },
      unreadCount,
    }, targetAgentNickname);

    return {
      id: savedMessage.id,
      content: savedMessage.content,
      image: savedMessage.image,
      audio: savedMessage.audio,
      audioFileName: savedMessage.audioFileName,
      replyToMessage: this.mapDirectMessageReply(savedMessage.replyToMessage),
      sender: {
        id: savedMessage.sender.id,
        username: savedMessage.sender.username,
        displayUsername: this.cleanDisplayName(savedMessage.senderDisplayName) || savedMessage.sender.username,
        agentNickname:
          savedMessage.senderIdentityType === 'agent'
            ? this.cleanDisplayName(savedMessage.senderDisplayName)
            : null,
        roleStarCount: savedMessage.sender.role?.starCount ?? null,
        gender: savedMessage.sender.gender,
        icon: savedMessage.senderIdentityType === 'agent'
          ? null
          : this.resolveDisplayIcon(
              tenantId,
              savedMessage.sender.username,
              savedMessage.sender.icon,
            ),
      },
      senderId: savedMessage.senderId,
      createdAt: this.toDirectMessageDisplayDate(savedMessage.createdAt),
    };
  }

  async buzzConversation(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
    conversationId: number,
  ) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['user1', 'user2', 'user1.role', 'user2.role'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isCallerUser1 =
      conversation.user1Id === userId &&
      conversation.user1IdentityKey === callerIdentity.identityKey;
    const isCallerUser2 =
      conversation.user2Id === userId &&
      conversation.user2IdentityKey === callerIdentity.identityKey;

    if (!isCallerUser1 && !isCallerUser2) {
      throw new ForbiddenException();
    }

    const senderUser = isCallerUser1 ? conversation.user1 : conversation.user2;
    const targetUser = isCallerUser1 ? conversation.user2 : conversation.user1;
    if (!senderUser || !targetUser) {
      throw new NotFoundException('Conversation peer not found');
    }

    await this.friendsService.ensureNotBlockedBetweenUsers(userId, targetUser.id);

    const targetIdentity = this.resolveConversationIdentity(
      conversation,
      targetUser.id,
      targetUser.username,
    );
    const senderIdentity = this.resolveConversationIdentity(
      conversation,
      senderUser.id,
      senderUser.username,
    );
    const senderDisplayUsername = this.resolveConversationDisplayUsername(
      conversation,
      senderIdentity,
      senderUser.username,
    );

    await this.dmGateway.emitBuzz(
      tenantId,
      targetUser.username,
      {
        conversationId,
        fromUsername: senderUser.username,
        fromDisplayUsername: senderDisplayUsername,
        createdAt: this.toDirectMessageDisplayDate(new Date()),
      },
      this.resolveConversationAgentNickname(targetIdentity),
    );

    return { status: 'ok' };
  }

  async markRead(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
    conversationId: number,
  ) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isCallerUser1 =
      conversation.user1Id === userId &&
      conversation.user1IdentityKey === callerIdentity.identityKey;
    const isCallerUser2 =
      conversation.user2Id === userId &&
      conversation.user2IdentityKey === callerIdentity.identityKey;

    if (!isCallerUser1 && !isCallerUser2) {
      throw new ForbiddenException();
    }

    const now = new Date();
    if (isCallerUser1) {
      conversation.lastReadAtUser1 = now;
    } else {
      conversation.lastReadAtUser2 = now;
    }
    await this.conversationRepository.save(conversation);

    const targetUser = isCallerUser1 ? conversation.user2 : conversation.user1;
    if (!targetUser) {
      throw new NotFoundException('Conversation peer not found');
    }

    await this.dmGateway.emitRead(tenantId, targetUser.username, {
      conversationId: conversation.id,
      readerId: userId,
    });

    return { status: 'ok' };
  }

  async getUnreadCount(userId: number, agentNickname: string | undefined) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);

    const conversations = await this.conversationRepository.find({
      where: [
        { user1Id: userId, user1IdentityKey: callerIdentity.identityKey },
        { user2Id: userId, user2IdentityKey: callerIdentity.identityKey },
      ],
    });

    let total = 0;
    for (const conversation of conversations) {
      const lastReadAt = this.getVisibilityThreshold(
        conversation,
        userId,
        callerIdentity.identityKey,
      );
      total += await this.computeUnreadCount(
        conversation.id,
        callerIdentity.identityKey,
        lastReadAt,
      );
    }

    return { unreadCount: total };
  }

  async clearConversation(
    userId: number,
    agentNickname: string | undefined,
    conversationId: number,
  ) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isCallerUser1 =
      conversation.user1Id === userId &&
      conversation.user1IdentityKey === callerIdentity.identityKey;
    const isCallerUser2 =
      conversation.user2Id === userId &&
      conversation.user2IdentityKey === callerIdentity.identityKey;

    if (!isCallerUser1 && !isCallerUser2) {
      throw new ForbiddenException();
    }

    const now = new Date();
    if (isCallerUser1) {
      conversation.clearedAtUser1 = now;
      conversation.lastReadAtUser1 = now;
    } else {
      conversation.clearedAtUser2 = now;
      conversation.lastReadAtUser2 = now;
    }

    await this.conversationRepository.save(conversation);
    return { status: 'ok' };
  }

  async deleteConversation(
    userId: number,
    agentNickname: string | undefined,
    conversationId: number,
  ) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isCallerUser1 =
      conversation.user1Id === userId &&
      conversation.user1IdentityKey === callerIdentity.identityKey;
    const isCallerUser2 =
      conversation.user2Id === userId &&
      conversation.user2IdentityKey === callerIdentity.identityKey;

    if (!isCallerUser1 && !isCallerUser2) {
      throw new ForbiddenException();
    }

    const now = new Date();
    if (isCallerUser1) {
      conversation.deletedAtUser1 = now;
      conversation.clearedAtUser1 = now;
      conversation.lastReadAtUser1 = now;
    } else {
      conversation.deletedAtUser2 = now;
      conversation.clearedAtUser2 = now;
      conversation.lastReadAtUser2 = now;
    }

    await this.conversationRepository.save(conversation);
    return { status: 'ok' };
  }

  async clearHistory(userId: number, agentNickname: string | undefined) {
    const callerIdentity = this.buildUserIdentity(userId, '', agentNickname);
    const now = new Date();

    await this.conversationRepository
      .createQueryBuilder()
      .update(DirectConversation)
      .set({
        deletedAtUser1: now,
        clearedAtUser1: now,
        lastReadAtUser1: now,
      })
      .where('user1Id = :userId', { userId })
      .andWhere('user1IdentityKey = :identityKey', {
        identityKey: callerIdentity.identityKey,
      })
      .execute();

    await this.conversationRepository
      .createQueryBuilder()
      .update(DirectConversation)
      .set({
        deletedAtUser2: now,
        clearedAtUser2: now,
        lastReadAtUser2: now,
      })
      .where('user2Id = :userId', { userId })
      .andWhere('user2IdentityKey = :identityKey', {
        identityKey: callerIdentity.identityKey,
      })
      .execute();

    return { status: 'ok' };
  }
}
