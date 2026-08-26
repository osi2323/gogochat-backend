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
import { DirectMessagesService } from './direct-messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateDirectMessageDto } from './dto/create-direct-message.dto';
import { DirectMessageQueryDto } from './dto/direct-message-query.dto';
import { User } from '../user/entities/user.entity';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('DirectMessages')
@Controller('direct-messages')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class DirectMessagesController {
  constructor(
    private readonly dmService: DirectMessagesService,
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
    if (
      !hasPermissionForUser(user, PERMISSION_LABELS.SECRET_NICKNAME_LOGIN)
    ) {
      return undefined;
    }

    return normalized;
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create or get a direct conversation' })
  async createConversation(@Request() req, @Body() dto: CreateConversationDto) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.createConversation(
      req.tenant,
      userId,
      agentNickname,
      dto.targetUsername,
      dto.targetAgentNickname,
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List direct conversations' })
  async listConversations(@Request() req) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.listConversations(req.tenant, userId, agentNickname);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get conversation messages' })
  async getMessages(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DirectMessageQueryDto,
  ) {
    const userId = Number(req.user.sub);
    const limit = query.limit ? Number(query.limit) : 30;
    const beforeId = query.beforeId ? Number(query.beforeId) : undefined;
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.getMessages(
      req.tenant,
      userId,
      agentNickname,
      id,
      limit,
      beforeId,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a direct message' })
  async sendMessage(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDirectMessageDto,
  ) {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.sendMessage(
      tenantId,
      userId,
      agentNickname,
      id,
      dto,
    );
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markRead(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.markRead(tenantId, userId, agentNickname, id);
  }

  @Post('conversations/:id/buzz')
  @ApiOperation({ summary: 'Send a buzz animation to a direct conversation peer' })
  async buzzConversation(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = Number(req.user.sub);
    const tenantId = req.tenant;
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.buzzConversation(tenantId, userId, agentNickname, id);
  }

  @Post('conversations/:id/clear')
  @ApiOperation({ summary: 'Clear an active direct conversation for current user' })
  async clearConversation(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.clearConversation(userId, agentNickname, id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete an active direct conversation for current user' })
  async deleteConversation(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.deleteConversation(userId, agentNickname, id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread DM count' })
  async getUnreadCount(@Request() req) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.getUnreadCount(userId, agentNickname);
  }

  @Post('clear-history')
  @ApiOperation({
    summary: 'Clear direct message history for the current user view',
  })
  async clearHistory(@Request() req) {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.dmService.clearHistory(userId, agentNickname);
  }
}
