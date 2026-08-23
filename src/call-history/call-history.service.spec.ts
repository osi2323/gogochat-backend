import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { CallHistoryService } from './call-history.service';
import { CallHistory } from './entities/call-history.entity';

describe('CallHistoryService', () => {
  let service: CallHistoryService;
  const repository = {
    find: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallHistoryService,
        {
          provide: getRepositoryToken(CallHistory),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(CallHistoryService);
  });

  it('lists only current user call history', async () => {
    const startedAt = new Date('2026-05-11T10:00:00.000Z');
    repository.find.mockResolvedValue([
      {
        id: 12,
        callId: 'call-1',
        peerName: 'Ayse',
        direction: 'incoming',
        status: 'missed',
        startedAt,
        endedAt: null,
        durationSec: null,
      },
    ]);

    const result = await service.list('tenant_master', 5, 'Agent');

    expect(repository.find).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant_master',
        userId: 5,
        agentNickname: 'Agent',
        deletedAt: IsNull(),
      },
      order: { startedAt: 'DESC', id: 'DESC' },
      take: 100,
    });
    expect(result).toEqual([
      {
        id: 12,
        callId: 'call-1',
        peerName: 'Ayse',
        direction: 'incoming',
        status: 'missed',
        startedAt: startedAt.toISOString(),
        endedAt: null,
        durationSec: null,
      },
    ]);
  });

  it('creates a call history row for the current identity', async () => {
    const startedAt = '2026-05-11T10:00:00.000Z';
    const endedAt = '2026-05-11T10:01:05.000Z';
    repository.save.mockImplementation((entity) =>
      Promise.resolve({
        id: 9,
        ...entity,
      }),
    );

    const result = await service.create('tenant_master', 7, undefined, {
      callId: 'call-2',
      peerName: 'Mehmet',
      direction: 'outgoing',
      status: 'completed',
      startedAt,
      endedAt,
      durationSec: 65,
    });

    expect(repository.create).toHaveBeenCalledWith({
      tenantId: 'tenant_master',
      userId: 7,
      agentNickname: '',
      callId: 'call-2',
      peerName: 'Mehmet',
      direction: 'outgoing',
      status: 'completed',
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      durationSec: 65,
    });
    expect(result.id).toBe(9);
    expect(result.durationSec).toBe(65);
  });

  it('soft deletes only records owned by the current identity', async () => {
    repository.softDelete.mockResolvedValue({ affected: 1 });

    await service.delete('tenant_master', 3, 'Agent', 44);

    expect(repository.softDelete).toHaveBeenCalledWith({
      id: 44,
      tenantId: 'tenant_master',
      userId: 3,
      agentNickname: 'Agent',
    });
  });

  it('throws when deleting a record owned by someone else', async () => {
    repository.softDelete.mockResolvedValue({ affected: 0 });

    await expect(
      service.delete('tenant_master', 3, undefined, 44),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
