import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { FriendsService } from './friends.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { FriendRequestResponseDto } from './dto/friend-request-response.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { User } from '../user/entities/user.entity';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Friends')
@ApiBearerAuth()
@Controller('friends')
@UseGuards(AuthGuard)
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
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

  private async ensureBlockPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const userId = Number(req?.user?.sub);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!hasPermissionForUser(user, PERMISSION_LABELS.BLOCK_USER)) {
      throw new ForbiddenException('Engel yetkiniz yok.');
    }
  }

  @Post('requests')
  @ApiOperation({ summary: 'Arkadaşlık isteği gönder' })
  async createRequest(
    @Request() req,
    @Body() dto: CreateFriendRequestDto,
  ): Promise<FriendRequestResponseDto> {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.sendRequest(
      tenantId,
      userId,
      agentNickname,
      dto.targetUsername,
      dto.targetAgentNickname,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Arkadaş listesini getir' })
  async getFriends(@Request() req): Promise<FriendRequestResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.getFriends(userId, agentNickname);
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'Gelen istekleri getir' })
  async getIncoming(@Request() req): Promise<FriendRequestResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.getIncoming(userId, agentNickname);
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'Giden istekleri getir' })
  async getOutgoing(@Request() req): Promise<FriendRequestResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.getOutgoing(userId, agentNickname);
  }

  @Get('blocks')
  @ApiOperation({ summary: 'Engellediğim kullanıcıları getir' })
  async getBlocks(@Request() req) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.getBlockedUsers(userId, agentNickname);
  }

  @Get('ignores')
  @ApiOperation({ summary: 'Görmezden geldiğim kullanıcıları getir' })
  getIgnores(@Request() req) {
    const userId = Number(req.user.sub);
    return this.friendsService.getIgnoredUsers(userId);
  }

  @Get('relation/:targetUsername')
  @ApiOperation({ summary: 'Hedef kullanıcı ile ilişki durumunu getir' })
  async getRelation(
    @Request() req,
    @Param('targetUsername') targetUsername: string,
    @Query('targetAgentNickname') targetAgentNickname?: string,
  ) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.getRelation(
      userId,
      agentNickname,
      targetUsername,
      targetAgentNickname,
    );
  }

  @Post('requests/:id/accept')
  @ApiOperation({ summary: 'Arkadaşlık isteğini kabul et' })
  async accept(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FriendRequestResponseDto> {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.acceptRequest(tenantId, id, userId, agentNickname);
  }

  @Post('requests/:id/reject')
  @ApiOperation({ summary: 'Arkadaşlık isteğini reddet' })
  async reject(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ status: 'ok' }> {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.rejectRequest(tenantId, id, userId, agentNickname);
  }

  @Post('requests/:id/cancel')
  @ApiOperation({ summary: 'Arkadaşlık isteğini iptal et' })
  async cancel(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ status: 'ok' }> {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.cancelRequest(tenantId, id, userId, agentNickname);
  }

  @Post('requests/:id/remove')
  @ApiOperation({ summary: 'Arkadaşlıktan çıkar' })
  async removeFriend(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ status: 'ok' }> {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.removeFriend(tenantId, id, userId, agentNickname);
  }

  @Post('blocks')
  @ApiOperation({ summary: 'Kullanıcı engelle' })
  async block(
    @Request() req,
    @Body() dto: BlockUserDto,
  ): Promise<{ status: 'ok' }> {
    await this.ensureBlockPermission(req);
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.blockUser(
      tenantId,
      userId,
      agentNickname,
      dto.targetUsername,
      dto.targetAgentNickname,
    );
  }

  @Delete('blocks/clear-all')
  @ApiOperation({ summary: 'Tüm kullanıcı engellerimi kaldır' })
  @HttpCode(HttpStatus.OK)
  async clearBlocks(@Request() req): Promise<{ status: 'ok'; clearedCount: number }> {
    await this.ensureBlockPermission(req);
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.clearBlockedUsers(
      tenantId,
      userId,
      agentNickname,
    );
  }

  @Post('ignores')
  @ApiOperation({ summary: 'Kullanıcıyı görmezden gel' })
  ignore(@Request() req, @Body() dto: BlockUserDto): Promise<{ status: 'ok' }> {
    const userId = Number(req.user.sub);
    return this.friendsService.ignoreUser(userId, dto.targetUsername);
  }

  @Delete('blocks/:targetUsername')
  @ApiOperation({ summary: 'Kullanıcı engelini kaldır' })
  @HttpCode(HttpStatus.OK)
  async unblock(
    @Request() req,
    @Param('targetUsername') targetUsername: string,
  ): Promise<{ status: 'ok' }> {
    await this.ensureBlockPermission(req);
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.friendsService.unblockUser(
      tenantId,
      userId,
      agentNickname,
      targetUsername,
    );
  }

  @Delete('ignores/:targetUsername')
  @ApiOperation({ summary: 'Kullanıcıyı görmezden gelmeyi kaldır' })
  @HttpCode(HttpStatus.OK)
  unignore(
    @Request() req,
    @Param('targetUsername') targetUsername: string,
  ): Promise<{ status: 'ok' }> {
    const userId = Number(req.user.sub);
    return this.friendsService.unignoreUser(userId, targetUsername);
  }
}
