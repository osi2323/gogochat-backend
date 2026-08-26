import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BotService } from './bot.service';
import { Bot } from './entities/bot.entity';
import { AuthGuard } from '../auth/auth.guard';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@Controller('bot')
@UseGuards(AuthGuard)
export class BotController {
  constructor(
    private readonly botService: BotService,
    private readonly userService: UserService,
  ) {}

  private async ensureBotManagementPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(user, PERMISSION_LABELS.BOT_MANAGEMENT)) {
      throw new ForbiddenException('Bot yönetimi yetkiniz yok.');
    }
  }

  @Get()
  async findAll(@Request() req): Promise<Bot[]> {
    await this.ensureBotManagementPermission(req);
    return this.botService.findAll();
  }

  @Get('preferences')
  async getPreferences(@Request() req) {
    await this.ensureBotManagementPermission(req);
    return this.botService.getPreferences();
  }

  @Get(':id')
  async findOne(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Bot> {
    await this.ensureBotManagementPermission(req);
    return this.botService.findOne(id);
  }

  @Post()
  async create(@Request() req, @Body() botData: Partial<Bot>): Promise<Bot> {
    await this.ensureBotManagementPermission(req);
    return this.botService.create(botData);
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() botData: Partial<Bot>,
  ): Promise<Bot> {
    await this.ensureBotManagementPermission(req);
    return this.botService.update(id, botData);
  }

  @Post(':id/toggle-room-mute')
  async toggleRoomMute(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { roomKey?: string },
  ) {
    await this.ensureBotManagementPermission(req);
    return this.botService.toggleRoomMute(id, String(body?.roomKey || ''));
  }

  @Post(':id/toggle-global-mute')
  async toggleGlobalMute(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.ensureBotManagementPermission(req);
    return this.botService.toggleGlobalMute(id);
  }

  @Post(':id/speak')
  async speak(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { message?: string },
  ) {
    await this.ensureBotManagementPermission(req);
    return this.botService.speak(
      id,
      String(body?.message || ''),
      String(req.user.username || ''),
      String(req.user.username || ''),
    );
  }

  @Delete(':id')
  async remove(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.ensureBotManagementPermission(req);
    return this.botService.remove(id);
  }
}
