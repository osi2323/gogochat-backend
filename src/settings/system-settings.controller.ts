import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsResponseDto } from './dto/system-settings-response.dto';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { FirstMessageDelayResponseDto } from './dto/first-message-delay-response.dto';
import { MaintenanceModeResponseDto } from './dto/maintenance-mode-response.dto';
import { ChatPermissionsResponseDto } from './dto/chat-permissions-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { CommunicationPermissionsResponseDto } from './dto/communication-permissions-response.dto';
import { GuestWaitResponseDto } from './dto/guest-wait-response.dto';
import { WebConsoleStatsResponseDto } from './dto/web-console-stats-response.dto';
import { WebConsoleAnimationsResponseDto } from './dto/web-console-animations-response.dto';
import { UserService } from '../user/user.service';
import { ChangeRootPasswordDto } from './dto/change-root-password.dto';
import { SendSystemMessageDto } from './dto/send-system-message.dto';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import { AdminActionType } from '../admin-actions/enums/admin-action-type.enum';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('system-settings')
@UseGuards(AuthGuard, StarCountGuard)
@MinStarCount(3)
export class SystemSettingsController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly userService: UserService,
    private readonly adminActionsService: AdminActionsService,
  ) {}

  private async ensureSiteSettingsPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;
    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(user, PERMISSION_LABELS.SITE_SETTINGS)) {
      throw new ForbiddenException('Site ayarları yetkiniz yok.');
    }
  }

  private async ensureSystemMessagePermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);

    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }

    const starCount = Number(user?.role?.starCount ?? 0);
    if (starCount < 25) {
      throw new ForbiddenException(
        'Sistem mesajı göndermek için en az 25 rütbe gerekiyor.',
      );
    }
  }

  private async ensureRootOperationsPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);

    const starCount = Number(user?.role?.starCount ?? 0);
    if (starCount < 25) {
      throw new ForbiddenException(
        'Root işlemleri için en az 25 rütbe gerekiyor.',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Sistem ayarlarını getir' })
  @ApiResponse({
    status: 200,
    type: SystemSettingsResponseDto,
  })
  async getSettings(@Request() req): Promise<SystemSettingsResponseDto> {
    await this.ensureSiteSettingsPermission(req);
    return this.systemSettingsService.getSettings();
  }

  @Public()
  @Get('first-message-delay')
  @ApiOperation({ summary: 'İlk mesaj gecikmesi ayarlarını getir (Public)' })
  @ApiResponse({
    status: 200,
    type: FirstMessageDelayResponseDto,
  })
  getFirstMessageDelay(): Promise<FirstMessageDelayResponseDto> {
    return this.systemSettingsService.getFirstMessageDelay();
  }

  @Public()
  @Get('maintenance-mode')
  @ApiOperation({ summary: 'Bakım modu durumunu getir (Public)' })
  @ApiResponse({
    status: 200,
    type: MaintenanceModeResponseDto,
  })
  getMaintenanceMode(): Promise<MaintenanceModeResponseDto> {
    return this.systemSettingsService.getMaintenanceMode();
  }

  @Public()
  @Get('chat-permissions')
  @ApiOperation({ summary: 'Chat izinlerini getir (Public)' })
  @ApiResponse({
    status: 200,
    type: ChatPermissionsResponseDto,
  })
  getChatPermissions(): Promise<ChatPermissionsResponseDto> {
    return this.systemSettingsService.getChatPermissions();
  }

  @Public()
  @Get('communication-permissions')
  @ApiOperation({ summary: 'İletişim izinlerini getir (Public)' })
  @ApiResponse({
    status: 200,
    type: CommunicationPermissionsResponseDto,
  })
  getCommunicationPermissions(): Promise<CommunicationPermissionsResponseDto> {
    return this.systemSettingsService.getCommunicationPermissions();
  }

  @Public()
  @Get('guest-wait')
  @ApiOperation({ summary: 'Misafir bekleme süresini getir (Public)' })
  @ApiResponse({
    status: 200,
    type: GuestWaitResponseDto,
  })
  getGuestWait(): Promise<GuestWaitResponseDto> {
    return this.systemSettingsService.getGuestWait();
  }

  @Get('web-console-stats')
  @ApiOperation({ summary: 'Web konsol istatistiklerini getir' })
  @ApiResponse({
    status: 200,
    type: WebConsoleStatsResponseDto,
  })
  async getWebConsoleStats(
    @Request() req,
  ): Promise<WebConsoleStatsResponseDto> {
    await this.ensureSiteSettingsPermission(req);
    return this.systemSettingsService.getWebConsoleStats();
  }

  @Get('animations')
  @ApiOperation({ summary: 'Web konsol animasyon listesini getir' })
  @ApiResponse({
    status: 200,
    type: WebConsoleAnimationsResponseDto,
  })
  async getWebConsoleAnimations(
    @Request() req,
  ): Promise<WebConsoleAnimationsResponseDto> {
    await this.ensureSiteSettingsPermission(req);
    return this.systemSettingsService.getWebConsoleAnimations();
  }

  @Public()
  @Get('public-animations')
  @ApiOperation({ summary: 'Genel animasyon listesini getir (Public)' })
  @ApiResponse({
    status: 200,
    type: WebConsoleAnimationsResponseDto,
  })
  getPublicWebConsoleAnimations(): Promise<WebConsoleAnimationsResponseDto> {
    return this.systemSettingsService.getWebConsoleAnimations();
  }

  @Post('animations')
  @UseInterceptors(
    FilesInterceptor('files', 500, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Web konsola yeni animasyon ekle' })
  @ApiResponse({ status: 200, description: 'Animasyon yüklendi' })
  async uploadWebConsoleAnimation(
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<{ message: string }> {
    await this.ensureSiteSettingsPermission(req);
    return this.systemSettingsService.uploadWebConsoleAnimations(files ?? []);
  }

  @Put('animations/:fileName')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Mevcut animasyonu değiştir' })
  @ApiResponse({ status: 200, description: 'Animasyon güncellendi' })
  async replaceWebConsoleAnimation(
    @Request() req,
    @Param('fileName') fileName: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ message: string }> {
    await this.ensureSiteSettingsPermission(req);
    return this.systemSettingsService.replaceWebConsoleAnimation(
      decodeURIComponent(fileName),
      file,
    );
  }

  @Delete('animations/:fileName')
  @ApiOperation({ summary: 'Animasyonu sil' })
  @ApiResponse({ status: 200, description: 'Animasyon silindi' })
  async deleteWebConsoleAnimation(
    @Request() req,
    @Param('fileName') fileName: string,
  ): Promise<{ message: string }> {
    await this.ensureSiteSettingsPermission(req);
    return this.systemSettingsService.deleteWebConsoleAnimation(
      decodeURIComponent(fileName),
    );
  }

  @Post('root/repair')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Root hesabını onar" })
  @ApiResponse({ status: 200, description: 'Root hesabı onarıldı' })
  async repairRoot(@Request() req): Promise<{ message: string }> {
    await this.ensureRootOperationsPermission(req);
    const actorUsername = String(req?.user?.username || '').trim() || 'Sistem';
    return this.systemSettingsService.repairRoot(actorUsername);
  }

  @Post('root/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Root şifresini değiştir" })
  @ApiResponse({ status: 200, description: 'Root şifresi değiştirildi' })
  async changeRootPassword(
    @Request() req,
    @Body() dto: ChangeRootPasswordDto,
  ): Promise<{ message: string }> {
    await this.ensureRootOperationsPermission(req);
    const actorUsername = String(req?.user?.username || '').trim() || 'Sistem';
    return this.systemSettingsService.changeRootPassword(
      dto.password,
      actorUsername,
    );
  }

  @Post('system-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Canlı sistem mesajı gönder' })
  @ApiResponse({ status: 200, description: 'Sistem mesajı gönderildi' })
  async sendSystemMessage(
    @Request() req,
    @Body() dto: SendSystemMessageDto,
  ): Promise<{ message: string }> {
    await this.ensureSystemMessagePermission(req);
    return this.systemSettingsService.sendSystemMessage(dto.content);
  }

  @Post('system-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sistem resetleme akışını başlat' })
  @ApiResponse({ status: 200, description: 'Sistem resetleme başlatıldı' })
  async startSystemReset(
    @Request() req,
  ): Promise<{
    message: string;
    countdownSeconds: number;
    remainingDurationMs: number;
    timestamp: string;
    deletedMessagesCount: number;
  }> {
    await this.ensureSiteSettingsPermission(req);
    const result = await this.systemSettingsService.startSystemReset();

    await this.adminActionsService.logAction({
      adminId: Number(req?.user?.sub) || null,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.SYSTEM_RESET,
      description: 'Sistem resetleme başlatıldı',
      metadata: {
        countdownSeconds: result.countdownSeconds,
        deletedMessagesCount: result.deletedMessagesCount,
      },
    });

    return result;
  }

  @Public()
  @Get('system-reset/status')
  @ApiOperation({ summary: 'Aktif sistem resetleme durumunu getir (Public)' })
  @ApiResponse({ status: 200, description: 'Sistem resetleme durumu' })
  getSystemResetStatus(): {
    active: boolean;
    countdownSeconds?: number;
    remainingDurationMs?: number;
    message?: string;
    timestamp?: string;
  } {
    return this.systemSettingsService.getSystemResetStatus();
  }

  @Put()
  @ApiOperation({ summary: 'Sistem ayarlarını güncelle' })
  @ApiResponse({
    status: 200,
    type: SystemSettingsResponseDto,
  })
  async updateSettings(
    @Request() req,
    @Body() dto: UpdateSystemSettingsDto,
  ): Promise<SystemSettingsResponseDto> {
    await this.ensureSiteSettingsPermission(req);
    return this.systemSettingsService.updateSettings(dto);
  }
}
