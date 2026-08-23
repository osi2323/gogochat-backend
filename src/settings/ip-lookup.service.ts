import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as geoip from 'geoip-lite';
import { Repository } from 'typeorm';
import { IpLookupCache } from './entities/ip-lookup-cache.entity';

type IpLookupResult = {
  ipAddress: string;
  city: string | null;
  district: string | null;
  country: string | null;
  countryCode: string | null;
  isp: string | null;
  regionName: string | null;
  isProxy: boolean | null;
  isHosting: boolean | null;
};

type ProviderResponse = {
  status?: string;
  country?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
  district?: string;
  isp?: string;
  query?: string;
  proxy?: boolean;
  hosting?: boolean;
};

const UNKNOWN_LABEL = 'Bilinmiyor';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class IpLookupService {
  private readonly logger = new Logger(IpLookupService.name);

  constructor(
    @InjectRepository(IpLookupCache)
    private readonly ipLookupCacheRepository: Repository<IpLookupCache>,
  ) {}

  async lookup(ipAddress: string | null | undefined): Promise<IpLookupResult> {
    const normalizedIp = (ipAddress || '').trim();
    if (!normalizedIp) {
      return this.normalizeResult({
        ipAddress: UNKNOWN_LABEL,
        city: null,
        district: null,
        country: null,
        countryCode: null,
        isp: null,
        regionName: null,
        isProxy: null,
        isHosting: null,
      });
    }

    const cached = await this.ipLookupCacheRepository.findOne({
      where: { ipAddress: normalizedIp },
    });
    const cacheHasVpnData = cached && (cached.isProxy !== null || cached.isHosting !== null);
    if (cached && cacheHasVpnData && cached.expiresAt.getTime() > Date.now()) {
      return this.normalizeResult({
        ipAddress: normalizedIp,
        city: cached.city,
        district: cached.district,
        country: cached.country,
        countryCode: cached.countryCode,
        isp: cached.isp,
        regionName: cached.regionName,
        isProxy: cached.isProxy ?? null,
        isHosting: cached.isHosting ?? null,
      });
    }

    if (this.isPrivateOrLocalIp(normalizedIp)) {
      return this.normalizeResult(this.createGeoFallback(normalizedIp));
    }

    try {
      const providerResult = await this.fetchProviderData(normalizedIp);
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

      const entity = this.ipLookupCacheRepository.create({
        ...(cached ?? {}),
        ipAddress: normalizedIp,
        countryCode: providerResult.countryCode,
        country: providerResult.country,
        regionName: providerResult.regionName,
        city: providerResult.city,
        district: providerResult.district,
        isp: providerResult.isp,
        isProxy: providerResult.isProxy,
        isHosting: providerResult.isHosting,
        rawResponse: providerResult.rawResponse,
        fetchedAt: new Date(),
        expiresAt,
      });

      await this.ipLookupCacheRepository.save(entity);

      return this.normalizeResult({
        ipAddress: normalizedIp,
        city: providerResult.city,
        district: providerResult.district,
        country: providerResult.country,
        countryCode: providerResult.countryCode,
        isp: providerResult.isp,
        regionName: providerResult.regionName,
        isProxy: providerResult.isProxy,
        isHosting: providerResult.isHosting,
      });
    } catch (error) {
      this.logger.warn(
        `IP lookup failed for ${normalizedIp}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );

      if (cached) {
        return this.normalizeResult({
          ipAddress: normalizedIp,
          city: cached.city,
          district: cached.district,
          country: cached.country,
          countryCode: cached.countryCode,
          isp: cached.isp,
          regionName: cached.regionName,
          isProxy: cached.isProxy ?? null,
          isHosting: cached.isHosting ?? null,
        });
      }

      return this.normalizeResult(this.createGeoFallback(normalizedIp));
    }
  }

  private async fetchProviderData(ipAddress: string): Promise<{
    city: string | null;
    district: string | null;
    country: string | null;
    countryCode: string | null;
    isp: string | null;
    regionName: string | null;
    isProxy: boolean | null;
    isHosting: boolean | null;
    rawResponse: Record<string, unknown>;
  }> {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,message,country,countryCode,regionName,city,district,isp,proxy,hosting,query`,
    );

    if (!response.ok) {
      throw new Error(`provider_http_${response.status}`);
    }

    const data = (await response.json()) as ProviderResponse & Record<string, unknown>;
    if (data.status !== 'success') {
      throw new Error(String(data.message || 'provider_lookup_failed'));
    }

    return {
      city: this.cleanValue(data.city),
      district: this.cleanValue(data.district),
      country: this.cleanValue(data.country),
      countryCode: this.cleanValue(data.countryCode),
      isp: this.cleanValue(data.isp),
      regionName: this.cleanValue(data.regionName),
      isProxy: typeof data.proxy === 'boolean' ? data.proxy : null,
      isHosting: typeof data.hosting === 'boolean' ? data.hosting : null,
      rawResponse: data,
    };
  }

  private createGeoFallback(ipAddress: string): IpLookupResult {
    const geo = geoip.lookup(ipAddress);
    return {
      ipAddress,
      city: geo?.city || null,
      district: null,
      country: geo?.country || null,
      countryCode: geo?.country || null,
      isp: null,
      regionName: geo?.region || null,
      isProxy: null,
      isHosting: null,
    };
  }

  private normalizeResult(result: IpLookupResult): IpLookupResult {
    return {
      ipAddress: this.cleanValue(result.ipAddress) || UNKNOWN_LABEL,
      city: this.cleanValue(result.city) || UNKNOWN_LABEL,
      district: this.cleanValue(result.district) || UNKNOWN_LABEL,
      country: this.cleanValue(result.country) || UNKNOWN_LABEL,
      countryCode: this.cleanValue(result.countryCode) || UNKNOWN_LABEL,
      isp: this.cleanValue(result.isp) || UNKNOWN_LABEL,
      regionName: this.cleanValue(result.regionName) || UNKNOWN_LABEL,
      isProxy: result.isProxy ?? null,
      isHosting: result.isHosting ?? null,
    };
  }

  private cleanValue(value: string | null | undefined): string | null {
    const normalized = (value || '').trim();
    return normalized ? normalized : null;
  }

  private isPrivateOrLocalIp(ipAddress: string): boolean {
    const normalizedIp = ipAddress.trim().toLowerCase();
    return (
      normalizedIp === 'unknown' ||
      normalizedIp === '::1' ||
      normalizedIp === '127.0.0.1' ||
      normalizedIp.startsWith('10.') ||
      normalizedIp.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedIp) ||
      normalizedIp.startsWith('fd') ||
      normalizedIp.startsWith('fc')
    );
  }
}
