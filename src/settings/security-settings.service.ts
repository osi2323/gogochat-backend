import { BadRequestException, Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { SecuritySettings } from './entities/security-settings.entity';
import { FloodBan } from './entities/flood-ban.entity';
import { SecuritySettingsResponseDto } from './dto/security-settings-response.dto';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { RoomsGateway } from '../rooms/rooms.gateway';
import {
  FloodBanListItemDto,
  FloodBanListResponseDto,
} from './dto/flood-ban-response.dto';

@Injectable()
export class SecuritySettingsService {
  constructor(
    @InjectRepository(SecuritySettings)
    private readonly securitySettingsRepository: Repository<SecuritySettings>,
    @InjectRepository(FloodBan)
    private readonly floodBanRepository: Repository<FloodBan>,
    @Inject(forwardRef(() => RoomsGateway))
    private readonly roomsGateway: RoomsGateway,
  ) {}

  async getSettings(): Promise<SecuritySettingsResponseDto> {
    const settings = await this.getOrCreate();
    return this.toResponse(settings);
  }

  async updateSettings(
    dto: UpdateSecuritySettingsDto,
  ): Promise<SecuritySettingsResponseDto> {
    const settings = await this.getOrCreate();

    const { id: _ignoreId, ...rest } = dto;
    Object.assign(settings, rest);

    // ensure array defaults
    if (!settings.blockedCountries) {
      settings.blockedCountries = [];
    }

    const saved = await this.securitySettingsRepository.save(settings);
    this.roomsGateway.emitTenantSettingsUpdated({ scope: 'security' });
    return this.toResponse(saved);
  }

  async getActiveFloodBans(): Promise<FloodBanListResponseDto> {
    const now = new Date();
    const items = await this.floodBanRepository.find({
      where: [
        {
          clearedAt: IsNull(),
          expiresAt: IsNull(),
        },
        {
          clearedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
      ],
      order: { createdAt: 'DESC' },
    });

    return {
      items: items.map((item) => this.toFloodBanItem(item)),
      total: items.length,
    };
  }

  async clearAllFloodBans(): Promise<{ clearedCount: number }> {
    const now = new Date();
    const active = await this.getActiveFloodBanEntities();
    if (active.length === 0) {
      return { clearedCount: 0 };
    }

    for (const item of active) {
      item.clearedAt = now;
    }

    await this.floodBanRepository.save(active);
    return { clearedCount: active.length };
  }

  async clearFloodBanById(banId: number): Promise<FloodBan> {
    const now = new Date();
    const active = await this.floodBanRepository.findOne({
      where: [
        {
          id: banId,
          clearedAt: IsNull(),
          expiresAt: IsNull(),
        },
        {
          id: banId,
          clearedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
      ],
    });

    if (!active) {
      throw new BadRequestException('IP ban kaydı bulunamadı');
    }

    active.clearedAt = now;
    return this.floodBanRepository.save(active);
  }

  async hasActiveFloodBan(ipAddress: string): Promise<boolean> {
    const normalizedIp = this.normalizeIp(ipAddress);
    if (!normalizedIp || normalizedIp === 'unknown') {
      return false;
    }

    const now = new Date();
    const found = await this.floodBanRepository.findOne({
      where: [
        {
          ipAddress: normalizedIp,
          clearedAt: IsNull(),
          expiresAt: IsNull(),
        },
        {
          ipAddress: normalizedIp,
          clearedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
      ],
      order: { createdAt: 'DESC' },
    });

    return Boolean(found);
  }

  async createOrRefreshFloodBan(params: {
    ipAddress: string;
    reason?: string;
    source?: string;
    durationHours?: number | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<FloodBan> {
    const normalizedIp = this.normalizeIp(params.ipAddress);
    const now = new Date();
    const expiresAt =
      params.durationHours === null
        ? null
        : new Date(
            now.getTime() + (params.durationHours ?? 24) * 60 * 60 * 1000,
          );

    let floodBan = await this.floodBanRepository.findOne({
      where: { ipAddress: normalizedIp },
      order: { createdAt: 'DESC' },
    });

    if (!floodBan) {
      floodBan = this.floodBanRepository.create({
        ipAddress: normalizedIp,
        reason: params.reason ?? 'Sunucu flood koruması',
        source: params.source ?? 'server_flood',
        expiresAt,
        clearedAt: null,
        metadata: params.metadata ?? null,
      });
    } else {
      floodBan.reason = params.reason ?? floodBan.reason;
      floodBan.source = params.source ?? floodBan.source;
      floodBan.expiresAt = expiresAt;
      floodBan.clearedAt = null;
      floodBan.metadata = params.metadata ?? floodBan.metadata ?? null;
    }

    return this.floodBanRepository.save(floodBan);
  }

  private async getOrCreate(): Promise<SecuritySettings> {
    let settings = await this.securitySettingsRepository.findOne({
      where: { id: 1 },
    });

    if (!settings) {
      settings = this.securitySettingsRepository.create({
        id: 1,
      });
      settings = await this.securitySettingsRepository.save(settings);
    }

    return settings;
  }

  private toResponse(settings: SecuritySettings): SecuritySettingsResponseDto {
    return {
      id: settings.id,
      membersMicrophoneDisabled: settings.membersMicrophoneDisabled,
      fakeIpLoginEnabled: settings.fakeIpLoginEnabled,
      deviceAndLocationBanEnabled: settings.deviceAndLocationBanEnabled,
      guestSystemEnabled: settings.guestSystemEnabled,
      guestEntriesEnabled: settings.guestEntriesEnabled,
      guestsWritingDisabled: settings.guestsWritingDisabled,
      guestsMicrophoneDisabled: settings.guestsMicrophoneDisabled,
      countryBlockEnabled: settings.countryBlockEnabled,
      blockedCountries: settings.blockedCountries ?? [],
      vpnBlockEnabled: settings.vpnBlockEnabled,
    };
  }

  private async getActiveFloodBanEntities(): Promise<FloodBan[]> {
    const now = new Date();
    return this.floodBanRepository.find({
      where: [
        {
          clearedAt: IsNull(),
          expiresAt: IsNull(),
        },
        {
          clearedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
      ],
    });
  }

  private toFloodBanItem(item: FloodBan): FloodBanListItemDto {
    return {
      id: item.id,
      ipAddress: item.ipAddress,
      reason: item.reason,
      source: item.source,
      expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
      createdAt: item.createdAt ? item.createdAt.toISOString() : null,
      metadata: item.metadata ?? null,
    };
  }

  private normalizeIp(ipAddress: string): string {
    return String(ipAddress ?? '').trim();
  }
}
