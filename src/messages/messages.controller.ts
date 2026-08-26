import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MarkMessagesReadDto } from './dto/mark-messages-read.dto';
import { ClearHistoryDto } from './dto/clear-history.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../user/entities/user.entity';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(
    private readonly messagesService: MessagesService,
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

  @Post()
  @ApiOperation({ summary: 'Yeni mesaj oluştur' })
  async create(
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    const userId = Number(req.user.sub);
    const username = String(req.user.username ?? '');
    const agentNickname = await this.getAgentNickname(req);
    return this.messagesService.create(
      createMessageDto,
      userId,
      username,
      agentNickname,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Mesajları listele' })
  @ApiQuery({
    name: 'roomName',
    required: false,
    description: 'Oda adı (filtrelemek için)',
  })
  async findAll(
    @Request() req,
    @Query() query: MessageQueryDto,
  ): Promise<MessageResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    const messages = await this.messagesService.findAll(
      userId,
      query.roomName,
      agentNickname,
      query.includeCleared === 'true',
    );
    this.logger.log(
      `findAll room="${query.roomName ?? ''}" userId=${userId} includeCleared=${query.includeCleared === 'true'} count=${messages.length}`,
    );
    return messages;
  }

  @Post('read')
  @ApiOperation({ summary: 'Mesajları okundu olarak işaretle' })
  async markAsRead(
    @Request() req,
    @Body() markMessagesReadDto: MarkMessagesReadDto,
  ): Promise<{
    markedCount: number;
    alreadyReadCount: number;
    notFoundCount: number;
  }> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.messagesService.markAsRead(
      markMessagesReadDto,
      userId,
      agentNickname,
    );
  }

  @Post('clear-history')
  @ApiOperation({ summary: 'Oda geçmişini temizle' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(
    @Request() req,
    @Body() clearHistoryDto: ClearHistoryDto,
  ): Promise<void> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.messagesService.clearHistory(
      clearHistoryDto.roomName,
      userId,
      agentNickname,
    );
  }

  @Post('clear-room-history')
  @ApiOperation({ summary: 'Oda geçmişini herkes için temizle' })
  async clearRoomHistoryForEveryone(
    @Request() req,
    @Body() clearHistoryDto: ClearHistoryDto,
  ): Promise<{ deletedMessagesCount: number }> {
    const userId = Number(req.user.sub);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!hasPermissionForUser(user, PERMISSION_LABELS.ROOM_MESSAGES_DELETE)) {
      throw new ForbiddenException('Oda yazılarını silme yetkiniz yok');
    }

    return this.messagesService.clearRoomHistoryForEveryone(
      clearHistoryDto.roomName,
    );
  }

  @Get('unread')
  @ApiOperation({ summary: 'Okunmamış mesaj ID listesini getir' })
  @ApiQuery({
    name: 'roomName',
    required: false,
    description: 'Oda adı (filtrelemek için)',
  })
  async getUnreadMessageIds(
    @Request() req,
    @Query() query: MessageQueryDto,
  ): Promise<number[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.messagesService.getUnreadMessageIds(
      userId,
      query.roomName,
      agentNickname,
    );
  }

  @Get('read')
  @ApiOperation({ summary: 'Okunmuş mesajları getir' })
  @ApiQuery({
    name: 'roomName',
    required: false,
    description: 'Oda adı (filtrelemek için)',
  })
  async getReadMessages(
    @Request() req,
    @Query() query: MessageQueryDto,
  ): Promise<MessageResponseDto[]> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.messagesService.getReadMessages(
      userId,
      query.roomName,
      agentNickname,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mesaj detayını getir' })
  async findOne(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MessageResponseDto> {
    const userId = Number(req.user.sub);
    const agentNickname = await this.getAgentNickname(req);
    return this.messagesService.findOne(id, userId, agentNickname);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mesajı güncelle' })
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    const userId = Number(req.user.sub);
    return this.messagesService.update(id, updateMessageDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mesajı sil' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    const userId = Number(req.user.sub);
    return this.messagesService.remove(id, userId);
  }
}
