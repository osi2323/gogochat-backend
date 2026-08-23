import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, IsNull, ObjectLiteral, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Role } from '../role/entities/role.entity';
import { User } from '../user/entities/user.entity';
import { Bot } from '../bot/entities/bot.entity';
import { SystemSettings } from '../settings/entities/system-settings.entity';
import { StatusMode } from '../status-mode/entities/status-mode.entity';
import { RoomsGateway } from '../rooms/rooms.gateway';
import { Message } from '../messages/entities/message.entity';

export interface BackupData {
  timestamp: string;
  roles: any[];
  users: any[];
  bots: any[];
  systemSettings: any | null;
  statusModes: any[];
}

export interface BackupFileInfo {
  id: string;
  filename: string;
  timestamp: string;
  path: string;
  size: number;
}

interface RestoreCounts {
  roles: number;
  users: number;
  bots: number;
  settings: boolean;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = 'uploads/backups';

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(SystemSettings)
    private readonly systemSettingsRepository: Repository<SystemSettings>,
    @InjectRepository(StatusMode)
    private readonly statusModeRepository: Repository<StatusMode>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @Inject(forwardRef(() => RoomsGateway))
    private readonly roomsGateway: RoomsGateway,
  ) {}

  private getBackupDir(tenant: string): string {
    const dir = path.join(this.backupDir, tenant);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private normalizeUsername(value?: string | null): string {
    return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  }

  private getExistingPassword(
    backupUser: any,
    existingUsersById: Map<number, User>,
    existingUsersByUsername: Map<string, User>,
  ): string | null {
    const id = Number(backupUser?.id);
    const existingById = Number.isFinite(id) ? existingUsersById.get(id) : null;
    const existingByUsername = existingUsersByUsername.get(
      this.normalizeUsername(backupUser?.username),
    );
    const existingPassword = existingById?.password ?? existingByUsername?.password;
    if (typeof existingPassword === 'string' && existingPassword.trim()) {
      return existingPassword;
    }

    const backupPassword = backupUser?.password;
    if (typeof backupPassword === 'string' && backupPassword.trim()) {
      return backupPassword;
    }

    return null;
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private getQualifiedTableName<T extends ObjectLiteral>(
    repository: Repository<T>,
  ): string {
    const schema =
      repository.metadata.schema ??
      (repository.manager.connection.options as { schema?: string }).schema;
    const tableName = repository.metadata.tableName;

    return [schema, tableName]
      .filter((part): part is string => Boolean(part))
      .map((part) => this.quoteIdentifier(part))
      .join('.');
  }

  private async resetPrimaryKeySequence<T extends ObjectLiteral>(
    repository: Repository<T>,
  ): Promise<void> {
    const tableName = this.getQualifiedTableName(repository);

    await repository.manager.query(
      `SELECT setval(
        pg_get_serial_sequence($1, 'id'),
        COALESCE((SELECT MAX("id") FROM ${tableName}), 1),
        (SELECT COUNT(*) > 0 FROM ${tableName})
      )`,
      [tableName],
    );
  }

  private toFiniteId(value: unknown): number | null {
    const id = Number(value);
    return Number.isFinite(id) ? id : null;
  }

  private mapSavedIds<T extends { id?: unknown }>(
    backupRows: Array<{ id?: unknown }>,
    savedRows: T[],
  ): Map<number, number> {
    const idMap = new Map<number, number>();

    backupRows.forEach((backupRow, index) => {
      const backupId = this.toFiniteId(backupRow.id);
      const savedId = this.toFiniteId(savedRows[index]?.id);
      if (backupId != null && savedId != null) {
        idMap.set(backupId, savedId);
      }
    });

    return idMap;
  }

  private resolveMappedId(
    idMap: Map<number, number>,
    backupId: unknown,
  ): number | null {
    const normalizedId = this.toFiniteId(backupId);
    return normalizedId == null ? null : (idMap.get(normalizedId) ?? null);
  }

  private createDeleteBuilder<T extends ObjectLiteral>(
    repository: Repository<T>,
    entity: EntityTarget<T>,
  ) {
    return repository.createQueryBuilder().delete().from(entity);
  }

  async createBackup(tenant: string): Promise<{ success: boolean; filename: string; timestamp: string }> {
    this.logger.log(`Creating backup for tenant: ${tenant}`);

    const roles = await this.roleRepository.find({ where: { deletedAt: IsNull() } });
    const users = await this.userRepository.find({ 
      where: { deletedAt: IsNull() },
      relations: ['role', 'statusMode'],
    });
    const bots = await this.botRepository.find();
    const systemSettings = await this.systemSettingsRepository.findOne({ where: { id: 1 } });
    const statusModes = await this.statusModeRepository.find();

    const backupData: BackupData = {
      timestamp: new Date().toISOString(),
      roles,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        password: u.password,
        gender: u.gender,
        roleId: u.roleId,
        role: u.role,
        statusModeId: u.statusModeId,
        statusMode: u.statusMode,
        permissions: u.permissions,
        protection: u.protection,
        protectedByStarCount: u.protectedByStarCount,
        micBanned: u.micBanned,
        micBannedByStarCount: u.micBannedByStarCount,
        cameraBanned: u.cameraBanned,
        cameraBannedByStarCount: u.cameraBannedByStarCount,
        globalMuted: u.globalMuted,
        globalMutedByStarCount: u.globalMutedByStarCount,
        frame: u.frame,
        icon: u.icon,
        fontName: u.fontName,
        granite: u.granite,
        nickColor: u.nickColor,
        userGif: u.userGif,
        flashNick: u.flashNick,
        joinEffect: u.joinEffect,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        lastLoginAt: u.lastLoginAt,
        isGuest: u.isGuest,
        guestExpiresAt: u.guestExpiresAt,
        membershipExpiresAt: u.membershipExpiresAt,
        chatPreferences: u.chatPreferences,
      })),
      bots,
      systemSettings: systemSettings
        ? {
            id: systemSettings.id,
            everyoneCanEnter: systemSettings.everyoneCanEnter,
            desktopLoginEnabled: systemSettings.desktopLoginEnabled,
            mobileLoginEnabled: systemSettings.mobileLoginEnabled,
            guestLoginEnabled: systemSettings.guestLoginEnabled,
            newRegistrationEnabled: systemSettings.newRegistrationEnabled,
            guestCanWrite: systemSettings.guestCanWrite,
            staffCanChangeNickname: systemSettings.staffCanChangeNickname,
            friendsPrivateMessageMembersOnly: systemSettings.friendsPrivateMessageMembersOnly,
            membersPrivateMessageEnabled: systemSettings.membersPrivateMessageEnabled,
            membersVoiceCallEnabled: systemSettings.membersVoiceCallEnabled,
            guestPrivateMessageEnabled: systemSettings.guestPrivateMessageEnabled,
            guestVoiceCallEnabled: systemSettings.guestVoiceCallEnabled,
            firstMessageDelayEnabled: systemSettings.firstMessageDelayEnabled,
            firstMessageDelaySeconds: systemSettings.firstMessageDelaySeconds,
            guestWaitSeconds: systemSettings.guestWaitSeconds,
            memberAndGuestMicDurationSeconds: systemSettings.memberAndGuestMicDurationSeconds,
            siteLanguage: systemSettings.siteLanguage,
            chatImageSendPermission: systemSettings.chatImageSendPermission,
            chatVoiceSendPermission: systemSettings.chatVoiceSendPermission,
            chatVoiceRecordSendPermission: systemSettings.chatVoiceRecordSendPermission,
            chatYoutubeSendPermission: systemSettings.chatYoutubeSendPermission,
            siteName: systemSettings.siteName,
            siteTitle: systemSettings.siteTitle,
            siteDescription: systemSettings.siteDescription,
            homePageHtml: systemSettings.homePageHtml,
            welcomeMessageTemplate: systemSettings.welcomeMessageTemplate,
            activeLoginDesign: systemSettings.activeLoginDesign,
            maxUserCount: systemSettings.maxUserCount,
            maintenanceMode: systemSettings.maintenanceMode,
            showMicrophonesOnMobile: systemSettings.showMicrophonesOnMobile,
            homePageImage: systemSettings.homePageImage,
            homePageLogo: systemSettings.homePageLogo,
          }
        : null,
      statusModes,
    };

    const now = new Date();
    const timestamp = now.toISOString().replace(':', '-').replace(':', '-');
    const filename = `${timestamp}.json`;
    const filepath = path.join(this.getBackupDir(tenant), filename);

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

    this.logger.log(`Backup created: ${filepath}`);

    return {
      success: true,
      filename,
      timestamp: backupData.timestamp,
    };
  }

  async listBackups(tenant: string): Promise<BackupFileInfo[]> {
    const dir = this.getBackupDir(tenant);
    const files: BackupFileInfo[] = [];

    if (fs.existsSync(dir)) {
      const fileList = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      
      for (const filename of fileList) {
        const filepath = path.join(dir, filename);
        const stats = fs.statSync(filepath);
        const timestamp = filename.replace('.json', '').replace('-', ':').replace('-', ':');
        
        files.push({
          id: filename.replace('.json', ''),
          filename,
          timestamp,
          path: filepath,
          size: stats.size,
        });
      }
    }

    return files.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async getBackupById(tenant: string, id: string): Promise<BackupData | null> {
    const dir = this.getBackupDir(tenant);
    const filepath = path.join(dir, `${id}.json`);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  }

  async restoreBackup(
    tenant: string,
    backupId: string,
  ): Promise<{ success: boolean; message: string; restoredCounts: RestoreCounts }> {
    this.logger.log(`Restoring backup ${backupId} for tenant: ${tenant}`);

    const backupData = await this.getBackupById(tenant, backupId);
    if (!backupData) {
      throw new NotFoundException(`Backup not found: ${backupId}`);
    }

    const restoredCounts: RestoreCounts = {
      roles: 0,
      users: 0,
      bots: 0,
      settings: false,
    };
    const existingUsers = await this.userRepository.find({ withDeleted: true });
    const existingUsersById = new Map<number, User>();
    const existingUsersByUsername = new Map<string, User>();

    for (const user of existingUsers) {
      existingUsersById.set(user.id, user);
      const normalizedUsername = this.normalizeUsername(user.username);
      if (normalizedUsername) {
        existingUsersByUsername.set(normalizedUsername, user);
      }
    }

    this.roomsGateway.emitSystemResetStarted({
      countdownSeconds: 10,
      message: 'Sistem geri yükleniyor',
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    await this.userRepository.manager.transaction(async (manager) => {
      const roleRepository = manager.getRepository(Role);
      const userRepository = manager.getRepository(User);
      const botRepository = manager.getRepository(Bot);
      const systemSettingsRepository = manager.getRepository(SystemSettings);
      const statusModeRepository = manager.getRepository(StatusMode);
      const messageRepository = manager.getRepository(Message);

      await this.createDeleteBuilder(userRepository, User).execute();
      await this.createDeleteBuilder(botRepository, Bot).execute();
      await this.createDeleteBuilder(roleRepository, Role).execute();
      await this.createDeleteBuilder(statusModeRepository, StatusMode).execute();

      let restoredRoleIdMap = new Map<number, number>();
      if (backupData.roles && backupData.roles.length > 0) {
        const roleEntities = backupData.roles.map((r) =>
          roleRepository.create({
            id: r.id as number,
            name: r.name,
            microphoneDuration: r.microphoneDuration,
            starColor: r.starColor,
            starCount: r.starCount,
            icon: r.icon ?? null,
            permissions: r.permissions,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          }),
        );
        const savedRoles = await roleRepository.save(roleEntities);
        restoredRoleIdMap = this.mapSavedIds(backupData.roles, savedRoles);
        await this.resetPrimaryKeySequence(roleRepository);
        restoredCounts.roles = savedRoles.length;
      }

      let restoredStatusModeIdMap = new Map<number, number>();
      if (backupData.statusModes && backupData.statusModes.length > 0) {
        const statusModeEntities = backupData.statusModes.map((s) =>
          statusModeRepository.create({
            id: s.id as number,
            name: s.name,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          }),
        );
        const savedStatusModes = await statusModeRepository.save(statusModeEntities);
        restoredStatusModeIdMap = this.mapSavedIds(
          backupData.statusModes,
          savedStatusModes,
        );
        await this.resetPrimaryKeySequence(statusModeRepository);
      }

      if (backupData.bots && backupData.bots.length > 0) {
        const botEntities = backupData.bots.map((b) =>
          botRepository.create({
            id: b.id,
            username: b.username,
            gender: b.gender,
            role: b.role,
            avatar: b.avatar,
            status: b.status,
            room: b.room,
            userGif: b.userGif,
            statusMode: b.statusMode,
            loginType: b.loginType,
            messagePermission: b.messagePermission,
            welcomeMessage: b.welcomeMessage,
            welcomeAutoSendEnabled: b.welcomeAutoSendEnabled,
            welcomeManualPromptEnabled: b.welcomeManualPromptEnabled,
            isAI: b.isAI,
            extraInfo: b.extraInfo,
            fontName: b.fontName,
            granite: b.granite,
            roomMuted: b.roomMuted,
            roomMutedRoomKey: b.roomMutedRoomKey,
            globalMuted: b.globalMuted,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
          }),
        );
        await botRepository.save(botEntities);
        restoredCounts.bots = botEntities.length;
      }

      if (backupData.systemSettings) {
        const settings = await systemSettingsRepository.findOne({
          where: { id: 1 },
        });
        if (settings) {
          await systemSettingsRepository.update(1, backupData.systemSettings);
        } else {
          await systemSettingsRepository.save({
            ...backupData.systemSettings,
            id: 1,
          });
        }
        restoredCounts.settings = true;
      }

      if (backupData.users && backupData.users.length > 0) {
        let skippedUsers = 0;
        const userEntities = backupData.users.flatMap((u) => {
          const password = this.getExistingPassword(
            u,
            existingUsersById,
            existingUsersByUsername,
          );
          if (!password) {
            skippedUsers += 1;
            return [];
          }

          return [
            userRepository.create({
              id: u.id,
              username: u.username,
              password,
              gender: u.gender,
              roleId: this.resolveMappedId(restoredRoleIdMap, u.roleId),
              statusModeId: this.resolveMappedId(
                restoredStatusModeIdMap,
                u.statusModeId,
              ),
              permissions: u.permissions || [],
              protection: u.protection || false,
              protectedByStarCount: u.protectedByStarCount || 0,
              micBanned: u.micBanned || false,
              micBannedByStarCount: u.micBannedByStarCount || 0,
              cameraBanned: u.cameraBanned || false,
              cameraBannedByStarCount: u.cameraBannedByStarCount || 0,
              globalMuted: u.globalMuted || false,
              globalMutedByStarCount: u.globalMutedByStarCount || 0,
              frame: u.frame,
              icon: u.icon,
              fontName: u.fontName,
              granite: u.granite,
              nickColor: u.nickColor,
              userGif: u.userGif,
              flashNick: u.flashNick,
              joinEffect: u.joinEffect,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
              lastLoginAt: u.lastLoginAt,
              isGuest: u.isGuest || false,
              guestExpiresAt: u.guestExpiresAt,
              membershipExpiresAt: u.membershipExpiresAt,
              chatPreferences: u.chatPreferences || {
                bgColor: '#1a1a2e',
                textColor: '#eee',
                fontSize: 14,
              },
            }),
          ];
        });

        if (userEntities.length > 0) {
          await userRepository.save(userEntities);
        }
        if (skippedUsers > 0) {
          this.logger.warn(
            `${skippedUsers} user(s) skipped because no password hash was available in backup or current database.`,
          );
        }
        restoredCounts.users = userEntities.length;
      }

      await messageRepository.softDelete({ deletedAt: IsNull() as any });
      this.logger.log('All messages deleted');
    });

    this.logger.log(`Backup restored successfully:`, restoredCounts);

    return {
      success: true,
      message: 'Sistem geri yüklendi.',
      restoredCounts,
    };
  }

  async cleanupOldBackups(tenant: string, keepDays: number = 2): Promise<{ deletedCount: number; message: string }> {
    const dir = this.getBackupDir(tenant);
    const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    if (fs.existsSync(dir)) {
      const fileList = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      
      for (const filename of fileList) {
        const filepath = path.join(dir, filename);
        const stats = fs.statSync(filepath);
        
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filepath);
          deletedCount++;
          this.logger.log(`Deleted old backup: ${filename}`);
        }
      }
    }

    return {
      deletedCount,
      message: `${deletedCount} eski backup silindi.`,
    };
  }
}
