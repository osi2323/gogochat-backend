import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { WallPost } from './entities/wall-post.entity';
import { WallPostLike } from './entities/wall-post-like.entity';
import { WallPostComment } from './entities/wall-post-comment.entity';
import { WallPostView } from './entities/wall-post-view.entity';
import { CreateWallPostDto } from './dto/create-wall-post.dto';
import { WallPostResponseDto } from './dto/wall-post-response.dto';
import { WallPostVisibility } from './enums/wall-post-visibility.enum';
import { CreateWallPostCommentDto } from './dto/create-wall-post-comment.dto';
import { WallPostCommentResponseDto } from './dto/wall-post-comment-response.dto';
import { WallPostViewResponseDto } from './dto/wall-post-view-response.dto';
import {
  buildIdentity,
  buildNormalIdentityKey,
} from '../common/agent-identity.util';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@Injectable()
export class WallPostsService {
  constructor(
    @InjectRepository(WallPost)
    private readonly wallPostRepository: Repository<WallPost>,
    @InjectRepository(WallPostLike)
    private readonly wallPostLikeRepository: Repository<WallPostLike>,
    @InjectRepository(WallPostComment)
    private readonly wallPostCommentRepository: Repository<WallPostComment>,
    @InjectRepository(WallPostView)
    private readonly wallPostViewRepository: Repository<WallPostView>,
    private readonly userService: UserService,
  ) {}

  private isRootUser(user: any): boolean {
    return (
      String(user?.username || '')
        .trim()
        .toLocaleLowerCase('tr-TR') === 'root'
    );
  }

  private canDeleteOthersStories(user: any): boolean {
    if (this.isRootUser(user)) return true;
    return hasPermissionForUser(user, PERMISSION_LABELS.STORY_DELETE);
  }

  private canDeleteTargetStory(user: any, targetUser: any): boolean {
    if (this.isRootUser(user)) return true;
    if (!this.canDeleteOthersStories(user)) return false;
    const actorStarCount = Number(user?.role?.starCount ?? 0);
    const targetStarCount = Number(targetUser?.role?.starCount ?? 0);
    return actorStarCount > targetStarCount;
  }

