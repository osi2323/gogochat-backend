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
import { CreateProfileCommentDto } from './dto/create-profile-comment.dto';
import { ProfileCommentResponseDto } from './dto/profile-comment-response.dto';
import { ProfileCommentsService } from './profile-comments.service';

@ApiTags('ProfileComments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('profile-comments')
export class ProfileCommentsController {
  constructor(
    private readonly profileCommentsService: ProfileCommentsService,
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
    if (normalizedUsername === 'root') return normalized;

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

  @Get(':username')
  @ApiOperation({ summary: 'Kullanıcı profil yorumlarını listele' })
  async listByUsername(
    @Request() req,
    @Param('username') username: string,
    @Query('agentNickname') targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.profileCommentsService.listByUsername(
      userId,
      username,
      agentNickname,
      targetAgentNickname,
    );
  }

  @Post(':username')
  @ApiOperation({ summary: 'Kullanıcı profiline yorum ekle' })
  async create(
    @Request() req,
    @Param('username') username: string,
    @Query('agentNickname') targetAgentNickname: string | undefined,
    @Body() dto: CreateProfileCommentDto,
  ): Promise<ProfileCommentResponseDto> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.profileCommentsService.create(
      userId,
      username,
      dto,
      agentNickname,
      targetAgentNickname,
    );
  }

  @Get(':username/pending')
  @ApiOperation({ summary: 'Profil için onay bekleyen yorumları listele' })
  async listPendingByUsername(
    @Request() req,
    @Param('username') username: string,
    @Query('agentNickname') targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.profileCommentsService.listPendingByUsername(
      userId,
      username,
      agentNickname,
      targetAgentNickname,
    );
  }

  @Get(':username/pending/mine')
  @ApiOperation({ summary: 'Kullanıcının kendi onay bekleyen yorumlarını listele' })
  async listMyPendingByUsername(
    @Request() req,
    @Param('username') username: string,
    @Query('agentNickname') targetAgentNickname?: string,
  ): Promise<ProfileCommentResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.profileCommentsService.listMyPendingByUsername(
      userId,
      username,
      agentNickname,
      targetAgentNickname,
    );
  }

  @Post(':username/:commentId/approve')
  @ApiOperation({ summary: 'Profil yorumunu onayla' })
  async approve(
    @Request() req,
    @Param('username') username: string,
    @Query('agentNickname') targetAgentNickname: string | undefined,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<ProfileCommentResponseDto> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.profileCommentsService.approve(
      userId,
      username,
      commentId,
      agentNickname,
      targetAgentNickname,
    );
  }

  @Delete(':username/:commentId')
  @ApiOperation({ summary: 'Kullanıcı profili yorumunu sil' })
  async remove(
    @Request() req,
    @Param('username') username: string,
    @Query('agentNickname') targetAgentNickname: string | undefined,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<void> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    await this.profileCommentsService.remove(
      userId,
      username,
      commentId,
      agentNickname,
      targetAgentNickname,
    );
  }
}
