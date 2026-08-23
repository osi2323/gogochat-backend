import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../user/entities/user.entity';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';
import { CreateWallPostDto } from './dto/create-wall-post.dto';
import { CreateWallPostCommentDto } from './dto/create-wall-post-comment.dto';
import { WallPostQueryDto } from './dto/wall-post-query.dto';
import { WallPostResponseDto } from './dto/wall-post-response.dto';
import { WallPostsService } from './wall-posts.service';
import { WallPostCommentResponseDto } from './dto/wall-post-comment-response.dto';
import { WallPostViewResponseDto } from './dto/wall-post-view-response.dto';

@ApiTags('WallPosts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('wall-posts')
export class WallPostsController {
  constructor(
    private readonly wallPostsService: WallPostsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async getAgentNickname(req: any): Promise<string | undefined> {
    const raw = req?.headers?.['x-agent-nickname'];
    if (typeof raw !== 'string') return undefined;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    const normalized = decoded.trim();
    if (!normalized.length) return undefined;

    const normalizedUsername = String(req?.user?.username ?? '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') {
      return normalized;
    }

    const userId = Number(req?.user?.sub);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!hasPermissionForUser(user, PERMISSION_LABELS.SECRET_NICKNAME_LOGIN)) {
      return undefined;
    }

    return normalized;
  }

  @Post()
  @ApiOperation({ summary: 'Duvar yazısı oluştur' })
  async create(
    @Request() req,
    @Body() createWallPostDto: CreateWallPostDto,
  ): Promise<WallPostResponseDto> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.wallPostsService.create(
      userId,
      createWallPostDto,
      agentNickname,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Duvar yazılarını listele' })
  async findAll(
    @Request() req,
    @Query() query: WallPostQueryDto,
  ): Promise<WallPostResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    return this.wallPostsService.findAll(userId, limit, offset, agentNickname);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Duvar yazısını beğen/kaldır' })
  toggleLike(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const userId = Number(req.user.sub);
    return this.wallPostsService.toggleLike(userId, id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Duvar yazısı yorumlarını listele' })
  listComments(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<WallPostCommentResponseDto[]> {
    const userId = Number(req.user.sub);
    return this.wallPostsService.listComments(userId, id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Duvar yazısına yorum ekle' })
  async addComment(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() createCommentDto: CreateWallPostCommentDto,
  ): Promise<WallPostCommentResponseDto> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.wallPostsService.addComment(
      userId,
      id,
      createCommentDto,
      agentNickname,
    );
  }

  @Post(':id/views')
  @ApiOperation({ summary: 'Duvar yazısını görüntülendi olarak işaretle' })
  async markViewed(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ viewCount: number }> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.wallPostsService.markViewed(userId, id, agentNickname);
  }

  @Get(':id/views')
  @ApiOperation({ summary: 'Duvar yazısını görenleri listele' })
  listViews(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<WallPostViewResponseDto[]> {
    const userId = Number(req.user.sub);
    return this.wallPostsService.listViews(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Duvar yazısını sil' })
  async removePost(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    const userId = Number(req.user.sub);
    await this.wallPostsService.removePost(userId, id);
  }

  @Delete(':postId/comments/:commentId')
  @ApiOperation({ summary: 'Duvar yazısı yorumunu sil' })
  async removeComment(
    @Request() req,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<void> {
    const userId = Number(req.user.sub);
    await this.wallPostsService.removeComment(userId, postId, commentId);
  }
}
