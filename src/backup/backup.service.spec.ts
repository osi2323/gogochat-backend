import { BackupService, BackupData } from './backup.service';
import { Role } from '../role/entities/role.entity';
import { User } from '../user/entities/user.entity';
import { Bot } from '../bot/entities/bot.entity';
import { SystemSettings } from '../settings/entities/system-settings.entity';
import { StatusMode } from '../status-mode/entities/status-mode.entity';
import { Message } from '../messages/entities/message.entity';

const createDeleteBuilder = (operations: string[], label: string) => ({
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  execute: jest.fn().mockImplementation(async () => {
    operations.push(`delete:${label}`);
    return { affected: 1 };
  }),
});

const createTxRepository = (
  operations: string[],
  label: string,
  tableName: string,
) =>
  ({
    metadata: {
      schema: 'tenant_master',
      tableName,
    },
    manager: {
      connection: {
        options: {
          schema: 'tenant_master',
        },
      },
      query: jest.fn().mockResolvedValue(undefined),
    },
    createQueryBuilder: jest.fn(() => createDeleteBuilder(operations, label)),
    create: jest.fn((value) => value),
    save: jest.fn().mockImplementation(async (value) => {
      operations.push(`save:${label}`);
      return value;
    }),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockImplementation(async () => {
      operations.push(`update:${label}`);
      return { affected: 1 };
    }),
    softDelete: jest.fn().mockImplementation(async () => {
      operations.push(`softDelete:${label}`);
      return { affected: 1 };
    }),
  }) as any;

const baseBackupData = (users: any[]): BackupData => ({
  timestamp: '2026-05-01T10:00:00.000Z',
  roles: [
    {
      id: 1,
      name: 'Member',
      microphoneDuration: 60,
      starColor: '#fff',
      starCount: 1,
      permissions: {},
    },
  ],
  users,
  bots: [],
  systemSettings: null,
  statusModes: [{ id: 1, name: 'Online' }],
});

const createService = (params: {
  backupData: BackupData;
  existingUsers?: any[];
}) => {
  const operations: string[] = [];
  const txRepositories = new Map<any, any>([
    [Role, createTxRepository(operations, 'Role', 'role')],
    [User, createTxRepository(operations, 'User', 'user')],
    [Bot, createTxRepository(operations, 'Bot', 'bot')],
    [
      SystemSettings,
      createTxRepository(operations, 'SystemSettings', 'system_settings'),
    ],
    [StatusMode, createTxRepository(operations, 'StatusMode', 'status_mode')],
    [Message, createTxRepository(operations, 'Message', 'message')],
  ]);

  const userRepository = {
    find: jest.fn().mockResolvedValue(params.existingUsers ?? []),
    manager: {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: jest.fn((entity) => txRepositories.get(entity)),
        }),
      ),
    },
  };

  const service = new BackupService(
    {} as any,
    userRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      emitSystemResetStarted: jest.fn(),
    } as any,
  );

  jest.spyOn(service, 'getBackupById').mockResolvedValue(params.backupData);

  return {
    service,
    operations,
    userRepository,
    txRoleRepository: txRepositories.get(Role),
    txUserRepository: txRepositories.get(User),
  };
};

describe('BackupService restore password handling', () => {
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback: any) => {
        callback();
        return 0 as any;
      });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('preserves current password when old backup has no password field', async () => {
    const { service, txUserRepository } = createService({
      backupData: baseBackupData([
        {
          id: 7,
          username: 'alice',
          gender: 'female',
          roleId: 1,
          statusModeId: 1,
        },
      ]),
      existingUsers: [{ id: 7, username: 'alice', password: 'current-hash' }],
    });

    await expect(service.restoreBackup('master', 'backup-id')).resolves.toEqual(
      expect.objectContaining({
        restoredCounts: expect.objectContaining({ users: 1 }),
      }),
    );

    expect(txUserRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        username: 'alice',
        password: 'current-hash',
      }),
    ]);
  });

  it('uses backup password hash when user is not currently present', async () => {
    const { service, txUserRepository } = createService({
      backupData: baseBackupData([
        {
          id: 8,
          username: 'bob',
          password: 'backup-hash',
          gender: 'male',
          roleId: 1,
          statusModeId: 1,
        },
      ]),
      existingUsers: [],
    });

    await expect(service.restoreBackup('master', 'backup-id')).resolves.toEqual(
      expect.objectContaining({
        restoredCounts: expect.objectContaining({ users: 1 }),
      }),
    );

    expect(txUserRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        username: 'bob',
        password: 'backup-hash',
      }),
    ]);
  });

  it('skips users when neither current nor backup password hash exists', async () => {
    const { service, txUserRepository } = createService({
      backupData: baseBackupData([
        {
          id: 9,
          username: 'charlie',
          gender: 'male',
          roleId: 1,
          statusModeId: 1,
        },
      ]),
      existingUsers: [],
    });

    await expect(service.restoreBackup('master', 'backup-id')).resolves.toEqual(
      expect.objectContaining({
        restoredCounts: expect.objectContaining({ users: 0 }),
      }),
    );

    expect(txUserRepository.save).not.toHaveBeenCalled();
  });

  it('runs restore in a transaction with reference data before users', async () => {
    const { service, operations, userRepository } = createService({
      backupData: baseBackupData([
        {
          id: 10,
          username: 'dora',
          password: 'backup-hash',
          gender: 'female',
          roleId: 1,
          statusModeId: 1,
        },
      ]),
      existingUsers: [],
    });

    await service.restoreBackup('master', 'backup-id');

    expect(userRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(operations).toEqual([
      'delete:User',
      'delete:Bot',
      'delete:Role',
      'delete:StatusMode',
      'save:Role',
      'save:StatusMode',
      'save:User',
      'softDelete:Message',
    ]);
  });

  it('maps restored role ids and clears missing role references', async () => {
    const { service, txRoleRepository, txUserRepository } = createService({
      backupData: {
        ...baseBackupData([
          {
            id: 11,
            username: 'erin',
            password: 'backup-hash',
            gender: 'female',
            roleId: 1,
            statusModeId: 1,
          },
          {
            id: 12,
            username: 'frank',
            password: 'backup-hash',
            gender: 'male',
            roleId: 999,
            statusModeId: 1,
          },
        ]),
        roles: [
          {
            id: 1,
            name: 'Member',
            microphoneDuration: 60,
            starColor: '#fff',
            starCount: 1,
            permissions: {},
          },
        ],
      },
      existingUsers: [],
    });
    txRoleRepository.save.mockImplementationOnce(async (value) =>
      value.map((role) => ({ ...role, id: role.id === 1 ? 101 : role.id })),
    );

    await service.restoreBackup('master', 'backup-id');

    expect(txUserRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        username: 'erin',
        roleId: 101,
      }),
      expect.objectContaining({
        username: 'frank',
        roleId: null,
      }),
    ]);
  });
});