  async create(
    userId: number,
    dto: CreateWallPostDto,
    agentNickname?: string,
  ): Promise<WallPostResponseDto> {
    const content = dto.content?.trim() || '';
    const image = dto.image?.trim() || '';
    const backgroundColor = dto.backgroundColor?.trim() || '';

    if (!content && !image) {
      throw new BadRequestException('İçerik veya görsel zorunludur');
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const starCount = user.role?.starCount ?? 0;
    if (dto.visibility === WallPostVisibility.STAFF && starCount < 1) {
      throw new ForbiddenException('Yetkiniz yok');
    }

    const identity = buildIdentity(user.id, agentNickname);
    const wallPost = this.wallPostRepository.create({
      content: content || null,
      image: image || null,
      backgroundColor: backgroundColor || null,
      visibility: dto.visibility ?? WallPostVisibility.MEMBERS,
      userId: user.id,
      user,
      senderIdentityKey: identity.identityKey,
      senderIdentityType: identity.identityType,
      senderPublicName: identity.normalizedAgentNickname,
    });

    const saved = await this.wallPostRepository.save(wallPost);
    const created = await this.wallPostRepository.findOne({
      where: { id: saved.id },
      relations: ['user', 'user.role'],
    });
    if (!created) {
      throw new NotFoundException('Duvar yazısı bulunamadı');
    }
    return this.toResponse(created, false, true);
  }

  async findAll(
    userId: number,
    limit = 50,
    offset = 0,
    agentNickname?: string,
  ): Promise<WallPostResponseDto[]> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const starCount = user.role?.starCount ?? 0;
    const posts = await this.wallPostRepository.find({
      where:
        starCount < 1 ? { visibility: WallPostVisibility.MEMBERS } : undefined,
      relations: ['user', 'user.role'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    if (posts.length === 0) return [];
    const requestIdentity = buildIdentity(userId, agentNickname);

    const likedRows = await this.wallPostLikeRepository.find({
      where: { userId, wallPostId: In(posts.map((post) => post.id)) },
    });
    const likedSet = new Set(likedRows.map((like) => like.wallPostId));
    const viewedRows = await this.wallPostViewRepository.find({
      where:
        requestIdentity.identityType === 'normal'
          ? [
              {
                userId,
                identityKey: requestIdentity.identityKey,
                wallPostId: In(posts.map((post) => post.id)),
              },
              {
                userId,
                identityKey: '',
                wallPostId: In(posts.map((post) => post.id)),
              },
            ]
          : {
              userId,
              identityKey: requestIdentity.identityKey,
              wallPostId: In(posts.map((post) => post.id)),
            },
    });
    const viewedSet = new Set(viewedRows.map((view) => view.wallPostId));

    return posts.map((post) =>
      this.toResponse(
        post,
        likedSet.has(post.id),
        this.getPostIdentityKey(post) === requestIdentity.identityKey ||
          viewedSet.has(post.id),
      ),
    );
  }

  async toggleLike(
    userId: number,
    wallPostId: number,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }
    const post = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
      relations: ['user', 'user.role'],
    });
    if (!post) {
      throw new BadRequestException('Duvar yazısı bulunamadı');
    }

    const starCount = user.role?.starCount ?? 0;
    if (post.visibility === WallPostVisibility.STAFF && starCount < 1) {
      throw new ForbiddenException('Yetkiniz yok');
    }

    const existing = await this.wallPostLikeRepository.findOne({
      where: { wallPostId, userId },
    });

    if (existing) {
      await this.wallPostLikeRepository.remove(existing);
      await this.wallPostRepository.decrement(
        { id: wallPostId },
        'likeCount',
        1,
      );
      const updated = await this.wallPostRepository.findOne({
        where: { id: wallPostId },
      });
      return { liked: false, likeCount: updated?.likeCount ?? 0 };
    }

    const like = this.wallPostLikeRepository.create({ wallPostId, userId });
    await this.wallPostLikeRepository.save(like);
    await this.wallPostRepository.increment({ id: wallPostId }, 'likeCount', 1);
    const updated = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
    });
    return { liked: true, likeCount: updated?.likeCount ?? 0 };
  }

  async addComment(
    userId: number,
    wallPostId: number,
    dto: CreateWallPostCommentDto,
    agentNickname?: string,
  ): Promise<WallPostCommentResponseDto> {
    const content = dto.content?.trim() || '';
    if (!content) {
      throw new BadRequestException('Yorum boş olamaz');
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const post = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
    });
    if (!post) {
      throw new BadRequestException('Duvar yazısı bulunamadı');
    }

    const starCount = user.role?.starCount ?? 0;
    if (post.visibility === WallPostVisibility.STAFF && starCount < 1) {
      throw new ForbiddenException('Yetkiniz yok');
    }

    const identity = buildIdentity(userId, agentNickname);
    const comment = this.wallPostCommentRepository.create({
      wallPostId,
      userId,
      user,
      authorIdentityKey: identity.identityKey,
      authorIdentityType: identity.identityType,
      authorDisplayName: identity.normalizedAgentNickname || user.username,
      content,
    });
    const saved = await this.wallPostCommentRepository.save(comment);
    await this.wallPostRepository.increment(
      { id: wallPostId },
      'commentCount',
      1,
    );
    return this.toCommentResponse(saved);
  }

  async listComments(
    userId: number,
    wallPostId: number,
  ): Promise<WallPostCommentResponseDto[]> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }
    const post = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
    });
    if (!post) {
      throw new BadRequestException('Duvar yazısı bulunamadı');
    }

    const starCount = user.role?.starCount ?? 0;
    if (post.visibility === WallPostVisibility.STAFF && starCount < 1) {
      throw new ForbiddenException('Yetkiniz yok');
    }

    const comments = await this.wallPostCommentRepository.find({
      where: { wallPostId },
      relations: ['user', 'user.role'],
      order: { createdAt: 'ASC' },
    });
    return comments.map((comment) => this.toCommentResponse(comment));
  }

  async markViewed(
    userId: number,
    wallPostId: number,
    agentNickname?: string,
  ): Promise<{ viewCount: number }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const post = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
    });
    if (!post) {
      throw new BadRequestException('Duvar yazısı bulunamadı');
    }

    const starCount = user.role?.starCount ?? 0;
    if (post.visibility === WallPostVisibility.STAFF && starCount < 1) {
      throw new ForbiddenException('Yetkiniz yok');
    }

    const identity = buildIdentity(userId, agentNickname);
    const existingView = await this.wallPostViewRepository.findOne({
      where:
        identity.identityType === 'normal'
          ? [
              {
                wallPostId,
                userId,
                identityKey: identity.identityKey,
              },
              {
                wallPostId,
                userId,
                identityKey: '',
              },
            ]
          : {
              wallPostId,
              userId,
              identityKey: identity.identityKey,
            },
    });

    if (!existingView) {
      const view = this.wallPostViewRepository.create({
        wallPostId,
        userId,
        identityKey: identity.identityKey,
        identityType: identity.identityType,
        identityPublicName: identity.normalizedAgentNickname,
      });
      await this.wallPostViewRepository.save(view);
    }

    const viewCount = await this.countDistinctViews(wallPostId);

    return { viewCount };
  }

  private async countDistinctViews(wallPostId: number): Promise<number> {
    const result = await this.wallPostViewRepository
      .createQueryBuilder('view')
      .select(
        "COUNT(DISTINCT COALESCE(NULLIF(view.identityKey, ''), CONCAT('u:', view.userId, ':normal')))",
        'count',
      )
      .where('view.wallPostId = :wallPostId', { wallPostId })
      .getRawOne<{ count?: string }>();

    return Number(result?.count ?? 0);
  }

  async listViews(
    userId: number,
    wallPostId: number,
  ): Promise<WallPostViewResponseDto[]> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const post = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
    });
    if (!post) {
      throw new BadRequestException('Duvar yazısı bulunamadı');
    }

    const isPostOwner = post.userId === userId;
    if (!isPostOwner) {
      throw new ForbiddenException('Bu görüntülemeleri görme yetkiniz yok');
    }

    const views = await this.wallPostViewRepository.find({
      where: { wallPostId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const seen = new Set<string>();
    return views
      .filter((view) => {
        const identityKey =
          view.identityKey || buildNormalIdentityKey(view.userId);
        if (seen.has(identityKey)) return false;
        seen.add(identityKey);
        return true;
      })
      .map((view) => ({
        id: view.id,
        user: {
          id: view.user.id,
          username:
            view.identityType === 'agent'
              ? (view.identityPublicName ?? view.user.username)
              : view.user.username,
          icon: view.identityType === 'agent' ? null : (view.user.icon ?? null),
        },
        createdAt: this.toIsoDate(view.createdAt),
      }));
  }

  async removePost(userId: number, wallPostId: number): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const post = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
    });
    if (!post) {
      throw new NotFoundException('Duvar yazısı bulunamadı');
    }

    const isPostOwner = post.userId === userId;
    const canDeleteOthers = this.canDeleteTargetStory(user, post.user);
    if (!isPostOwner && !canDeleteOthers) {
      throw new ForbiddenException('Bu duvar yazısını silme yetkiniz yok');
    }

    await this.wallPostRepository.delete({ id: wallPostId });
  }

  async removeComment(
    userId: number,
    wallPostId: number,
    commentId: number,
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ForbiddenException('Kullanıcı bulunamadı');
    }

    const post = await this.wallPostRepository.findOne({
      where: { id: wallPostId },
    });
    if (!post) {
      throw new NotFoundException('Duvar yazısı bulunamadı');
    }

    const comment = await this.wallPostCommentRepository.findOne({
      where: { id: commentId, wallPostId },
      relations: ['user', 'user.role'],
    });
    if (!comment) {
      throw new NotFoundException('Yorum bulunamadı');
    }

    const isCommentOwner = comment.userId === userId;
    const canDeleteOthers = this.canDeleteTargetStory(user, comment.user);
    if (!isCommentOwner && !canDeleteOthers) {
      throw new ForbiddenException('Bu yorumu silme yetkiniz yok');
    }

    await this.wallPostCommentRepository.delete({ id: commentId });

    const commentCount = await this.wallPostCommentRepository.count({
      where: { wallPostId },
    });
    await this.wallPostRepository.update({ id: wallPostId }, { commentCount });
  }

  private toResponse(
    post: WallPost,
    isLiked: boolean,
    isViewed = false,
  ): WallPostResponseDto {
    const role = post.user?.role ?? null;
    const isAgentPost = post.senderIdentityType === 'agent';
    const agentNickname = isAgentPost ? (post.senderPublicName ?? null) : null;
    return {
      id: post.id,
      content: post.content ?? null,
      image: post.image ?? null,
      backgroundColor: post.backgroundColor ?? null,
      visibility: post.visibility,
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      isLiked,
      isViewed,
      user: {
        id: post.user.id,
        username: agentNickname || post.user.username,
        agentNickname,
        gender: post.user.gender,
        icon: isAgentPost ? null : (post.user.icon ?? null),
        starCount: isAgentPost ? 0 : (role?.starCount ?? 0),
        starColor: isAgentPost ? null : (role?.starColor ?? null),
      },
      createdAt: this.toIsoDate(post.createdAt),
      updatedAt: this.toIsoDate(post.updatedAt),
    };
  }

  private toCommentResponse(
    comment: WallPostComment,
  ): WallPostCommentResponseDto {
    const role = comment.user?.role ?? null;
    const isAgentComment = comment.authorIdentityType === 'agent';
    const displayUsername =
      comment.authorDisplayName?.trim() || comment.user.username;
    return {
      id: comment.id,
      content: comment.content,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        displayUsername,
        agentNickname: isAgentComment ? displayUsername : null,
        gender: comment.user.gender,
        icon: isAgentComment ? null : (comment.user.icon ?? null),
        starCount: role?.starCount ?? 0,
        starColor: isAgentComment ? null : (role?.starColor ?? null),
      },
      createdAt: this.toIsoDate(comment.createdAt),
    };
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

  private getPostIdentityKey(post: WallPost): string {
    return post.senderIdentityKey || buildNormalIdentityKey(post.userId);
  }
}
