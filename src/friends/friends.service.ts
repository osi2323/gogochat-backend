import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  FriendRequest,
  FriendRequestStatus,
} from './entities/friend-request.entity';
import { User } from '../user/entities/user.entity';
import { defaultChatPreferences } from '../user/chat-preferences.constants';
import { FriendRequestResponseDto } from './dto/friend-request-response.dto';
import { FriendUserDto } from './dto/friend-user.dto';
import { FriendsGateway } from './friends.gateway';
import { buildIdentity } from '../common/agent-identity.util';

type FriendIdentity = {
  userId: number;
  identityKey: string;
  identityType: 'normal' | 'agent';
  publicName: string;
};

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(FriendRequest)
    private readonly friendRequestRepo: Repository<FriendRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly friendsGateway: FriendsGateway,
  ) {}

  private buildFriendIdentity(
    user: { id: number; username: string },
    agentNickname?: string | null,
  ): FriendIdentity {
    const identity = buildIdentity(user.id, agentNickname);
    return {
      userId: user.id,
      identityKey: identity.identityKey,
      identityType: identity.identityType,
      publicName: identity.normalizedAgentNickname || user.username,
    };
  }

  private getCompatibleIdentityKeys(identity: FriendIdentity): string[] {
    return [identity.identityKey];
  }

  private requestSideIdentity(
    request: FriendRequest,
    side: 'requester' | 'addressee',
  ): FriendIdentity {
    const userId =
      side === 'requester' ? request.requesterId : request.addresseeId;
    const identityKey =
      side === 'requester'
        ? request.requesterIdentityKey
        : request.addresseeIdentityKey;
    const identityType =
      side === 'requester'
        ? request.requesterIdentityType
        : request.addresseeIdentityType;
    const publicName =
      side === 'requester'
        ? request.requesterDisplayName
        : request.addresseeDisplayName;
    return {
      userId,
      identityKey: identityKey || '',
      identityType: identityType || 'normal',
      publicName: publicName || '',
    };
  }

  private toFriendUser(user: User, identity?: FriendIdentity): FriendUserDto {
    const isAgent = identity?.identityType === 'agent';
    const displayUsername = identity?.publicName?.trim() || user.username;
    return {
      id: user.id,
      username: user.username,
      displayUsername,
      agentNickname: isAgent ? displayUsername : null,
      gender: user.gender,
      icon: isAgent ? null : (user.icon ?? null),
      frame: isAgent ? null : (user.frame ?? null),
      roleName: isAgent ? 'Misafir' : (user.role?.name ?? null),
      roleIcon: user.role?.icon ?? null,
      roleStarColor: user.role?.starColor ?? null,
      roleStarCount: user.role?.starCount ?? null,
      userGif: isAgent ? null : (user.userGif ?? null),
    };
  }

  private toResponse(
    request: FriendRequest,
    otherUser: User,
    otherIdentity?: FriendIdentity,
  ): FriendRequestResponseDto {
    return {
      id: request.id,
      requesterId: request.requesterId,
      addresseeId: request.addresseeId,
      status: request.status,
      user: this.toFriendUser(otherUser, otherIdentity),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private isRequesterIdentity(
    request: FriendRequest,
    identity: FriendIdentity,
  ) {
    return (
      request.requesterId === identity.userId &&
      this.getCompatibleIdentityKeys(identity).includes(
        request.requesterIdentityKey || '',
      )
    );
  }

  private isAddresseeIdentity(
    request: FriendRequest,
    identity: FriendIdentity,
  ) {
    return (
      request.addresseeId === identity.userId &&
      this.getCompatibleIdentityKeys(identity).includes(
        request.addresseeIdentityKey || '',
      )
    );
  }

  private getOtherSide(request: FriendRequest, identity: FriendIdentity) {
    return this.isRequesterIdentity(request, identity) ? 'addressee' : 'requester';
  }

  private async findUserOrFail(username: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { username },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return user;
  }

  private normalizeUsername(value: string) {
    return value.trim().toLowerCase();
  }

  private normalizeIgnoredUsernames(values: string[], selfUsername: string) {
    const normalizedSelfUsername = this.normalizeUsername(selfUsername);
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => this.normalizeUsername(String(value || '')))
          .filter(
            (value) => value.length > 0 && value !== normalizedSelfUsername,
          ),
      ),
    );
  }

  private async findUserByIdOrFail(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return user;
  }

  async isBlockedBetweenUsers(userId: number, targetUserId: number) {
    if (!userId || !targetUserId || userId === targetUserId) {
      return false;
    }

    const blocked = await this.friendRequestRepo.findOne({
      where: [
        {
          requesterId: userId,
          addresseeId: targetUserId,
          status: FriendRequestStatus.BLOCKED,
        },
        {
          requesterId: targetUserId,
          addresseeId: userId,
          status: FriendRequestStatus.BLOCKED,
        },
      ],
      select: ['id'],
    });

    return Boolean(blocked);
  }

  async isBlockedBetweenUsernames(
    username: string,
    targetUsername: string,
  ): Promise<boolean> {
    const normalizedUsername = this.normalizeUsername(username);
    const normalizedTarget = this.normalizeUsername(targetUsername);
    if (!normalizedUsername || !normalizedTarget) {
      return false;
    }
    if (normalizedUsername === normalizedTarget) {
      return false;
    }

    const users = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.username) IN (:...usernames)', {
        usernames: [normalizedUsername, normalizedTarget],
      })
      .select(['user.id', 'user.username'])
      .getMany();
    if (users.length < 2) {
      return false;
    }

    const user = users.find(
      (item) => this.normalizeUsername(item.username) === normalizedUsername,
    );
    const target = users.find(
      (item) => this.normalizeUsername(item.username) === normalizedTarget,
    );
    if (!user || !target) {
      return false;
    }

    return this.isBlockedBetweenUsers(user.id, target.id);
  }

  async ensureNotBlockedBetweenUsers(userId: number, targetUserId: number) {
    const blocked = await this.isBlockedBetweenUsers(userId, targetUserId);
    if (blocked) {
      throw new ForbiddenException(
        'Bu kullanıcıyla özel iletişim engelli durumda.',
      );
    }
  }

  async sendRequest(
    tenantId: string | undefined,
    requesterId: number,
    agentNickname: string | undefined,
    targetUsername: string,
    targetAgentNickname?: string,
  ): Promise<FriendRequestResponseDto> {
    const requester = await this.userRepo.findOne({
      where: { id: requesterId },
    });
    if (!requester) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const target = await this.findUserOrFail(targetUsername);
    const requesterIdentity = this.buildFriendIdentity(requester, agentNickname);
    const targetIdentity = this.buildFriendIdentity(target, targetAgentNickname);
    if (requester.id === target.id) {
      throw new BadRequestException('Kendinize istek gönderemezsiniz');
    }

    if (requester.isGuest === true) {
      throw new ForbiddenException(
        'Misafir kullanıcılar arkadaşlık isteği gönderemez',
      );
    }

    if (target.isGuest === true) {
      throw new ForbiddenException(
        'Misafir kullanıcılara arkadaşlık isteği gönderilemez',
      );
    }

    const targetRejectsFriendRequests =
      target.chatPreferences?.rejectFriendRequests === true;

    if (targetRejectsFriendRequests) {
      throw new ForbiddenException(
        'Bu kullanıcı arkadaşlık isteklerini kabul etmiyor',
      );
    }

    const existingActive = await this.friendRequestRepo.findOne({
      where: [
        {
          requesterId: requester.id,
          requesterIdentityKey: In(this.getCompatibleIdentityKeys(requesterIdentity)),
          addresseeId: target.id,
          addresseeIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
          status: In([
            FriendRequestStatus.PENDING,
            FriendRequestStatus.ACCEPTED,
            FriendRequestStatus.BLOCKED,
          ]),
        },
        {
          requesterId: target.id,
          requesterIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
          addresseeId: requester.id,
          addresseeIdentityKey: In(this.getCompatibleIdentityKeys(requesterIdentity)),
          status: In([
            FriendRequestStatus.PENDING,
            FriendRequestStatus.ACCEPTED,
            FriendRequestStatus.BLOCKED,
          ]),
        },
      ],
    });

    if (existingActive) {
      if (existingActive.status === FriendRequestStatus.BLOCKED) {
        throw new ForbiddenException('Bu kullanıcı ile işlem yapılamaz');
      }
      throw new BadRequestException('Zaten bekleyen/aktif bir istek var');
    }

    const request = this.friendRequestRepo.create({
      requesterId: requester.id,
      addresseeId: target.id,
      requesterIdentityKey: requesterIdentity.identityKey,
      requesterIdentityType: requesterIdentity.identityType,
      requesterDisplayName: requesterIdentity.publicName,
      addresseeIdentityKey: targetIdentity.identityKey,
      addresseeIdentityType: targetIdentity.identityType,
      addresseeDisplayName: targetIdentity.publicName,
      status: FriendRequestStatus.PENDING,
    });
    const saved = await this.friendRequestRepo.save(request);

    const response = this.toResponse(saved, target, targetIdentity);
    await this.friendsGateway.emitRequestCreated(
      tenantId,
      [requester.username, target.username],
      response,
    );
    return response;
  }

  async getFriends(
    userId: number,
    agentNickname?: string,
  ): Promise<FriendRequestResponseDto[]> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const identityKeys = this.getCompatibleIdentityKeys(identity);
    const requests = await this.friendRequestRepo.find({
      where: [
        {
          requesterId: userId,
          requesterIdentityKey: In(identityKeys),
          status: FriendRequestStatus.ACCEPTED,
        },
        {
          addresseeId: userId,
          addresseeIdentityKey: In(identityKeys),
          status: FriendRequestStatus.ACCEPTED,
        },
      ],
      order: { updatedAt: 'DESC' },
    });

    if (!requests.length) return [];

    const userIds = new Set<number>();
    requests.forEach((r) => {
      userIds.add(r.requesterId);
      userIds.add(r.addresseeId);
    });
    const users = await this.userRepo.find({
      where: { id: In(Array.from(userIds)) },
      relations: ['role'],
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const otherIds = Array.from(
      new Set(
        requests.map((request) =>
          request.requesterId === userId
            ? request.addresseeId
            : request.requesterId,
        ),
      ),
    );
    const blockedRelations = await this.friendRequestRepo.find({
      where: [
        {
          requesterId: userId,
          addresseeId: In(otherIds),
          status: FriendRequestStatus.BLOCKED,
        },
        {
          addresseeId: userId,
          requesterId: In(otherIds),
          status: FriendRequestStatus.BLOCKED,
        },
      ],
      select: ['requesterId', 'addresseeId'],
    });
    const blockedOtherIdSet = new Set(
      blockedRelations.map((relation) =>
        relation.requesterId === userId
          ? relation.addresseeId
          : relation.requesterId,
      ),
    );

    return requests
      .filter((request) => {
        const otherSide = this.getOtherSide(request, identity);
        const otherId =
          otherSide === 'addressee' ? request.addresseeId : request.requesterId;
        return !blockedOtherIdSet.has(otherId);
      })
      .map((request) => {
        const otherSide = this.getOtherSide(request, identity);
        const otherId =
          otherSide === 'addressee' ? request.addresseeId : request.requesterId;
        const other = userMap.get(otherId);
        if (!other) {
          throw new NotFoundException('Kullanıcı bulunamadı');
        }
        return this.toResponse(
          request,
          other,
          this.requestSideIdentity(request, otherSide),
        );
      });
  }

  async getIncoming(
    userId: number,
    agentNickname?: string,
  ): Promise<FriendRequestResponseDto[]> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const requests = await this.friendRequestRepo.find({
      where: {
        addresseeId: userId,
        addresseeIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
        status: FriendRequestStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
    if (!requests.length) return [];
    const requesterIds = requests.map((r) => r.requesterId);
    const users = await this.userRepo.find({
      where: { id: In(requesterIds) },
      relations: ['role'],
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return requests.map((r) => {
      const other = userMap.get(r.requesterId);
      if (!other) {
        throw new NotFoundException('Kullanıcı bulunamadı');
      }
      return this.toResponse(r, other, this.requestSideIdentity(r, 'requester'));
    });
  }

  async getOutgoing(
    userId: number,
    agentNickname?: string,
  ): Promise<FriendRequestResponseDto[]> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const requests = await this.friendRequestRepo.find({
      where: {
        requesterId: userId,
        requesterIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
        status: FriendRequestStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
    if (!requests.length) return [];
    const addresseeIds = requests.map((r) => r.addresseeId);
    const users = await this.userRepo.find({
      where: { id: In(addresseeIds) },
      relations: ['role'],
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return requests.map((r) => {
      const other = userMap.get(r.addresseeId);
      if (!other) {
        throw new NotFoundException('Kullanıcı bulunamadı');
      }
      return this.toResponse(r, other, this.requestSideIdentity(r, 'addressee'));
    });
  }

  async getBlockedUsers(userId: number, agentNickname?: string) {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const blockedRequests = await this.friendRequestRepo.find({
      where: {
        status: FriendRequestStatus.BLOCKED,
        blockedById: userId,
        requesterId: userId,
        requesterIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
      },
      order: { updatedAt: 'DESC' },
    });
    if (!blockedRequests.length) return [];

    const targetIds = blockedRequests.map((request) =>
      request.requesterId === userId
        ? request.addresseeId
        : request.requesterId,
    );
    const users = await this.userRepo.find({
      where: { id: In(targetIds) },
      relations: ['role'],
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return blockedRequests
      .map((request) => {
        const targetId = request.addresseeId;
        const user = userMap.get(targetId);
        if (!user) return null;
        return this.toFriendUser(
          user,
          this.requestSideIdentity(request, 'addressee'),
        );
      })
      .filter((item): item is FriendUserDto => item !== null);
  }

  async clearBlockedUsers(
    tenantId: string | undefined,
    userId: number,
    agentNickname?: string,
  ): Promise<{ status: 'ok'; clearedCount: number }> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const blockedRequests = await this.friendRequestRepo.find({
      where: {
        status: FriendRequestStatus.BLOCKED,
        blockedById: userId,
        requesterId: userId,
        requesterIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
      },
    });

    if (!blockedRequests.length) {
      return { status: 'ok', clearedCount: 0 };
    }

    for (const request of blockedRequests) {
      request.status = FriendRequestStatus.CANCELED;
      request.blockedById = null;
    }
    await this.friendRequestRepo.save(blockedRequests);

    const targetIds = blockedRequests.map((request) => request.addresseeId);
    const users = await this.userRepo.findBy({
      id: In([userId, ...targetIds]),
    });
    await this.friendsGateway.emitRequestRemoved(
      tenantId,
      users.map((u) => u.username),
      { id: 0, status: FriendRequestStatus.CANCELED },
    );

    return { status: 'ok', clearedCount: blockedRequests.length };
  }

  async getIgnoredUsers(userId: number) {
    const user = await this.findUserByIdOrFail(userId);
    const ignoredUsernames = this.normalizeIgnoredUsernames(
      user.chatPreferences?.ignoredUsernames ?? [],
      user.username,
    );
    return ignoredUsernames;
  }

  async ignoreUser(userId: number, targetUsername: string) {
    const user = await this.findUserByIdOrFail(userId);
    const targetUser = await this.findUserOrFail(targetUsername);
    if (user.id === targetUser.id) {
      throw new BadRequestException('Kendinizi görmezden gelemezsiniz');
    }

    const currentIgnored = this.normalizeIgnoredUsernames(
      user.chatPreferences?.ignoredUsernames ?? [],
      user.username,
    );
    const normalizedTargetUsername = this.normalizeUsername(
      targetUser.username,
    );
    const nextIgnored = Array.from(
      new Set([...currentIgnored, normalizedTargetUsername]),
    );
    user.chatPreferences = {
      ...defaultChatPreferences,
      ...(user.chatPreferences ?? {}),
      ignoredUsernames: nextIgnored,
    };
    await this.userRepo.save(user);
    return { status: 'ok' as const };
  }

  async unignoreUser(userId: number, targetUsername: string) {
    const user = await this.findUserByIdOrFail(userId);
    const targetUser = await this.findUserOrFail(targetUsername);
    const normalizedTargetUsername = this.normalizeUsername(
      targetUser.username,
    );
    const currentIgnored = this.normalizeIgnoredUsernames(
      user.chatPreferences?.ignoredUsernames ?? [],
      user.username,
    );
    user.chatPreferences = {
      ...defaultChatPreferences,
      ...(user.chatPreferences ?? {}),
      ignoredUsernames: currentIgnored.filter(
        (username) => username !== normalizedTargetUsername,
      ),
    };
    await this.userRepo.save(user);
    return { status: 'ok' as const };
  }

  async getRelation(
    userId: number,
    agentNickname: string | undefined,
    targetUsername: string,
    targetAgentNickname?: string,
  ) {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const target = await this.findUserOrFail(targetUsername);
    const targetIdentity = this.buildFriendIdentity(target, targetAgentNickname);
    if (
      target.id === userId &&
      targetIdentity.identityKey === identity.identityKey
    ) {
      return {
        targetUsername: target.username,
        isFriend: false,
        hasIncomingRequest: false,
        hasOutgoingRequest: false,
        isBlockedByMe: false,
        isBlockedByOther: false,
        isBlockedEitherWay: false,
      };
    }

    const relations = await this.friendRequestRepo.find({
      where: [
        {
          requesterId: userId,
          requesterIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
          addresseeId: target.id,
          addresseeIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
        },
        {
          requesterId: target.id,
          requesterIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
          addresseeId: userId,
          addresseeIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
        },
      ],
      order: { updatedAt: 'DESC' },
    });
    const isBlockedByMe = relations.some(
      (relation) =>
        relation.status === FriendRequestStatus.BLOCKED &&
        relation.blockedById === userId && this.isRequesterIdentity(relation, identity),
    );
    const isBlockedByOther = relations.some(
      (relation) =>
        relation.status === FriendRequestStatus.BLOCKED &&
        relation.blockedById === target.id &&
        this.isRequesterIdentity(relation, targetIdentity),
    );
    const isBlockedEitherWay = isBlockedByMe || isBlockedByOther;
    const latestActive = relations.find(
      (relation) =>
        relation.status === FriendRequestStatus.ACCEPTED ||
        relation.status === FriendRequestStatus.PENDING,
    );
    const isFriend =
      !isBlockedEitherWay &&
      latestActive?.status === FriendRequestStatus.ACCEPTED;
    const hasIncomingRequest =
      !isBlockedEitherWay &&
      latestActive?.status === FriendRequestStatus.PENDING &&
      this.isAddresseeIdentity(latestActive, identity);
    const hasOutgoingRequest =
      !isBlockedEitherWay &&
      latestActive?.status === FriendRequestStatus.PENDING &&
      this.isRequesterIdentity(latestActive, identity);

    return {
      targetUsername: target.username,
      isFriend: Boolean(isFriend),
      hasIncomingRequest: Boolean(hasIncomingRequest),
      hasOutgoingRequest: Boolean(hasOutgoingRequest),
      isBlockedByMe: Boolean(isBlockedByMe),
      isBlockedByOther: Boolean(isBlockedByOther),
      isBlockedEitherWay: Boolean(isBlockedEitherWay),
    };
  }

  async acceptRequest(
    tenantId: string | undefined,
    requestId: number,
    userId: number,
    agentNickname?: string,
  ): Promise<FriendRequestResponseDto> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const request = await this.friendRequestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('İstek bulunamadı');
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Bu istek artık işlenemez');
    }
    if (!this.isAddresseeIdentity(request, identity)) {
      throw new ForbiddenException('Bu isteği kabul edemezsiniz');
    }
    request.status = FriendRequestStatus.ACCEPTED;
    const saved = await this.friendRequestRepo.save(request);

    const users = await this.userRepo.findBy({
      id: In([request.requesterId, request.addresseeId]),
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const requester = userMap.get(request.requesterId);
    const addressee = userMap.get(request.addresseeId);
    if (!requester || !addressee) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    const other = saved.requesterId === userId ? addressee : requester;
    const response = this.toResponse(
      saved,
      other,
      this.requestSideIdentity(saved, 'requester'),
    );

    await this.friendsGateway.emitRequestUpdated(
      tenantId,
      [requester.username, addressee.username],
      response,
    );
    return response;
  }

  async rejectRequest(
    tenantId: string | undefined,
    requestId: number,
    userId: number,
    agentNickname?: string,
  ): Promise<{ status: 'ok' }> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const request = await this.friendRequestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('İstek bulunamadı');
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Bu istek artık işlenemez');
    }
    if (!this.isAddresseeIdentity(request, identity)) {
      throw new ForbiddenException('Bu isteği reddedemezsiniz');
    }
    request.status = FriendRequestStatus.REJECTED;
    await this.friendRequestRepo.save(request);

    const users = await this.userRepo.findBy({
      id: In([request.requesterId, request.addresseeId]),
    });
    await this.friendsGateway.emitRequestRemoved(
      tenantId,
      users.map((u) => u.username),
      { id: request.id, status: FriendRequestStatus.REJECTED },
    );

    return { status: 'ok' };
  }

  async cancelRequest(
    tenantId: string | undefined,
    requestId: number,
    userId: number,
    agentNickname?: string,
  ): Promise<{ status: 'ok' }> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const request = await this.friendRequestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('İstek bulunamadı');
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Bu istek artık işlenemez');
    }
    if (!this.isRequesterIdentity(request, identity)) {
      throw new ForbiddenException('Bu isteği iptal edemezsiniz');
    }
    request.status = FriendRequestStatus.CANCELED;
    await this.friendRequestRepo.save(request);

    const users = await this.userRepo.findBy({
      id: In([request.requesterId, request.addresseeId]),
    });
    await this.friendsGateway.emitRequestRemoved(
      tenantId,
      users.map((u) => u.username),
      { id: request.id, status: FriendRequestStatus.CANCELED },
    );

    return { status: 'ok' };
  }

  async blockUser(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
    targetUsername: string,
    targetAgentNickname?: string,
  ): Promise<{ status: 'ok' }> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const target = await this.findUserOrFail(targetUsername);
    const targetIdentity = this.buildFriendIdentity(target, targetAgentNickname);
    if (target.id === userId) {
      throw new BadRequestException('Kendinizi engelleyemezsiniz');
    }

    const pairRequests = await this.friendRequestRepo.find({
      where: [
        {
          requesterId: userId,
          requesterIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
          addresseeId: target.id,
          addresseeIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
        },
        {
          requesterId: target.id,
          requesterIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
          addresseeId: userId,
          addresseeIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
        },
      ],
      order: { updatedAt: 'DESC' },
    });
    let request =
      pairRequests.find(
        (relation) =>
          relation.status === FriendRequestStatus.BLOCKED &&
          relation.blockedById === userId &&
          this.isRequesterIdentity(relation, identity),
      ) ?? pairRequests.find((relation) => this.isRequesterIdentity(relation, identity));

    if (!request) {
      request = this.friendRequestRepo.create({
        requesterId: userId,
        addresseeId: target.id,
        requesterIdentityKey: identity.identityKey,
        requesterIdentityType: identity.identityType,
        requesterDisplayName: identity.publicName,
        addresseeIdentityKey: targetIdentity.identityKey,
        addresseeIdentityType: targetIdentity.identityType,
        addresseeDisplayName: targetIdentity.publicName,
        status: FriendRequestStatus.BLOCKED,
        blockedById: userId,
      });
      await this.friendRequestRepo.save(request);
    } else {
      request.status = FriendRequestStatus.BLOCKED;
      request.blockedById = userId;
      await this.friendRequestRepo.save(request);
    }

    const staleRelations = pairRequests.filter(
      (relation) =>
        relation.id !== request.id &&
        (relation.status === FriendRequestStatus.ACCEPTED ||
          relation.status === FriendRequestStatus.PENDING ||
          relation.status === FriendRequestStatus.BLOCKED),
    );
    if (staleRelations.length) {
      for (const staleRelation of staleRelations) {
        staleRelation.status = FriendRequestStatus.CANCELED;
        staleRelation.blockedById = null;
      }
      await this.friendRequestRepo.save(staleRelations);
    }

    const users = await this.userRepo.findBy({
      id: In([userId, target.id]),
    });
    await this.friendsGateway.emitRequestRemoved(
      tenantId,
      users.map((u) => u.username),
      { id: request.id, status: FriendRequestStatus.BLOCKED },
    );

    return { status: 'ok' };
  }

  async removeFriend(
    tenantId: string | undefined,
    requestId: number,
    userId: number,
    agentNickname?: string,
  ): Promise<{ status: 'ok' }> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const request = await this.friendRequestRepo.findOne({
      where: { id: requestId, status: FriendRequestStatus.ACCEPTED },
    });
    if (!request) {
      throw new NotFoundException('Arkadaşlık kaydı bulunamadı');
    }
    if (
      !this.isRequesterIdentity(request, identity) &&
      !this.isAddresseeIdentity(request, identity)
    ) {
      throw new ForbiddenException('Bu arkadaşlığı silemezsiniz');
    }

    request.status = FriendRequestStatus.CANCELED;
    await this.friendRequestRepo.save(request);

    const users = await this.userRepo.findBy({
      id: In([request.requesterId, request.addresseeId]),
    });
    await this.friendsGateway.emitRequestRemoved(
      tenantId,
      users.map((u) => u.username),
      { id: request.id, status: FriendRequestStatus.CANCELED },
    );

    return { status: 'ok' };
  }

  async unblockUser(
    tenantId: string | undefined,
    userId: number,
    agentNickname: string | undefined,
    targetUsername: string,
  ): Promise<{ status: 'ok' }> {
    const currentUser = await this.findUserByIdOrFail(userId);
    const identity = this.buildFriendIdentity(currentUser, agentNickname);
    const target = await this.findUserOrFail(targetUsername);
    const pairRequests = await this.friendRequestRepo.find({
      where: [
        {
          requesterId: userId,
          requesterIdentityKey: In(this.getCompatibleIdentityKeys(identity)),
          addresseeId: target.id,
        },
        { requesterId: target.id, addresseeId: userId },
      ],
      order: { updatedAt: 'DESC' },
    });

    const ownedBlock = pairRequests.find(
      (request) =>
        request.status === FriendRequestStatus.BLOCKED &&
        request.blockedById === userId && this.isRequesterIdentity(request, identity),
    );
    if (!ownedBlock) {
      throw new NotFoundException('Engel kaydı bulunamadı');
    }

    const recordsToCancel = pairRequests.filter(
      (request) =>
        (request.status === FriendRequestStatus.BLOCKED &&
          request.blockedById === userId) ||
        request.status === FriendRequestStatus.ACCEPTED ||
        request.status === FriendRequestStatus.PENDING,
    );
    for (const request of recordsToCancel) {
      request.status = FriendRequestStatus.CANCELED;
      request.blockedById = null;
    }
    await this.friendRequestRepo.save(recordsToCancel);

    const users = await this.userRepo.findBy({
      id: In([userId, target.id]),
    });
    await this.friendsGateway.emitRequestRemoved(
      tenantId,
      users.map((u) => u.username),
      { id: ownedBlock.id, status: FriendRequestStatus.CANCELED },
    );

    return { status: 'ok' };
  }
}
