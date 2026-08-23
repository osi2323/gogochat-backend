import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { FriendsService } from '../friends/friends.service';
import { buildIdentity } from '../common/agent-identity.util';
import {
  ProfileComment,
  ProfileCommentStatus,
} from './entities/profile-comment.entity';
import { CreateProfileCommentDto } from './dto/create-profile-comment.dto';
import { ProfileCommentResponseDto } from './dto/profile-comment-response.dto';

const MAX_PROFILE_COMMENTS = 10;

type ProfileIdentity = {
  userId: number;
  identityKey: string;
  identityType: 'normal' | 'agent';
  publicName: string;
};

@Injectable()
export class ProfileCommentsService {
  constructor(
    @InjectRepository(ProfileComment)
    private readonly profileCommentRepository: Repository<ProfileComment>,
    private readonly userService: UserService,
    private readonly friendsService: FriendsService,
  ) {}

  async listByUsername(
    requesterUserId: number,
    targetUsername: string,
    agentNickname?: string,
    targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto[]> {
    const requester = await this.ensureUserExists(requesterUserId);
    const targetUser = await this.getTargetUser(targetUsername);
    const targetIdentity = this.buildTargetIdentity(
      targetUser,
      requester,
      agentNickname,
      targetAgentNickname,
    );

    const comments = await this.profileCommentRepository.find({
      where: {
        targetUserId: targetUser.id,
        targetIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
        status: ProfileCommentStatus.APPROVED,
      },
      relations: ['user', 'user.role'],
      order: { createdAt: 'ASC' },
    });

    return comments.map((comment) => this.toResponse(comment));
  }

  async listPendingByUsername(
    requesterUserId: number,
    targetUsername: string,
    agentNickname?: string,
    targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto[]> {
    const requester = await this.ensureUserExists(requesterUserId);
    const targetUser = await this.getTargetUser(targetUsername);
    const requesterIdentity = this.buildProfileIdentity(requester, agentNickname);
    const targetIdentity = this.buildTargetIdentity(
      targetUser,
      requester,
      agentNickname,
      targetAgentNickname,
    );
    this.ensureProfileOwner(requesterIdentity, targetIdentity);

    const comments = await this.profileCommentRepository.find({
      where: {
        targetUserId: targetUser.id,
        targetIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
        status: ProfileCommentStatus.PENDING,
      },
      relations: ['user', 'user.role'],
      order: { createdAt: 'ASC' },
    });

    return comments.map((comment) => this.toResponse(comment));
  }

  async listMyPendingByUsername(
    requesterUserId: number,
    targetUsername: string,
    agentNickname?: string,
    targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto[]> {
    const requester = await this.ensureUserExists(requesterUserId);
    const targetUser = await this.getTargetUser(targetUsername);
    const requesterIdentity = this.buildProfileIdentity(requester, agentNickname);
    const targetIdentity = this.buildTargetIdentity(
      targetUser,
      requester,
      agentNickname,
      targetAgentNickname,
    );

    const comments = await this.profileCommentRepository.find({
      where: {
        targetUserId: targetUser.id,
        targetIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
        userId: requester.id,
        authorIdentityKey: In(this.getCompatibleIdentityKeys(requesterIdentity)),
        status: ProfileCommentStatus.PENDING,
      },
      relations: ['user', 'user.role'],
      order: { createdAt: 'ASC' },
    });

    return comments.map((comment) => this.toResponse(comment));
  }

  async create(
    requesterUserId: number,
    targetUsername: string,
    dto: CreateProfileCommentDto,
    agentNickname?: string,
    targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto> {
    const content = dto.content?.trim() || '';
    if (!content) {
      throw new BadRequestException('Yorum boş olamaz');
    }

    const requester = await this.ensureUserExists(requesterUserId);
    if (requester.isGuest) {
      throw new ForbiddenException(
        'Misafir kullanıcılar profil yorumu yapamaz.',
      );
    }

    const targetUser = await this.getTargetUser(targetUsername);
    const requesterIdentity = this.buildProfileIdentity(requester, agentNickname);
    const targetIdentity = this.buildTargetIdentity(
      targetUser,
      requester,
      agentNickname,
      targetAgentNickname,
    );
    await this.friendsService.ensureNotBlockedBetweenUsers(
      requester.id,
      targetUser.id,
    );

    if (
      targetUser.id !== requester.id &&
      targetUser.isGuest !== true &&
      targetUser.chatPreferences?.blockProfileComments === true
    ) {
      throw new ForbiddenException('Bu kullanıcı profil yorumlarını kapatmış.');
    }

    const totalCommentCount = await this.profileCommentRepository.count({
      where: {
        targetUserId: targetUser.id,
        targetIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
      },
    });
    if (totalCommentCount >= MAX_PROFILE_COMMENTS) {
      throw new BadRequestException(
        'Bu profilde en fazla 10 yorum olabilir. Yeni yorum için eski bir yorumu silin.',
      );
    }

    const isSelfProfileComment =
      requesterIdentity.identityKey === targetIdentity.identityKey;
    const comment = this.profileCommentRepository.create({
      targetUserId: targetUser.id,
      targetUser,
      targetIdentityKey: targetIdentity.identityKey,
      targetIdentityType: targetIdentity.identityType,
      targetDisplayName: targetIdentity.publicName,
      userId: requester.id,
      user: requester,
      authorIdentityKey: requesterIdentity.identityKey,
      authorIdentityType: requesterIdentity.identityType,
      authorDisplayName: requesterIdentity.publicName,
      content,
      status: isSelfProfileComment
        ? ProfileCommentStatus.APPROVED
        : ProfileCommentStatus.PENDING,
      approvedAt: isSelfProfileComment ? new Date() : null,
      approvedByUserId: isSelfProfileComment ? requester.id : null,
    });
    const saved = await this.profileCommentRepository.save(comment);

    const savedWithUser = await this.profileCommentRepository.findOne({
      where: { id: saved.id },
      relations: ['user', 'user.role'],
    });

    if (!savedWithUser) {
      throw new NotFoundException('Yorum bulunamadı');
    }

    return this.toResponse(savedWithUser);
  }

  async approve(
    requesterUserId: number,
    targetUsername: string,
    commentId: number,
    agentNickname?: string,
    targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto> {
    const requester = await this.ensureUserExists(requesterUserId);
    const targetUser = await this.getTargetUser(targetUsername);
    const requesterIdentity = this.buildProfileIdentity(requester, agentNickname);
    const targetIdentity = this.buildTargetIdentity(
      targetUser,
      requester,
      agentNickname,
      targetAgentNickname,
    );
    this.ensureProfileOwner(requesterIdentity, targetIdentity);

    const comment = await this.profileCommentRepository.findOne({
      where: {
        id: commentId,
        targetUserId: targetUser.id,
        targetIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
      },
      relations: ['user', 'user.role'],
    });

    if (!comment) {
      throw new NotFoundException('Yorum bulunamadı');
    }

    if (comment.status !== ProfileCommentStatus.PENDING) {
      throw new BadRequestException('Bu yorum zaten onaylanmış.');
    }

    comment.status = ProfileCommentStatus.APPROVED;
    comment.approvedAt = new Date();
    comment.approvedByUserId = requester.id;
    const saved = await this.profileCommentRepository.save(comment);

    return this.toResponse(saved);
  }

  async remove(
    requesterUserId: number,
    targetUsername: string,
    commentId: number,
    agentNickname?: string,
    targetAgentNickname?: string,
  ): Promise<void> {
    const requester = await this.ensureUserExists(requesterUserId);
    const targetUser = await this.getTargetUser(targetUsername);
    const requesterIdentity = this.buildProfileIdentity(requester, agentNickname);
    const targetIdentity = this.buildTargetIdentity(
      targetUser,
      requester,
      agentNickname,
      targetAgentNickname,
    );

    const comment = await this.profileCommentRepository.findOne({
      where: {
        id: commentId,
        targetUserId: targetUser.id,
        targetIdentityKey: In(this.getCompatibleIdentityKeys(targetIdentity)),
      },
    });

    if (!comment) {
      throw new NotFoundException('Yorum bulunamadı');
    }

    const canDelete =
      this.identityMatchesCommentAuthor(comment, requesterIdentity) ||
      this.identityMatchesCommentTarget(comment, requesterIdentity) ||
      (requester.role?.starCount ?? 0) >= 1;
    if (!canDelete) {
      throw new ForbiddenException('Bu yorumu silme yetkiniz yok');
    }

    await this.profileCommentRepository.delete({ id: commentId });
  }

  private async ensureUserExists(userId: number) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }
    return user;
  }

  private async getTargetUser(targetUsername: string) {
    const normalizedUsername = targetUsername?.trim();
    if (!normalizedUsername) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const targetUser =
      await this.userService.findByUsername(normalizedUsername);
    if (!targetUser) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return targetUser;
  }

  private buildProfileIdentity(
    user: { id: number; username: string },
    agentNickname?: string | null,
  ): ProfileIdentity {
    const identity = buildIdentity(user.id, agentNickname);
    return {
      userId: user.id,
      identityKey: identity.identityKey,
      identityType: identity.identityType,
      publicName: identity.normalizedAgentNickname || user.username,
    };
  }

  private buildTargetIdentity(
    targetUser: { id: number; username: string },
    requester: { id: number; username: string },
    requesterAgentNickname?: string | null,
    targetAgentNickname?: string | null,
  ): ProfileIdentity {
    const normalizedTargetAgent = targetAgentNickname?.trim();
    const fallbackSelfAgent =
      targetUser.id === requester.id ? requesterAgentNickname?.trim() : null;
    return this.buildProfileIdentity(
      targetUser,
      normalizedTargetAgent || fallbackSelfAgent || null,
    );
  }

  private getCompatibleIdentityKeys(identity: ProfileIdentity): string[] {
    if (identity.identityType === 'agent') return [identity.identityKey];
    return [identity.identityKey, ''];
  }

  private ensureProfileOwner(
    requesterIdentity: ProfileIdentity,
    targetIdentity: ProfileIdentity,
  ): void {
    if (
      requesterIdentity.userId !== targetIdentity.userId ||
      requesterIdentity.identityKey !== targetIdentity.identityKey
    ) {
      throw new ForbiddenException(
        'Bu işlem sadece profil sahibi tarafından yapılabilir.',
      );
    }
  }

  private identityMatchesCommentAuthor(
    comment: ProfileComment,
    identity: ProfileIdentity,
  ) {
    return (
      comment.userId === identity.userId &&
      this.getCompatibleIdentityKeys(identity).includes(
        comment.authorIdentityKey || '',
      )
    );
  }

  private identityMatchesCommentTarget(
    comment: ProfileComment,
    identity: ProfileIdentity,
  ) {
    return (
      comment.targetUserId === identity.userId &&
      this.getCompatibleIdentityKeys(identity).includes(
        comment.targetIdentityKey || '',
      )
    );
  }

  private toResponse(comment: ProfileComment): ProfileCommentResponseDto {
    const role = comment.user?.role ?? null;
    const isAgentAuthor = comment.authorIdentityType === 'agent';
    const authorDisplayName =
      comment.authorDisplayName?.trim() || comment.user.username;
    return {
      id: comment.id,
      content: comment.content,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        displayUsername: authorDisplayName,
        agentNickname: isAgentAuthor ? authorDisplayName : null,
        gender: comment.user.gender,
        icon: isAgentAuthor ? null : (comment.user.icon ?? null),
        starCount: role?.starCount ?? 0,
        starColor: role?.starColor ?? null,
      },
      createdAt: comment.createdAt,
      status: comment.status,
      approvedAt: comment.approvedAt,
    };
  }
}
