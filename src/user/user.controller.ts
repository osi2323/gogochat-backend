import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Patch,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import { AdminActionType } from '../admin-actions/enums/admin-action-type.enum';
import { UpdateUserStatusModeDto } from './dto/update-user-status-mode.dto';
import { UpdateUserFrameDto } from './dto/update-user-frame.dto';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { UpdateUserIconDto } from './dto/update-user-icon.dto';
import { UpdateUserFontNameDto } from './dto/update-user-font-name.dto';
import { UpdateUserGraniteDto } from './dto/update-user-granite.dto';
import { UpdateUserNickColorDto } from './dto/update-user-nick-color.dto';
import { UpdateUserGifDto } from './dto/update-user-gif.dto';
import { UpdateUserByAdminDto } from './dto/update-user-by-admin.dto';
import { UpdateUserChatPreferencesDto } from './dto/update-user-chat-preferences.dto';
import { UpdateUserJoinEffectDto } from './dto/update-user-join-effect.dto';
import { UpdateUserFlashNickDto } from './dto/update-user-flash-nick.dto';
import { RoomsGateway } from '../rooms/rooms.gateway';
import { Role } from '../role/entities/role.entity';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

const ACTION_NOT_ALLOWED_MESSAGE = 'Bu işlemi yapmaya hakkınız yok.';

