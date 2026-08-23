import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { LoginHistory } from './entities/login-history.entity';
import { Gender } from '../common/enums/gender.enum';
import { UserService } from '../user/user.service';
import { IpLookupService } from './ip-lookup.service';
import { LoginLocationResponseDto } from './dto/login-location-response.dto';
import {
  LoginIdentitiesResponseDto,
  LoginIpIdentityDto,
} from './dto/login-identities-response.dto';

@Injectable()
export class LoginHistoryService {
  constructor(
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
    private readonly userService: UserService,
    private readonly ipLookupService: IpLookupService,
  ) {}

  async saveLoginHistory(params: {
    userId?: number | null;
    username: string;
    agentNickname?: string | null;
    role?: string | null;
    starCount?: number | null;
    ipAddress?: string | null;
    browser?: string | null;
    device?: string | null;
    gender?: Gender | null;
  }): Promise<LoginHistory> {
    const {
      userId = null,
      username,
      agentNickname = null,
      role = null,
      starCount = null,
      ipAddress = null,
      browser = null,
      device = null,
      gender = null,
    } = params;

    const loginHistory = this.loginHistoryRepository.create({
      userId,
      username,
      agentNickname,
      role,
      starCount,
      loginDate: new Date(),
      ipAddress,
      browser,
      device,
      gender,
    } as DeepPartial<LoginHistory>);

    const savedLoginHistory =
      await this.loginHistoryRepository.save(loginHistory);
    void this.persistLocationSnapshot(savedLoginHistory);
    return savedLoginHistory;
  }

  async findAll(): Promise<LoginHistory[]> {
    return await this.loginHistoryRepository.find({
      relations: ['user'],
      order: {
        loginDate: 'DESC',
      },
    });
  }

