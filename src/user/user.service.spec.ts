import { ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService', () => {
  const createQueryBuilder = () => {
    const builder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return builder;
  };

  it('findByMinStarCount should exclude root from staff lists', async () => {
    const queryBuilder = createQueryBuilder();
    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new UserService(userRepository as any, {} as any, {} as any);

    await service.findByMinStarCount(1);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(user.username) != :rootUsername',
      { rootUsername: 'root' },
    );
  });

  it('findByMaxStarCount should exclude root from member lists', async () => {
    const queryBuilder = createQueryBuilder();
    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new UserService(userRepository as any, {} as any, {} as any);

    await service.findByMaxStarCount(1);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(user.username) != :rootUsername',
      { rootUsername: 'root' },
    );
  });

  const createUpdateUsernameService = ({
    user,
    settings,
    existingUser = null,
  }: {
    user: any;
    settings?: { staffCanChangeNickname: boolean } | null;
    existingUser?: any;
  }) => {
    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(user),
      softDelete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    const systemSettingsRepository = {
      findOne: jest.fn().mockResolvedValue(settings ?? null),
    };
    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
      systemSettingsRepository as any,
    );
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue({ id: user?.id, username: 'updated' } as any);

    return { service, userRepository, systemSettingsRepository };
  };

  it('updateUsername should block 1-star staff when staff nickname changes are disabled', async () => {
    const user: any = { id: 2, username: 'staff', role: { starCount: 1 } };
    const { service, userRepository, systemSettingsRepository } =
      createUpdateUsernameService({
        user,
        settings: { staffCanChangeNickname: false },
      });

    await expect(service.updateUsername(2, 'updated')).rejects.toThrow(
      'Yetkililerin rumuz değiştirmesi sistem ayarlarında kapalı.',
    );
    expect(systemSettingsRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(userRepository.softDelete).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('updateUsername should block 24-star staff when staff nickname changes are disabled', async () => {
    const user: any = { id: 2, username: 'staff', role: { starCount: 24 } };
    const { service, userRepository } = createUpdateUsernameService({
      user,
      settings: { staffCanChangeNickname: false },
    });

    await expect(service.updateUsername(2, 'updated')).rejects.toThrow(
      ForbiddenException,
    );
    expect(userRepository.softDelete).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('updateUsername should allow staff in the restricted star range when setting is enabled', async () => {
    const user: any = { id: 2, username: 'staff', role: { starCount: 12 } };
    const { service, userRepository } = createUpdateUsernameService({
      user,
      settings: { staffCanChangeNickname: true },
    });

    await expect(service.updateUsername(2, 'updated')).resolves.toEqual({
      id: 2,
      username: 'updated',
    });
    expect(user.username).toBe('updated');
    expect(userRepository.softDelete).toHaveBeenCalledWith({
      username: 'updated',
      isGuest: true,
    });
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('updateUsername should allow non-staff users when staff nickname changes are disabled', async () => {
    const user: any = { id: 2, username: 'member', role: { starCount: 0 } };
    const { service, userRepository, systemSettingsRepository } =
      createUpdateUsernameService({
        user,
        settings: { staffCanChangeNickname: false },
      });

    await expect(service.updateUsername(2, 'updated')).resolves.toEqual({
      id: 2,
      username: 'updated',
    });
    expect(systemSettingsRepository.findOne).not.toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('updateUsername should allow 25-star users when staff nickname changes are disabled', async () => {
    const user: any = { id: 2, username: 'owner', role: { starCount: 25 } };
    const { service, userRepository, systemSettingsRepository } =
      createUpdateUsernameService({
        user,
        settings: { staffCanChangeNickname: false },
      });

    await expect(service.updateUsername(2, 'updated')).resolves.toEqual({
      id: 2,
      username: 'updated',
    });
    expect(systemSettingsRepository.findOne).not.toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('updateUsername should keep existing username conflict behavior', async () => {
    const user: any = { id: 2, username: 'member', role: { starCount: 0 } };
    const existingUser: any = { id: 3, username: 'updated' };
    const { service, userRepository } = createUpdateUsernameService({
      user,
      existingUser,
      settings: { staffCanChangeNickname: true },
    });

    await expect(service.updateUsername(2, 'updated')).rejects.toThrow(
      'Username already exists',
    );
    expect(userRepository.findOne).toHaveBeenCalledTimes(1);
    expect(userRepository.softDelete).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('updateUserByAdmin should apply role permissions when role changes without permissions override', async () => {
    const adminUser: any = { id: 1, role: { starCount: 10 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: ['Eski İzin'],
      protection: false,
    };
    const newRole: any = {
      id: 3,
      starCount: 2,
      permissions: { 'Admin Paneli': true, Banlama: false, 'Üye Yönetimi': true },
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const roleRepository = {
      findOne: jest.fn().mockResolvedValue(newRole),
    };
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedUser = { id: 2, permissions: ['Admin Paneli', 'Üye Yönetimi'] };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedUser as any);

    const result = await service.updateUserByAdmin(1, 2, { roleId: 3 } as any);

    expect(targetUser.roleId).toBe(3);
    expect(targetUser.permissions).toEqual(['Admin Paneli', 'Üye Yönetimi']);
    expect(userRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        roleId: 3,
        permissions: ['Admin Paneli', 'Üye Yönetimi'],
      }),
    );
    expect(result).toEqual(expectedUser);
  });

  it('updateUserByAdmin should keep explicit permissions override when role changes', async () => {
    const adminUser: any = { id: 1, role: { starCount: 10 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: ['Eski İzin'],
      protection: false,
    };
    const newRole: any = {
      id: 3,
      starCount: 2,
      permissions: { 'Admin Paneli': true, 'Üye Yönetimi': true },
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const roleRepository = {
      findOne: jest.fn().mockResolvedValue(newRole),
    };
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedUser = { id: 2, permissions: [] };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedUser as any);

    const result = await service.updateUserByAdmin(1, 2, {
      roleId: 3,
      permissions: [],
    } as any);

    expect(targetUser.permissions).toEqual([]);
    expect(userRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        roleId: 3,
        permissions: [],
      }),
    );
    expect(result).toEqual(expectedUser);
  });

  it('updateUserByAdmin should apply explicit permissions override without role change', async () => {
    const adminUser: any = { id: 1, role: { starCount: 10 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: ['Eski İzin'],
      protection: false,
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const roleRepository = {
      findOne: jest.fn(),
    };
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedUser = { id: 2, permissions: ['Banlama'] };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedUser as any);

    const result = await service.updateUserByAdmin(1, 2, {
      permissions: ['Banlama'],
    } as any);

    expect(roleRepository.findOne).not.toHaveBeenCalled();
    expect(targetUser.permissions).toEqual(['Banlama']);
    expect(userRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        permissions: ['Banlama'],
      }),
    );
    expect(result).toEqual(expectedUser);
  });

  it('updateUserByAdmin should normalize and persist flash nick override', async () => {
    const oneByOnePngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B+X8AAAAASUVORK5CYII=';
    const adminUser: any = { id: 1, role: { starCount: 10 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: ['Eski İzin'],
      protection: false,
      flashNick: null,
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );
    const expectedUser = {
      id: 2,
      flashNick: `data:image/png;base64,${oneByOnePngBase64}`,
    };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedUser as any);

    const result = await service.updateUserByAdmin(1, 2, {
      flashNick: ` data:image/png;base64,${oneByOnePngBase64} `,
    } as any);

    expect(userRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        flashNick: `data:image/png;base64,${oneByOnePngBase64}`,
      }),
    );
    expect(result).toEqual(expectedUser);
  });

  it('updateUserByAdmin should clear flash nick when null is provided', async () => {
    const adminUser: any = { id: 1, role: { starCount: 10 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: ['Eski İzin'],
      protection: false,
      flashNick: 'data:image/png;base64,AAAA',
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );
    const expectedUser = { id: 2, flashNick: null };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedUser as any);

    const result = await service.updateUserByAdmin(1, 2, {
      flashNick: null,
    } as any);

    expect(userRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        flashNick: null,
      }),
    );
    expect(result).toEqual(expectedUser);
  });

  it('updateUserByAdmin should reject invalid flash nick payload', async () => {
    const adminUser: any = { id: 1, role: { starCount: 10 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: [],
      protection: false,
      flashNick: null,
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      update: jest.fn(),
    };
    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.updateUserByAdmin(1, 2, {
        flashNick:
          'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TA0AAAAvAAAAAAfQ//73v/+BiOh/AAA=',
      } as any),
    ).rejects.toThrow('Geçersiz flash nick formatı');
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('updateUserByAdmin should block protected user when admin star is lower than protector', async () => {
    const adminUser: any = { id: 1, role: { starCount: 2 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: [],
      protection: true,
      protectedByStarCount: 3,
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      save: jest.fn(),
      update: jest.fn(),
    };

    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.updateUserByAdmin(1, 2, { username: 'new-target' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('updateUserByAdmin should allow protected user when admin star matches protector', async () => {
    const adminUser: any = { id: 1, role: { starCount: 3 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      permissions: [],
      protection: true,
      protectedByStarCount: 3,
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );
    jest
      .spyOn(service as any, 'findMemberByUsername')
      .mockResolvedValue(null);
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue({ id: 2, username: 'updated' } as any);

    await expect(
      service.updateUserByAdmin(1, 2, { username: 'updated' } as any),
    ).resolves.toEqual({ id: 2, username: 'updated' });
    expect(userRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        username: 'updated',
      }),
    );
  });

  it('deleteUserByAdmin should block protected user when admin star is lower than protector', async () => {
    const adminUser: any = { id: 1, role: { starCount: 2 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      protection: true,
      protectedByStarCount: 3,
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      softDelete: jest.fn(),
    };

    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );

    await expect(service.deleteUserByAdmin(1, 2)).rejects.toThrow(
      ForbiddenException,
    );
    expect(userRepository.softDelete).not.toHaveBeenCalled();
  });

  it('deleteUserByAdmin should allow protected user when admin star is higher than protector', async () => {
    const adminUser: any = { id: 1, role: { starCount: 4 } };
    const targetUser: any = {
      id: 2,
      username: 'target',
      role: { starCount: 1 },
      protection: true,
      protectedByStarCount: 3,
    };

    const userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );

    await expect(service.deleteUserByAdmin(1, 2)).resolves.toBeUndefined();
    expect(userRepository.softDelete).toHaveBeenCalledWith(2);
  });

  it('deleteUserByAdmin should reject when admin star is below 1', async () => {
    const adminUser: any = { id: 1, role: { starCount: 0 } };
    const userRepository = {
      findOne: jest.fn().mockResolvedValueOnce(adminUser),
      softDelete: jest.fn(),
    };

    const service = new UserService(
      userRepository as any,
      {} as any,
      {} as any,
    );

    await expect(service.deleteUserByAdmin(1, 2)).rejects.toThrow(
      'En az 1 yıldız gereklidir',
    );
    expect(userRepository.softDelete).not.toHaveBeenCalled();
  });

  it('cleanupExpiredGuests should execute soft-delete query with expected filters', async () => {
    const queryBuilder = {
      softDelete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );

    await service.cleanupExpiredGuests();

    expect(userRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(queryBuilder.softDelete).toHaveBeenCalledTimes(1);
    expect(queryBuilder.where).toHaveBeenCalledWith('isGuest = :isGuest', {
      isGuest: true,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'guestExpiresAt IS NOT NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'guestExpiresAt < :now',
      expect.objectContaining({ now: expect.any(Date) }),
    );
    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('updateNickColor should save normalized hex value', async () => {
    const userEntity: any = { id: 7, nickColor: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 7, nickColor: '#2563EB' };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateNickColor(7, '  #2563EB  ');

    expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(userEntity.nickColor).toBe('#2563EB');
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateNickColor should clear value when null is provided', async () => {
    const userEntity: any = { id: 9, nickColor: '#22C55E' };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 9, nickColor: null };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateNickColor(9, null);

    expect(userEntity.nickColor).toBeNull();
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateUserGif should save normalized allowed gif path', async () => {
    const userEntity: any = { id: 10, userGif: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 10, userGif: '/usergifler/bayrak.gif.gif' };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateUserGif(10, 'bayrak.gif.gif');

    expect(userEntity.userGif).toBe('/usergifler/bayrak.gif.gif');
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateUserGif should clear value when null is provided', async () => {
    const userEntity: any = {
      id: 11,
      userGif: '/usergifler/kalpler.gif',
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 11, userGif: null };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateUserGif(11, null);

    expect(userEntity.userGif).toBeNull();
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateUserGif should reject unsupported gif values', async () => {
    const userEntity: any = { id: 12, userGif: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );

    await expect(service.updateUserGif(12, '/usergifler/not-found.gif')).rejects.toThrow(
      'Geçersiz user gif seçimi',
    );
  });

  it('updateUserGif should normalize legacy gif values to current files', async () => {
    const userEntity: any = { id: 13, userGif: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 13, userGif: '/usergifler/kelebek.gif' };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateUserGif(13, 'baris_guvercini.gif.gif');

    expect(userEntity.userGif).toBe('/usergifler/kelebek.gif');
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateUserGif should save yearbasi gif path', async () => {
    const userEntity: any = { id: 14, userGif: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 14, userGif: '/usergifler/yılbasi.gif' };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateUserGif(14, '/usergifler/yılbasi.gif');

    expect(userEntity.userGif).toBe('/usergifler/yılbasi.gif');
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateUserGif should map legacy yaprak gif to yearbasi', async () => {
    const userEntity: any = { id: 15, userGif: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 15, userGif: '/usergifler/yılbasi.gif' };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateUserGif(15, '/usergifler/yaprak.gif');

    expect(userEntity.userGif).toBe('/usergifler/yılbasi.gif');
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateUserGif should save gul gif path', async () => {
    const userEntity: any = { id: 16, userGif: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 16, userGif: '/usergifler/gul.gif' };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateUserGif(16, '/usergifler/gul.gif');

    expect(userEntity.userGif).toBe('/usergifler/gul.gif');
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateFlashNick should save normalized data URL', async () => {
    const oneByOnePngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B+X8AAAAASUVORK5CYII=';
    const userEntity: any = { id: 13, flashNick: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = {
      id: 13,
      flashNick: `data:image/png;base64,${oneByOnePngBase64}`,
    };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateFlashNick(
      13,
      ` data:image/png;base64,${oneByOnePngBase64} `,
    );

    expect(userEntity.flashNick).toBe(
      `data:image/png;base64,${oneByOnePngBase64}`,
    );
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateFlashNick should accept gif mime type', async () => {
    const oneByOneGifBase64 = 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const userEntity: any = { id: 17, flashNick: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = {
      id: 17,
      flashNick: `data:image/gif;base64,${oneByOneGifBase64}`,
    };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateFlashNick(
      17,
      ` data:image/gif;base64,${oneByOneGifBase64} `,
    );

    expect(userEntity.flashNick).toBe(
      `data:image/gif;base64,${oneByOneGifBase64}`,
    );
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateFlashNick should clear value when null is provided', async () => {
    const userEntity: any = {
      id: 14,
      flashNick: 'data:image/png;base64,AAAA',
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );
    const expectedResult = { id: 14, flashNick: null };
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(expectedResult as any);

    const result = await service.updateFlashNick(14, null);

    expect(userEntity.flashNick).toBeNull();
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
    expect(result).toEqual(expectedResult);
  });

  it('updateFlashNick should reject unsupported mime type', async () => {
    const userEntity: any = { id: 15, flashNick: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );

    await expect(
      service.updateFlashNick(15, 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TA0AAAAvAAAAAAfQ//73v/+BiOh/AAA='),
    ).rejects.toThrow('Geçersiz flash nick formatı');
  });

  it('updateFlashNick should reject payload larger than 25MB', async () => {
    const userEntity: any = { id: 16, flashNick: null };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );

    const bigPayload = Buffer.alloc(25 * 1024 * 1024 + 1).toString('base64');
    await expect(
      service.updateFlashNick(16, `data:image/png;base64,${bigPayload}`),
    ).rejects.toThrow('Flash nick görseli en fazla 25MB olabilir');
  });

  it('create should reject case-insensitive member username conflicts', async () => {
    const caseInsensitiveLookupQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 12, username: 'kaanx' }),
    };

    const userRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(caseInsensitiveLookupQueryBuilder),
      softDelete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );

    await expect(
      service.create('KaanX', 'secret123', 'male' as any),
    ).rejects.toThrow('Username already exists');
    expect(userRepository.createQueryBuilder).toHaveBeenCalled();
    expect(userRepository.softDelete).not.toHaveBeenCalled();
  });

  it('createOrRefreshGuest should reject case-insensitive member username conflicts', async () => {
    const cleanupQueryBuilder = {
      softDelete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const caseInsensitiveLookupQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 18, username: 'kaanx' }),
    };

    const userRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(cleanupQueryBuilder)
        .mockReturnValueOnce(caseInsensitiveLookupQueryBuilder),
      softDelete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const roleRepository = {};
    const statusModeService = {};

    const service = new UserService(
      userRepository as any,
      roleRepository as any,
      statusModeService as any,
    );

    await expect(
      service.createOrRefreshGuest('KaanX', 'male' as any),
    ).rejects.toThrow('Username already exists');
    expect(userRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(userRepository.softDelete).not.toHaveBeenCalled();
  });

  it('updateJoinEffect should reject when permission is missing', async () => {
    const userEntity: any = {
      id: 25,
      username: 'member',
      isGuest: false,
      role: { starCount: 5, permissions: {} },
      permissions: [],
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn(),
    };

    const service = new UserService(userRepository as any, {} as any, {} as any);

    await expect(
      service.updateJoinEffect(25, 'ocean-ribbon' as any),
    ).rejects.toThrow('Giriş efekti seçme yetkiniz yok.');
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('updateJoinEffect should allow when permission exists even if star count is lower than one', async () => {
    const userEntity: any = {
      id: 26,
      username: 'member',
      isGuest: false,
      role: { starCount: 0, permissions: { 'Giriş efekti seçebilir': true } },
      permissions: [],
    };
    const updatedUser: any = { id: 26, joinEffect: 'ocean-ribbon' };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };

    const service = new UserService(userRepository as any, {} as any, {} as any);
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(updatedUser as any);

    await expect(
      service.updateJoinEffect(26, 'ocean-ribbon' as any),
    ).resolves.toEqual(updatedUser);
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
  });

  it('updateJoinEffect should allow when user has star and permission', async () => {
    const userEntity: any = {
      id: 27,
      username: 'member',
      isGuest: false,
      role: { starCount: 1, permissions: { 'Giriş efekti seçebilir': true } },
      permissions: [],
    };
    const updatedUser: any = { id: 27, joinEffect: 'ocean-ribbon' };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      save: jest.fn().mockResolvedValue(userEntity),
    };

    const service = new UserService(userRepository as any, {} as any, {} as any);
    jest
      .spyOn(service as any, 'getUserWithRelations')
      .mockResolvedValue(updatedUser as any);

    await expect(service.updateJoinEffect(27, 'ocean-ribbon' as any)).resolves.toEqual(
      updatedUser,
    );
    expect(userRepository.save).toHaveBeenCalledWith(userEntity);
  });
});
