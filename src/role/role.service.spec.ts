import { RoleService } from './role.service';

describe('RoleService', () => {
  it('update should sync all users when permissions field is present in payload', async () => {
    const existingRole: any = {
      id: 5,
      name: 'Moderator',
      permissions: { 'Admin Paneli': true, Banlama: false },
    };
    const savedRole: any = {
      ...existingRole,
      permissions: { 'Admin Paneli': true, Banlama: true },
    };

    const roleRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(existingRole)
        .mockResolvedValueOnce(null),
      save: jest.fn().mockResolvedValue(savedRole),
    };
    const userRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    const service = new RoleService(roleRepository as any, userRepository as any);

    await service.update(5, {
      permissions: { 'Admin Paneli': true, Banlama: true },
    } as any);

    expect(userRepository.update).toHaveBeenCalledWith(
      { roleId: 5 },
      { permissions: ['Admin Paneli', 'Banlama'] },
    );
  });

  it('update should not sync users when permissions field is absent in payload', async () => {
    const existingRole: any = {
      id: 5,
      name: 'Moderator',
      permissions: { 'Admin Paneli': true },
    };
    const savedRole: any = {
      ...existingRole,
      name: 'Senior Moderator',
    };

    const roleRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(existingRole)
        .mockResolvedValueOnce(null),
      save: jest.fn().mockResolvedValue(savedRole),
    };
    const userRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    const service = new RoleService(roleRepository as any, userRepository as any);

    const result = await service.update(5, { name: 'Senior Moderator' } as any);

    expect(roleRepository.save).toHaveBeenCalledWith({
      ...existingRole,
      name: 'Senior Moderator',
    });
    expect(userRepository.update).not.toHaveBeenCalled();
    expect(result.permissions).toEqual({ 'Admin Paneli': true });
  });
});