@ApiBearerAuth()
@Controller('user')
@UseGuards(AuthGuard, StarCountGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(
    private readonly userService: UserService,
    private readonly adminActionsService: AdminActionsService,
    private readonly roomsGateway: RoomsGateway,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  private async ensureAdminPanelPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') {
      return;
    }
    const user = await this.userService.findById(Number(req?.user?.sub));
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
  }

  private async ensureFlashNickPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;
    const user = await this.userService.findById(Number(req?.user?.sub));
    if (!hasPermissionForUser(user, PERMISSION_LABELS.FLASH_NICK_UPLOAD)) {
      throw new ForbiddenException('Flash nick yükleme yetkiniz yok.');
    }
  }

  private async ensureStaffManagementPermission(
    req: any,
    targetStars: { currentTargetStar: number; nextTargetStar: number },
  ): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const { currentTargetStar, nextTargetStar } = targetStars;
    const touchesStaffScope = currentTargetStar > 0 || nextTargetStar > 0;
    if (!touchesStaffScope) return;

    const adminUser = await this.userService.findById(Number(req?.user?.sub));
    if (!hasPermissionForUser(adminUser, PERMISSION_LABELS.STAFF_MANAGEMENT)) {
      throw new ForbiddenException('Yetkili yönetimi yetkiniz yok.');
    }
  }

  private async ensureMemberManagementPermission(
    req: any,
    targetStars: { currentTargetStar: number; nextTargetStar: number },
  ): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const { currentTargetStar, nextTargetStar } = targetStars;
    const touchesMemberScope = currentTargetStar <= 0 || nextTargetStar <= 0;
    if (!touchesMemberScope) return;

    const adminUser = await this.userService.findById(Number(req?.user?.sub));
    if (!hasPermissionForUser(adminUser, PERMISSION_LABELS.MEMBER_MANAGEMENT)) {
      throw new ForbiddenException('Üye yönetimi yetkiniz yok.');
    }
  }

  private async stripUnauthorizedPermissionOverrides(
    req: any,
    updateUserByAdminDto: UpdateUserByAdminDto,
  ): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const hasPermissionsOverride = Object.prototype.hasOwnProperty.call(
      updateUserByAdminDto ?? {},
      'permissions',
    );
    if (!hasPermissionsOverride) return;

    const adminUser = await this.userService.findById(Number(req?.user?.sub));
    if (hasPermissionForUser(adminUser, PERMISSION_LABELS.PERMISSION_GRANT)) {
      return;
    }

    // Keep edit flow working; ignore unauthorized permission override payload.
    delete (updateUserByAdminDto as Partial<UpdateUserByAdminDto>).permissions;
  }

  private async ensureAdminFlashNickPermission(
    req: any,
    updateUserByAdminDto: UpdateUserByAdminDto,
  ): Promise<void> {
    const hasFlashNickOverride = Object.prototype.hasOwnProperty.call(
      updateUserByAdminDto ?? {},
      'flashNick',
    );
    if (!hasFlashNickOverride) return;

    await this.ensureFlashNickPermission(req);
  }

  private async ensureMemberStaffDeletePermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const adminUser = await this.userService.findById(Number(req?.user?.sub));
    if (
      !hasPermissionForUser(adminUser, PERMISSION_LABELS.MEMBER_STAFF_DELETE)
    ) {
      throw new ForbiddenException('Üye ve yetkili silme yetkiniz yok.');
    }
  }

  private async ensureCanActOnTargetRank(
    req: any,
    targetStars: { currentTargetStar: number; nextTargetStar: number },
  ): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;

    const adminUser = await this.userService.findById(Number(req?.user?.sub));
    const adminStar = Number(adminUser?.role?.starCount ?? 0);
    const highestTargetStar = Math.max(
      Number(targetStars.currentTargetStar ?? 0),
      Number(targetStars.nextTargetStar ?? 0),
    );

    if (adminStar <= highestTargetStar) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }
  }

  private async resolveTargetStars(
    targetUserId: number,
    updateUserByAdminDto: UpdateUserByAdminDto,
  ): Promise<{ currentTargetStar: number; nextTargetStar: number }> {
    const targetUser = await this.userService.findById(targetUserId);
    const currentTargetStar = Number(targetUser?.role?.starCount ?? 0);
    let nextTargetStar = currentTargetStar;

    if (updateUserByAdminDto.roleId !== undefined) {
      const targetRole = await this.roleRepository.findOne({
        where: { id: updateUserByAdminDto.roleId },
      });
      if (targetRole) {
        nextTargetStar = Number(targetRole.starCount ?? 0);
      }
    }

    return { currentTargetStar, nextTargetStar };
  }

  @Get('roof-access')
  @ApiOperation({ summary: 'Kullanıcının çatı girişi iznini kontrol et' })
  async checkRoofAccess(@Request() req): Promise<{ roofAccess: boolean }> {
    const userId = Number(req.user.sub);
    const user = await this.userService.findById(userId);
    const hasRoofAccess = user?.permissions?.includes('Çatı Girişi') ?? false;
    return { roofAccess: hasRoofAccess };
  }

  @Get('star-users')
  @MinStarCount(1)
  async getUsersWithMinStar(@Request() req): Promise<User[]> {
    await this.ensureAdminPanelPermission(req);
    const result = await this.userService.findByMinStarCount(1);
    await this.adminActionsService.logAction({
      adminId: Number(req?.user?.sub),
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_STAR_USER_LIST,
      description: 'Yıldızlı kullanıcılar listelendi (Min 1 Yıldız)',
      metadata: { minStarCount: 1 },
    });
    return result;
  }

  @Get()
  @MinStarCount(1)
  async getAllUsers(@Request() req): Promise<User[]> {
    await this.ensureAdminPanelPermission(req);
    const result = await this.userService.findByMaxStarCount(1);
    await this.adminActionsService.logAction({
      adminId: Number(req?.user?.sub),
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_USER_LIST,
      description: 'Normal kullanıcılar listelendi (Yıldızsız)',
    });
    return result;
  }

  @Get(':id')
  @MinStarCount(1)
  async getUserById(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<User> {
    await this.ensureAdminPanelPermission(req);
    const result = await this.userService.findByIdWithFullSelect(id);
    if (!result) {
      throw new ForbiddenException('Kullanıcı bulunamadı.');
    }
    return result;
  }

  @Patch('status-mode')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async updateMyStatusMode(
    @Request() req,
    @Body() updateUserStatusModeDto: UpdateUserStatusModeDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateStatusMode(
      userId,
      updateUserStatusModeDto.statusModeId,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı durum modunu güncelledi: ${
        result.statusMode?.name ?? 'belirsiz'
      }`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { statusModeId: updateUserStatusModeDto.statusModeId },
    });

    await this.roomsGateway.syncUserStatusModeFromPersistence({
      userId,
      username: req?.user?.username,
      statusModeId: result.statusModeId ?? updateUserStatusModeDto.statusModeId,
      statusModeName: result.statusMode?.name ?? null,
      joinEffect: result.joinEffect ?? null,
    });

    return result;
  }

  @Patch('frame')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async updateMyFrame(
    @Request() req,
    @Body() updateUserFrameDto: UpdateUserFrameDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateFrame(
      userId,
      updateUserFrameDto.frame ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_FRAME_UPDATE,
      description: `Kullanıcı profil çerçevesini güncelledi: ${result.frame}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { frame: updateUserFrameDto.frame },
    });

    return result;
  }

  @Patch('icon')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async updateMyIcon(
    @Request() req,
    @Body() updateUserIconDto: UpdateUserIconDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateIcon(
      userId,
      updateUserIconDto.icon ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı ikonunu güncelledi: ${result.icon ?? 'boş'}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { icon: updateUserIconDto.icon },
    });

    return result;
  }

  @Patch('username')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async updateMyUsername(
    @Request() req,
    @Body() updateUsernameDto: UpdateUsernameDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateUsername(
      userId,
      updateUsernameDto.username,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı rumuzunu güncelledi: ${result.username}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { username: updateUsernameDto.username },
    });

    return result;
  }

  @Patch('font-name')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının yazı tipi adını güncelle' })
  async updateMyFontName(
    @Request() req,
    @Body() updateUserFontNameDto: UpdateUserFontNameDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateFontName(
      userId,
      updateUserFontNameDto.fontName ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı yazı tipini güncelledi: ${result.fontName ?? 'boş'}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { fontName: updateUserFontNameDto.fontName },
    });

    return result;
  }

  @Patch('granite')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının granit bilgisini güncelle' })
  async updateMyGranite(
    @Request() req,
    @Body() updateUserGraniteDto: UpdateUserGraniteDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateGranite(
      userId,
      updateUserGraniteDto.granite ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı granit bilgisini güncelledi: ${result.granite ?? 'boş'}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { granite: updateUserGraniteDto.granite },
    });

    return result;
  }

  @Patch('nick-color')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının rumuz rengini güncelle' })
  async updateMyNickColor(
    @Request() req,
    @Body() updateUserNickColorDto: UpdateUserNickColorDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateNickColor(
      userId,
      updateUserNickColorDto.nickColor ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı rumuz rengini güncelledi: ${result.nickColor ?? 'boş'}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { nickColor: updateUserNickColorDto.nickColor },
    });

    return result;
  }

  @Patch('user-gif')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının profil user gif bilgisini güncelle' })
  async updateMyUserGif(
    @Request() req,
    @Body() updateUserGifDto: UpdateUserGifDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateUserGif(
      userId,
      updateUserGifDto.userGif ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı user gif bilgisini güncelledi: ${result.userGif ?? 'boş'}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { userGif: updateUserGifDto.userGif },
    });

    return result;
  }

  @Patch('flash-nick')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının flash nick görselini güncelle' })
  async updateMyFlashNick(
    @Request() req,
    @Body() updateUserFlashNickDto: UpdateUserFlashNickDto,
  ): Promise<User> {
    await this.ensureFlashNickPermission(req);
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateFlashNick(
      userId,
      updateUserFlashNickDto.flashNick ?? null,
    );
    this.roomsGateway.syncFlashNickInAllRooms(
      result.username,
      result.flashNick ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı flash nick bilgisini güncelledi: ${
        result.flashNick ? 'dolu' : 'boş'
      }`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { hasFlashNick: Boolean(updateUserFlashNickDto.flashNick) },
    });

    return result;
  }

  @Patch('freeze')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının kendi hesabını dondur' })
  async freezeMyAccount(@Request() req): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.freezeOwnAccount(userId);

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_USER_UPDATE,
      description: `Kullanıcı hesabını dondurdu: ${result.username}`,
      targetUserId: userId,
      targetUsername: result.username,
      metadata: { accountFrozen: true },
    });

    return result;
  }

  @Patch('chat-preferences')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının sohbet tercihlerini güncelle' })
  async updateMyChatPreferences(
    @Request() req,
    @Body() updateUserChatPreferencesDto: UpdateUserChatPreferencesDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateChatPreferences(
      userId,
      updateUserChatPreferencesDto,
    );

    return result;
  }

  @Patch('join-effect')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Kullanıcının giriş efektini güncelle' })
  async updateMyJoinEffect(
    @Request() req,
    @Body() updateUserJoinEffectDto: UpdateUserJoinEffectDto,
  ): Promise<User> {
    const userId = Number(req?.user?.sub);
    const result = await this.userService.updateJoinEffect(
      userId,
      updateUserJoinEffectDto.joinEffect ?? null,
    );

    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.USER_STATUS_MODE_UPDATE,
      description: `Kullanıcı giriş efektini güncelledi: ${result.joinEffect ?? 'boş'}`,
      targetUserId: userId,
      targetUsername: req?.user?.username,
      metadata: { joinEffect: updateUserJoinEffectDto.joinEffect ?? null },
    });

    return result;
  }

  @Patch(':id/manage')
  @MinStarCount(1)
  async updateUserByAdmin(
    @Request() req,
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateUserByAdminDto: UpdateUserByAdminDto,
  ): Promise<User> {
    await this.ensureAdminPanelPermission(req);
    const targetStars = await this.resolveTargetStars(userId, updateUserByAdminDto);
    await this.ensureCanActOnTargetRank(req, targetStars);
    await this.ensureStaffManagementPermission(req, targetStars);
    await this.ensureMemberManagementPermission(req, targetStars);
    await this.ensureAdminFlashNickPermission(req, updateUserByAdminDto);
    await this.stripUnauthorizedPermissionOverrides(req, updateUserByAdminDto);
    const adminId = Number(req?.user?.sub);
    const updatedUser = await this.userService.updateUserByAdmin(
      adminId,
      userId,
      updateUserByAdminDto,
    );

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_USER_UPDATE,
      description: `Kullanıcı bilgileri güncellendi: ${updatedUser.username}`,
      targetUserId: userId,
      targetUsername: updatedUser.username,
      metadata: {
        updatedFields: Object.keys(updateUserByAdminDto ?? {}),
        membershipExpiresAt: updatedUser.membershipExpiresAt,
        protection: updatedUser.protection,
        roleId: updatedUser.roleId,
        hasFlashNick: Boolean(updatedUser.flashNick),
        accountFrozen: updatedUser.accountFrozen,
      },
    });

    const hasRoleUpdate = updateUserByAdminDto.roleId !== undefined;
    const hasPermissionsUpdate = Object.prototype.hasOwnProperty.call(
      updateUserByAdminDto ?? {},
      'permissions',
    );

    // Emit socket event to notify connected clients when role/permission changes.
    if (hasRoleUpdate || hasPermissionsUpdate) {
      if (process.env.ROLE_DEBUG_LOGS === 'true') {
        this.logger.log(
          `[ROLE_DEBUG] updateUserByAdmin ${JSON.stringify(
            {
              adminId,
              targetUserId: updatedUser.id,
              targetUsername: updatedUser.username,
              tenantId: typeof req?.tenant === 'string' ? req.tenant : undefined,
              hasRoleUpdate,
              hasPermissionsUpdate,
              roleId: updatedUser.roleId,
              role: updatedUser.role
                ? {
                    id: updatedUser.role.id,
                    name: updatedUser.role.name,
                    starCount: updatedUser.role.starCount,
                    starColor: updatedUser.role.starColor,
                    icon: updatedUser.role.icon || '',
                  }
                : null,
              permissions: updatedUser.permissions ?? [],
            },
            null,
            2,
          )}`,
        );
      }

      this.roomsGateway.emitUserRoleChanged({
        userId: updatedUser.id,
        username: updatedUser.username,
        tenantId: typeof req?.tenant === 'string' ? req.tenant : undefined,
        roleId: updatedUser.roleId,
        role: updatedUser.role
          ? {
              id: updatedUser.role.id,
              name: updatedUser.role.name,
              starCount: updatedUser.role.starCount,
              starColor: updatedUser.role.starColor,
              icon: updatedUser.role.icon || '',
            }
          : null,
      });

      if (hasRoleUpdate) {
        // Update in-room role visuals only when the actual role changes.
        this.roomsGateway.updateUserRoleInAllRooms(
          updatedUser.username,
          updatedUser.role
            ? {
                name: updatedUser.role.name,
                starCount: updatedUser.role.starCount,
                starColor: updatedUser.role.starColor,
                icon: updatedUser.role.icon || '',
              }
            : null,
          updatedUser.id,
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateUserByAdminDto ?? {}, 'flashNick')) {
      this.roomsGateway.syncFlashNickInAllRooms(
        updatedUser.username,
        updatedUser.flashNick ?? null,
      );
    }

    return updatedUser;
  }

  @Delete(':id')
  @MinStarCount(1)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserByAdmin(
    @Request() req,
    @Param('id', ParseIntPipe) userId: number,
  ): Promise<void> {
    await this.ensureAdminPanelPermission(req);
    const targetUser = await this.userService.findById(userId);
    const targetStar = Number(targetUser?.role?.starCount ?? 0);
    await this.ensureCanActOnTargetRank(req, {
      currentTargetStar: targetStar,
      nextTargetStar: targetStar,
    });
    await this.ensureStaffManagementPermission(req, {
      currentTargetStar: targetStar,
      nextTargetStar: targetStar,
    });
    await this.ensureMemberManagementPermission(req, {
      currentTargetStar: targetStar,
      nextTargetStar: targetStar,
    });
    await this.ensureMemberStaffDeletePermission(req);

    const adminId = Number(req?.user?.sub);
    await this.userService.deleteUserByAdmin(adminId, userId);

    await this.adminActionsService.logAction({
      adminId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.ADMIN_USER_DELETE,
      description: `Kullanıcı silindi`,
      targetUserId: userId,
    });
  }
}
