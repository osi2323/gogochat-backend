import { IpLookupService } from './ip-lookup.service';

describe('IpLookupService', () => {
  const createRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  });

  const originalFetch = global.fetch;

  afterEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = originalFetch;
  });

  it('should return cached value without calling provider', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({
      ipAddress: '1.2.3.4',
      city: 'Adana',
      district: 'Seyhan',
      country: 'Turkiye',
      countryCode: 'TR',
      isp: 'Superonline',
      regionName: 'Adana',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const service = new IpLookupService(repository as any);
    (global as any).fetch = jest.fn();

    const result = await service.lookup('1.2.3.4');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.city).toBe('Adana');
    expect(result.district).toBe('Seyhan');
  });

  it('should fetch provider data and cache on cache miss', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue(null);
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'success',
        country: 'Turkiye',
        countryCode: 'TR',
        regionName: 'Adana',
        city: 'Adana',
        district: 'Seyhan',
        isp: 'Superonline',
      }),
    } as any);

    const service = new IpLookupService(repository as any);
    const result = await service.lookup('2.3.4.5');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.country).toBe('Turkiye');
    expect(result.isp).toBe('Superonline');
  });

  it('should fall back to cached data when provider fails after cache expiry', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({
      ipAddress: '8.8.8.8',
      city: 'Cached City',
      district: null,
      country: 'Cached Country',
      countryCode: 'CC',
      isp: 'Cached ISP',
      regionName: 'Cached Region',
      expiresAt: new Date(Date.now() - 60_000),
    });
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network'));

    const service = new IpLookupService(repository as any);
    const result = await service.lookup('8.8.8.8');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.ipAddress).toBe('8.8.8.8');
    expect(result.country).toBe('Cached Country');
  });
});
