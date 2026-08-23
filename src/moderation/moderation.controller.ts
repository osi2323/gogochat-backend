import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { BanUserDto } from './dto/ban-user.dto';
import { DeviceBanUserDto } from './dto/device-ban-user.dto';
import { KickUserDto } from './dto/kick-user.dto';
import { ToggleRoomMuteDto } from './dto/toggle-room-mute.dto';
import { ToggleGlobalMuteDto } from './dto/toggle-global-mute.dto';
import { ToggleCameraBanDto } from './dto/toggle-camera-ban.dto';
import {
  BannedUsersResponseDto,
  BannedUserDto,
} from './dto/banned-users-response.dto';
import { ModerationService } from './moderation.service';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import { AdminActionType } from '../admin-actions/enums/admin-action-type.enum';
import { UserBan } from './entities/user-ban.entity';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Moderation')
@ApiBearerAuth()
@UseGuards(AuthGuard, StarCountGuard)
@Controller('moderation')
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
    private readonly adminActionsService: AdminActionsService,
    private readonly userService: UserService,
  ) {}

  private async getPermissionContext(req: any): Promise<{
    isRoot: boolean;
    user: any | null;
  }> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') {
      return { isRoot: true, user: null };
    }
    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    return { isRoot: false, user };
  }

  private async ensureAdminPanelPermission(req: any): Promise<void> {
    const context = await this.getPermissionContext(req);
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
  }

  private async ensureKickPermission(req: any): Promise<void> {
    const context = await this.getPermissionContext(req);
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.SITE_KICK)) {
      throw new ForbiddenException('Siteden atma yetkiniz yok.');
    }
  }

  private async ensureBanPermission(req: any): Promise<void> {
    const context = await this.getPermissionContext(req);
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.BAN_MANAGEMENT)) {
      throw new ForbiddenException('Banlama yetkiniz yok.');
    }
  }

  private async ensureCameraModerationPermission(req: any): Promise<void> {
    const context = await this.getPermissionContext(req);
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (
      !hasPermissionForUser(context.user, PERMISSION_LABELS.CAMERA_MODERATION)
    ) {
      throw new ForbiddenException('Kamera engelle yetkiniz yok.');
    }
  }

  @Post('ban')
  @MinStarCount(1)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kullanıcıyı banla' })
  @ApiResponse({ status: 201, description: 'Kullanıcı banlandı' })
  async banUser(
    @Request() req,
    @Body() banUserDto: BanUserDto,
  ): Promise<UserBan> {
    await this.ensureBanPermission(req);
    const adminId = Number(req?.user?.sub);
    const { ban, targetUser } = await this.moderationService.banUser(
      adminId,
      banUserDto,
    );

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_USER_BAN,
      description: `Kullanıcı banlandı: ${banUserDto.username}`,
      targetUserId: targetUser?.id ?? null,
      targetUsername: banUserDto.username,
      metadata: {
        reason: banUserDto.reason ?? null,
        expiresAt: banUserDto.expiresAt ?? null,
        isGuest: !targetUser,
      },
    });

    return ban;
  }

  @Post('device-ban')
  @MinStarCount(1)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kullanıcının cihazını/IP adresini banla' })
  @ApiResponse({ status: 201, description: 'Kullanıcının cihazı banlandı' })
  async deviceBanUser(
    @Request() req,
    @Body() deviceBanUserDto: DeviceBanUserDto,
  ): Promise<{ ipAddress: string; affectedUsers: string[] }> {
    await this.ensureBanPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.deviceBanUser(
      adminId,
      deviceBanUserDto,
    );

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_DEVICE_BAN,
      description: `Cihaz banı uygulandı: ${deviceBanUserDto.username}`,
      targetUserId: result.targetUser?.id ?? null,
      targetUsername: deviceBanUserDto.username,
      metadata: {
        ipAddress: result.ipAddress,
        affectedUsers: result.affectedUsers,
        loginHistoryId: deviceBanUserDto.loginHistoryId ?? null,
      },
    });

    return {
      ipAddress: result.ipAddress,
      affectedUsers: result.affectedUsers,
    };
  }

  @Post('kick')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kullanıcıyı sistemden at' })
  @ApiResponse({ status: 200, description: 'Kullanıcı sistemden atıldı' })
  async kickUser(
    @Request() req,
    @Body() kickUserDto: KickUserDto,
  ): Promise<void> {
    await this.ensureKickPermission(req);
    const adminId = Number(req?.user?.sub);
    await this.moderationService.kickUser(adminId, kickUserDto);

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_KICK_USER,
      description: `Kullanıcı sistemden atıldı: ${kickUserDto.username}`,
      targetUserId: null, // Kick işlemi ID gerektirmez, sadece username
      targetUsername: kickUserDto.username,
      metadata: {
        reason: kickUserDto.reason ?? null,
      },
    });
  }

  @Get('banned-users')
  @MinStarCount(1)
  @ApiOperation({ summary: 'Banlı kullanıcıların listesini getir' })
  @ApiResponse({ status: 200, description: 'Banlı kullanıcılar listesi' })
  async getBannedUsers(@Request() req): Promise<BannedUsersResponseDto> {
    await this.ensureBanPermission(req);
    const bannedUsers = await this.moderationService.getBannedUsers();
    const ipBans = await this.moderationService.getActiveIpBans();

    const bannedUserDtos: BannedUserDto[] = bannedUsers.map((ban) => ({
      id: ban.id,
      banType: 'user',
      username: ban.user?.username ?? 'Bilinmiyor',
      bannedByUsername: ban.bannedBy?.username ?? 'Sistem',
      bannedByStarCount: ban.bannedBy?.role?.starCount ?? 0,
      reason: ban.reason,
      expiresAt: ban.expiresAt,
      createdAt: ban.createdAt,
    }));
    const ipBanDtos: BannedUserDto[] = ipBans.map((ban) => {
      const metadata = (ban.metadata ?? {}) as Record<string, unknown>;
      const targetUsername =
        typeof metadata.targetUsername === 'string'
          ? metadata.targetUsername
          : null;
      const bannedByUsername =
        typeof metadata.bannedByUsername === 'string'
          ? metadata.bannedByUsername
          : 'Sistem';

      return {
        id: ban.id,
        banType: 'ip',
        username: targetUsername ?? ban.ipAddress ?? 'IP Ban',
        bannedByUsername,
        bannedByStarCount: 0,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
        createdAt: ban.createdAt,
        ipAddress: ban.ipAddress,
        source: ban.source,
      };
    });

    return {
      bannedUsers: [...bannedUserDtos, ...ipBanDtos],
      total: bannedUserDtos.length + ipBanDtos.length,
    };
  }

  @Get('all-bans')
  @MinStarCount(1)
  @ApiOperation({ summary: 'Tüm ban kayıtlarını getir (debug için)' })
  @ApiResponse({ status: 200, description: 'Tüm ban kayıtları' })
  async getAllBans(@Request() req): Promise<any[]> {
    await this.ensureBanPermission(req);
    const allBans = await this.moderationService.getAllBans();

    return allBans.map((ban) => ({
      id: ban.id,
      userId: ban.userId,
      username: ban.user?.username,
      bannedById: ban.bannedById,
      bannedByUsername: ban.bannedBy?.username,
      bannedByStarCount: ban.bannedBy?.role?.starCount ?? 0,
      reason: ban.reason,
      expiresAt: ban.expiresAt,
      createdAt: ban.createdAt,
    }));
  }

  @Delete('bans/clear')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yetkili kullanıcının kaldırabileceği tüm banları temizle' })
  @ApiResponse({ status: 200, description: 'Ban kayıtları temizlendi' })
  async clearBannedUsers(
    @Request() req,
  ): Promise<{ clearedCount: number; skippedCount: number }> {
    await this.ensureBanPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.clearBannedUsers(adminId);

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_USER_UNBAN,
      description: `Toplu ban temizleme yapıldı (${result.clearedCount})`,
      targetUserId: null,
      targetUsername: null,
      metadata: result,
    });

    return result;
  }

  @Delete('room-mutes/:room/clear')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aktif odadaki susturma engellerini temizle' })
  @ApiResponse({ status: 200, description: 'Oda engelleri temizlendi' })
  async clearRoomMutes(
    @Request() req,
    @Param('room') room: string,
  ): Promise<{ clearedCount: number; skippedCount: number; room: string }> {
    await this.ensureAdminPanelPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.clearRoomMutes(adminId, room);

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_ROOM_MUTE_TOGGLE,
      description: `Oda engelleri toplu temizlendi: ${result.room} (${result.clearedCount})`,
      targetUserId: null,
      targetUsername: null,
      metadata: result,
    });

    return result;
  }

  @Delete('global-mutes/clear')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tüm odalarda susturulan kullanıcıları temizle' })
  @ApiResponse({ status: 200, description: 'Tüm oda susturmaları temizlendi' })
  async clearGlobalMutes(
    @Request() req,
  ): Promise<{ clearedCount: number; skippedCount: number }> {
    await this.ensureAdminPanelPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.clearGlobalMutes(adminId);

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_GLOBAL_MUTE_TOGGLE,
      description: `Tüm odalarda susturulanlar toplu temizlendi (${result.clearedCount})`,
      targetUserId: null,
      targetUsername: null,
      metadata: result,
    });

    return result;
  }

  @Delete('unban/:banId')
  @MinStarCount(1)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kullanıcının banını kaldır' })
  @ApiResponse({ status: 204, description: 'Ban kaldırıldı' })
  async unbanUser(
    @Request() req,
    @Param('banId') banId: string,
  ): Promise<void> {
    await this.ensureBanPermission(req);
    const adminId = Number(req?.user?.sub);
    const banIdNumber = Number(banId);

    if (isNaN(banIdNumber)) {
      throw new BadRequestException('Geçerli bir ban ID giriniz');
    }

    await this.moderationService.unbanUser(adminId, banIdNumber);

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_USER_UNBAN,
      description: `Kullanıcı banı kaldırıldı (Ban ID: ${banId})`,
      targetUserId: null, // Ban kaldırılırken target user ID'yi almak için ek sorgu gerekebilir
      targetUsername: null,
      metadata: {
        banId: banIdNumber,
      },
    });
  }

  @Delete('unban-ip/:banId')
  @MinStarCount(1)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'IP/cihaz banını kaldır' })
  @ApiResponse({ status: 204, description: 'IP ban kaldırıldı' })
  async unbanIp(
    @Request() req,
    @Param('banId') banId: string,
  ): Promise<void> {
    await this.ensureBanPermission(req);
    const adminId = Number(req?.user?.sub);
    const banIdNumber = Number(banId);

    if (isNaN(banIdNumber)) {
      throw new BadRequestException('Geçerli bir ban ID giriniz');
    }

    const ban = await this.moderationService.unbanIp(adminId, banIdNumber);
    const metadata = (ban.metadata ?? {}) as Record<string, unknown>;
    const targetUsername =
      typeof metadata.targetUsername === 'string' ? metadata.targetUsername : null;

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_IP_UNBAN,
      description: `IP banı kaldırıldı: ${ban.ipAddress}`,
      targetUserId:
        typeof metadata.targetUserId === 'number' ? metadata.targetUserId : null,
      targetUsername,
      metadata: {
        banId: banIdNumber,
        ipAddress: ban.ipAddress,
        source: ban.source,
      },
    });
  }

  @Post('toggle-mic-ban')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kullanıcının mikrofon yasak durumunu değiştir' })
  @ApiResponse({
    status: 200,
    description: 'Mikrofon yasak durumu güncellendi',
  })
  async toggleMicBan(
    @Request() req,
    @Body() body: { username: string },
  ): Promise<{ micBanned: boolean }> {
    await this.ensureAdminPanelPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.toggleMicBan(
      adminId,
      body.username,
    );
    const { micBanned } = result;

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_MIC_BAN_TOGGLE,
      description: `Mikrofon yasak durumu değiştirildi: ${body.username} (${micBanned ? 'Yasaklandı' : 'Yasak Kaldırıldı'})`,
      targetUserId: result.targetUserId,
      targetUsername: result.targetUsername,
      metadata: {
        micBanned,
        isGuest: result.isGuest,
      },
    });

    return { micBanned };
  }

  @Post('toggle-camera-ban')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kullanıcının kamera yasak durumunu değiştir' })
  @ApiResponse({
    status: 200,
    description: 'Kamera yasak durumu güncellendi',
  })
  async toggleCameraBan(
    @Request() req,
    @Body() body: ToggleCameraBanDto,
  ): Promise<{ cameraBanned: boolean }> {
    await this.ensureCameraModerationPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.toggleCameraBan(
      adminId,
      body.username,
    );
    const { cameraBanned } = result;

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_CAMERA_BAN_TOGGLE,
      description: `Kamera yasak durumu değiştirildi: ${body.username} (${cameraBanned ? 'Yasaklandı' : 'Yasak Kaldırıldı'})`,
      targetUserId: result.targetUserId,
      targetUsername: result.targetUsername,
      metadata: {
        cameraBanned,
        isGuest: result.isGuest,
      },
    });

    return { cameraBanned };
  }

  @Post('toggle-room-mute')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kullanıcının odadaki susturma durumunu değiştir' })
  @ApiResponse({
    status: 200,
    description: 'Odadaki susturma durumu güncellendi',
  })
  async toggleRoomMute(
    @Request() req,
    @Body() body: ToggleRoomMuteDto,
  ): Promise<{ roomMuted: boolean; room: string }> {
    await this.ensureAdminPanelPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.toggleRoomMute(
      adminId,
      body.username,
      body.room,
    );

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_ROOM_MUTE_TOGGLE,
      description: `Odada susturma durumu değiştirildi: ${body.username} (${result.roomMuted ? 'Susturuldu' : 'Susturma Kaldırıldı'})`,
      targetUserId: result.targetUserId,
      targetUsername: result.targetUsername,
      metadata: {
        room: result.room,
        roomMuted: result.roomMuted,
      },
    });

    return { roomMuted: result.roomMuted, room: result.room };
  }

  @Post('toggle-global-mute')
  @MinStarCount(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kullanıcının tüm odalardaki susturma durumunu değiştir',
  })
  @ApiResponse({
    status: 200,
    description: 'Tüm odalardaki susturma durumu güncellendi',
  })
  async toggleGlobalMute(
    @Request() req,
    @Body() body: ToggleGlobalMuteDto,
  ): Promise<{ globalMuted: boolean }> {
    await this.ensureAdminPanelPermission(req);
    const adminId = Number(req?.user?.sub);
    const result = await this.moderationService.toggleGlobalMute(
      adminId,
      body.username,
    );

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_GLOBAL_MUTE_TOGGLE,
      description: `Tüm odalarda susturma durumu değiştirildi: ${body.username} (${result.globalMuted ? 'Susturuldu' : 'Susturma Kaldırıldı'})`,
      targetUserId: result.targetUserId,
      targetUsername: result.targetUsername,
      metadata: {
        globalMuted: result.globalMuted,
        isGuest: result.isGuest,
      },
    });

    return { globalMuted: result.globalMuted };
  }
}
