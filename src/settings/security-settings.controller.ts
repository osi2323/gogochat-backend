import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SecuritySettingsService } from './security-settings.service';
import { SecuritySettingsResponseDto } from './dto/security-settings-response.dto';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { UserService } from '../user/user.service';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import {
  FloodBanListResponseDto,
} from './dto/flood-ban-response.dto';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('security-settings')
@UseGuards(AuthGuard, StarCountGuard)
@MinStarCount(3)
export class SecuritySettingsController {
  constructor(
    private readonly securitySettingsService: SecuritySettingsService,
    private readonly userService: UserService,
    private readonly adminActionsService: AdminActionsService,
  ) {}

  private async ensureAdminPanelPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;
    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Güvenlik ayarlarını getir (Public)' })
  @ApiResponse({ status: 200, type: SecuritySettingsResponseDto })
  getSettings(): Promise<SecuritySettingsResponseDto> {
    return this.securitySettingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: 'Güvenlik ayarlarını güncelle' })
  @ApiResponse({ status: 200, type: SecuritySettingsResponseDto })
  async updateSettings(
    @Request() req,
    @Body() dto: UpdateSecuritySettingsDto,
  ): Promise<SecuritySettingsResponseDto> {
    await this.ensureAdminPanelPermission(req);
    return this.securitySettingsService.updateSettings(dto);
  }

  @Get('flood-bans')
  @ApiOperation({ summary: 'Aktif flood ban listesini getir' })
  @ApiResponse({ status: 200, type: FloodBanListResponseDto })
  async getFloodBans(@Request() req): Promise<FloodBanListResponseDto> {
    await this.ensureAdminPanelPermission(req);
    return this.securitySettingsService.getActiveFloodBans();
  }

  @Post('flood-bans/clear-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tüm aktif flood ban kayıtlarını kaldır' })
  @ApiResponse({
    status: 200,
    schema: {
      example: { clearedCount: 3, message: 'Tüm sunucu banları açıldı.' },
    },
  })
  async clearAllFloodBans(
    @Request() req,
  ): Promise<{ clearedCount: number; message: string }> {
    await this.ensureAdminPanelPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.securitySettingsService.clearAllFloodBans();
    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: 'FLOOD_BAN_CLEAR_ALL',
      description: `Tüm sunucu banları açıldı (${result.clearedCount})`,
      metadata: { clearedCount: result.clearedCount },
    });
    return {
      clearedCount: result.clearedCount,
      message: 'Tüm sunucu banları açıldı.',
    };
  }
}