  async findAllPaginated(
    page = 1,
    limit = 20,
    requesterStarCount = 0,
    includeIpAddress = true,
  ): Promise<{
    items: LoginHistory[];
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  }> {
    const safePage = page < 1 ? 1 : page;
    const safeLimit = limit < 1 ? 1 : Math.min(limit, 100);
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.loginHistoryRepository
      .createQueryBuilder('lh')
      .leftJoinAndSelect('lh.user', 'user')
      // Kural: Kendinden düşük/eşit rütbelileri veya Ajan nikiyle giren yüksek rütbelileri görebilir.
      .where(
        '(lh.starCount IS NULL OR lh.starCount <= :requesterStarCount OR (lh.agentNickname IS NOT NULL AND lh.agentNickname <> \'\'))',
        { requesterStarCount },
      )
      .orderBy('lh.loginDate', 'DESC')
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();

    const normalizedItems = items.map((item) => {
      const itemStarCount = item.starCount ?? 0;
      // Safe trim check
      const agentNick = typeof item.agentNickname === 'string' ? item.agentNickname.trim() : null;
      const isAgent = !!agentNick;
      
      const canViewDetails = requesterStarCount >= itemStarCount;

      let finalUsername = item.username || 'Bilinmiyor';
      let finalRole = item.role || '-';
      let finalUserId = item.userId;
      let finalUser = item.user;

      // Listedeki herkes için Ajanları "Misafir" olarak göster
      if (isAgent) {
        finalUsername = 'Misafir';
        finalRole = 'Misafir';
        finalUserId = null;
        finalUser = null;
      }

      return {
        ...item,
        username: finalUsername,
        role: finalRole,
        userId: finalUserId,
        user: finalUser,
        canViewDetails,
        // Sadece yetkisi yetenlere gerçek bilgileri gizli alanlarda gönder
        realUsername: canViewDetails ? (item.username || 'Bilinmiyor') : 'Misafir',
        realRole: canViewDetails ? (item.role || '-') : 'Misafir',
        ipAddress: includeIpAddress ? item.ipAddress : 'Gizli',
      };
    });

    return {
      items: normalizedItems as any[],
      total,
      page: safePage,
      limit: safeLimit,
      pageCount: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async findByUserId(userId: number): Promise<LoginHistory[]> {
    return await this.loginHistoryRepository.find({
      where: { userId },
      relations: ['user'],
      order: {
        loginDate: 'DESC',
      },
    });
  }

  async findById(recordId: number): Promise<LoginHistory | null> {
    return this.loginHistoryRepository.findOne({
      where: { id: recordId },
      relations: ['user'],
    });
  }

  async findLatestByUsername(username: string): Promise<LoginHistory | null> {
    const normalizedUsername = String(username ?? '').trim();
    if (!normalizedUsername) {
      return null;
    }

    return this.loginHistoryRepository
      .createQueryBuilder('lh')
      .leftJoinAndSelect('lh.user', 'user')
      .where('LOWER(lh.username) = LOWER(:username)', {
        username: normalizedUsername,
      })
      .orderBy('lh.loginDate', 'DESC')
      .getOne();
  }

  async getLocationByRecordId(
    recordId: number,
    requesterUserId: number,
  ): Promise<LoginLocationResponseDto> {
    const record = await this.getAccessibleRecord(recordId, requesterUserId);
    const storedLocation = this.getStoredLocation(record);
    if (storedLocation) {
      return {
        loginHistoryId: record.id,
        displayName: this.getDisplayName(record),
        ipAddress: record.ipAddress || 'Bilinmiyor',
        city: storedLocation.city,
        district: storedLocation.district,
        country: storedLocation.country,
        countryCode: storedLocation.countryCode,
        isp: storedLocation.isp,
      };
    }

    const ipData = await this.ipLookupService.lookup(record.ipAddress);
    await this.saveLocationSnapshot(record, ipData);

    return {
      loginHistoryId: record.id,
      displayName: this.getDisplayName(record),
      ipAddress: ipData.ipAddress,
      city: ipData.city || 'Bilinmiyor',
      district: ipData.district || 'Bilinmiyor',
      country: ipData.country || 'Bilinmiyor',
      countryCode: ipData.countryCode || 'Bilinmiyor',
      isp: ipData.isp || 'Bilinmiyor',
    };
  }

  async getIdentitiesByRecordId(
    recordId: number,
    requesterUserId: number,
  ): Promise<LoginIdentitiesResponseDto> {
    const record = await this.getAccessibleRecord(recordId, requesterUserId);
    const ipAddress = (record.ipAddress || '').trim();

    if (!ipAddress) {
      return {
        loginHistoryId: record.id,
        ipAddress: 'Bilinmiyor',
        identities: [],
      };
    }

    const records = await this.loginHistoryRepository.find({
      where: { ipAddress },
      order: { loginDate: 'DESC' },
    });

    const deduped = new Map<string, LoginIpIdentityDto>();
    for (const item of records) {
      const identityKey = this.buildIdentityKey(item);
      if (!identityKey || deduped.has(identityKey)) {
        continue;
      }

      deduped.set(identityKey, {
        displayName: this.getDisplayName(item),
        username: item.username,
        agentNickname: item.agentNickname?.trim() || null,
        isGuest: (item.role || '').trim().toLowerCase() === 'guest',
        role: item.role?.trim() || null,
        lastLoginDate: item.loginDate.toISOString(),
      });
    }

    return {
      loginHistoryId: record.id,
      ipAddress,
      identities: Array.from(deduped.values()),
    };
  }

  private async getAccessibleRecord(
    recordId: number,
    requesterUserId: number,
  ): Promise<LoginHistory> {
    const [requester, record] = await Promise.all([
      this.userService.findById(requesterUserId),
      this.loginHistoryRepository.findOne({ where: { id: recordId } }),
    ]);

    if (!record) {
      throw new NotFoundException('Giriş kaydı bulunamadı');
    }

    if (!requester || requester.isGuest) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }

    const requesterStarCount = requester.role?.starCount ?? 0;
    const targetStarCount = record.starCount ?? 0;

    if (requesterStarCount < targetStarCount) {
      throw new ForbiddenException('Bu kullanıcı için yetkiniz yok');
    }

    return record;
  }

  private getDisplayName(record: LoginHistory): string {
    return record.agentNickname?.trim() || record.username;
  }

  private getStoredLocation(record: LoginHistory): {
    city: string;
    district: string;
    country: string;
    countryCode: string;
    isp: string;
  } | null {
    const city = record.locationCity?.trim();
    const district = record.locationDistrict?.trim();
    const country = record.locationCountry?.trim();
    const countryCode = record.locationCountryCode?.trim();
    const isp = record.locationIsp?.trim();

    if (!city && !district && !country && !countryCode && !isp) {
      return null;
    }

    return {
      city: city || 'Bilinmiyor',
      district: district || 'Bilinmiyor',
      country: country || 'Bilinmiyor',
      countryCode: countryCode || 'Bilinmiyor',
      isp: isp || 'Bilinmiyor',
    };
  }

  private async persistLocationSnapshot(record: LoginHistory): Promise<void> {
    try {
      const ipData = await this.ipLookupService.lookup(record.ipAddress);
      await this.saveLocationSnapshot(record, ipData);
    } catch {
      // Login history creation must not fail when the external IP lookup fails.
    }
  }

  private async saveLocationSnapshot(
    record: LoginHistory,
    ipData: {
      city: string | null;
      district: string | null;
      country: string | null;
      countryCode: string | null;
      isp: string | null;
    },
  ): Promise<void> {
    await this.loginHistoryRepository.update(record.id, {
      locationCity: this.cleanLocationValue(ipData.city),
      locationDistrict: this.cleanLocationValue(ipData.district),
      locationCountry: this.cleanLocationValue(ipData.country),
      locationCountryCode: this.cleanLocationValue(ipData.countryCode),
      locationIsp: this.cleanLocationValue(ipData.isp),
    });
  }

  private cleanLocationValue(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.toLocaleLowerCase('tr-TR') === 'bilinmiyor') {
      return null;
    }
    return normalized;
  }

  private buildIdentityKey(record: LoginHistory): string | null {
    const key = record.agentNickname?.trim() || record.username?.trim();
    return key ? key.toLocaleLowerCase('tr-TR') : null;
  }
}
