import { ForbiddenException } from '@nestjs/common';
import { LoginHistoryService } from './login-history.service';

describe('LoginHistoryService', () => {
  const createRepository = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const createUserService = () => ({
    findById: jest.fn(),
  });

  const createIpLookupService = () => ({
    lookup: jest.fn(),
  });

  it('should return location info for accessible record', async () => {
    const repository = createRepository();
    const userService = createUserService();
    const ipLookupService = createIpLookupService();

    repository.findOne.mockResolvedValueOnce({
      id: 10,
      username: 'kaanx',
      agentNickname: null,
      starCount: 0,
      ipAddress: '1.2.3.4',
    });
    userService.findById.mockResolvedValue({
      id: 1,
      isGuest: false,
      role: { starCount: 2 },
    });
    ipLookupService.lookup.mockResolvedValue({
      ipAddress: '1.2.3.4',
      city: 'Adana',
      district: 'Seyhan',
      country: 'Turkiye',
      countryCode: 'TR',
      isp: 'Superonline',
      regionName: 'Adana',
    });

    const service = new LoginHistoryService(
      repository as any,
      userService as any,
      ipLookupService as any,
    );

    const result = await service.getLocationByRecordId(10, 1);

    expect(result.ipAddress).toBe('1.2.3.4');
    expect(result.city).toBe('Adana');
    expect(result.countryCode).toBe('TR');
    expect(repository.update).toHaveBeenCalledWith(10, {
      locationCity: 'Adana',
      locationDistrict: 'Seyhan',
      locationCountry: 'Turkiye',
      locationCountryCode: 'TR',
      locationIsp: 'Superonline',
    });
  });

  it('should return stored location snapshot without lookup', async () => {
    const repository = createRepository();
    const userService = createUserService();
    const ipLookupService = createIpLookupService();

    repository.findOne.mockResolvedValueOnce({
      id: 11,
      username: 'kaanx',
      agentNickname: null,
      starCount: 0,
      ipAddress: '1.2.3.4',
      locationCity: 'Istanbul',
      locationDistrict: 'Kadikoy',
      locationCountry: 'Turkiye',
      locationCountryCode: 'TR',
      locationIsp: 'Turk Telekom',
    });
    userService.findById.mockResolvedValue({
      id: 1,
      isGuest: false,
      role: { starCount: 2 },
    });

    const service = new LoginHistoryService(
      repository as any,
      userService as any,
      ipLookupService as any,
    );

    const result = await service.getLocationByRecordId(11, 1);

    expect(result).toEqual(
      expect.objectContaining({
        loginHistoryId: 11,
        city: 'Istanbul',
        district: 'Kadikoy',
        country: 'Turkiye',
        countryCode: 'TR',
        isp: 'Turk Telekom',
      }),
    );
    expect(ipLookupService.lookup).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should reject when requester star count is not higher', async () => {
    const repository = createRepository();
    const userService = createUserService();
    const ipLookupService = createIpLookupService();

    repository.findOne.mockResolvedValue({
      id: 12,
      username: 'admin',
      starCount: 2,
      ipAddress: '1.2.3.4',
    });
    userService.findById.mockResolvedValue({
      id: 3,
      isGuest: false,
      role: { starCount: 1 },
    });

    const service = new LoginHistoryService(
      repository as any,
      userService as any,
      ipLookupService as any,
    );

    await expect(service.getLocationByRecordId(12, 3)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('should dedupe identities by agent nickname or username and include guests', async () => {
    const repository = createRepository();
    const userService = createUserService();
    const ipLookupService = createIpLookupService();

    repository.findOne.mockResolvedValue({
      id: 8,
      username: 'hedef',
      starCount: 0,
      ipAddress: '5.6.7.8',
    });
    repository.find.mockResolvedValue([
      {
        username: 'memberA',
        agentNickname: null,
        role: 'User',
        loginDate: new Date('2026-03-01T10:00:00.000Z'),
      },
      {
        username: 'memberA',
        agentNickname: null,
        role: 'User',
        loginDate: new Date('2026-03-01T09:00:00.000Z'),
      },
      {
        username: 'guest1',
        agentNickname: 'sadadasdsad',
        role: 'Guest',
        loginDate: new Date('2026-03-01T08:00:00.000Z'),
      },
    ]);
    userService.findById.mockResolvedValue({
      id: 2,
      isGuest: false,
      role: { starCount: 4 },
    });

    const service = new LoginHistoryService(
      repository as any,
      userService as any,
      ipLookupService as any,
    );

    const result = await service.getIdentitiesByRecordId(8, 2);

    expect(result.identities).toHaveLength(2);
    expect(result.identities[0].displayName).toBe('memberA');
    expect(result.identities[1]).toEqual(
      expect.objectContaining({
        displayName: 'sadadasdsad',
        username: 'guest1',
        isGuest: true,
      }),
    );
  });

  it('should mask IP addresses in paginated list when includeIpAddress is false', async () => {
    const repository = createRepository();
    const userService = createUserService();
    const ipLookupService = createIpLookupService();

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 1,
            username: 'member',
            ipAddress: '8.8.8.8',
            starCount: 0,
          },
        ],
        1,
      ]),
    };
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    const service = new LoginHistoryService(
      repository as any,
      userService as any,
      ipLookupService as any,
    );

    const result = await service.findAllPaginated(1, 20, 5, false);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ipAddress).toBe('Gizli');
  });
});
