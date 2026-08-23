import { ConflictException } from '@nestjs/common';
import { ForbiddenNicknamesService } from './forbidden-nicknames.service';

describe('ForbiddenNicknamesService', () => {
  const createService = () => {
    const forbiddenNicknameRepository = {
      findOne: jest.fn(),
      restore: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      softDelete: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };

    const service = new ForbiddenNicknamesService(
      forbiddenNicknameRepository as any,
      userService as any,
    );

    return {
      service,
      forbiddenNicknameRepository,
      userService,
    };
  };

  it('findByNickname should only query active forbidden nicknames', async () => {
    const { service, forbiddenNicknameRepository } = createService();
    forbiddenNicknameRepository.findOne.mockResolvedValue(null);

    await expect(service.findByNickname('testnick')).resolves.toBeNull();

    expect(forbiddenNicknameRepository.findOne).toHaveBeenCalledWith({
      where: { nickname: 'testnick' },
    });
    expect(forbiddenNicknameRepository.findOne).not.toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );
  });

  it('create should keep checking soft-deleted records so they can be restored', async () => {
    const { service, forbiddenNicknameRepository } = createService();
    const deletedAt = new Date('2026-05-05T10:00:00.000Z');

    forbiddenNicknameRepository.findOne
      .mockResolvedValueOnce({
        id: 7,
        nickname: 'testnick',
        deletedAt,
      })
      .mockResolvedValueOnce({
        id: 7,
        nickname: 'testnick',
        deletedAt: null,
        createdById: 11,
        createdBy: { username: 'admin' },
        createdAt: new Date('2026-05-05T10:01:00.000Z'),
      });
    forbiddenNicknameRepository.restore.mockResolvedValue(undefined);

    await expect(
      service.create({ nickname: 'testnick' }, 11),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 7,
        nickname: 'testnick',
        createdByUsername: 'admin',
      }),
    );

    expect(forbiddenNicknameRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { nickname: 'testnick' },
      withDeleted: true,
    });
    expect(forbiddenNicknameRepository.restore).toHaveBeenCalledWith(7);
  });

  it('create should reject an already active forbidden nickname', async () => {
    const { service, forbiddenNicknameRepository } = createService();
    forbiddenNicknameRepository.findOne.mockResolvedValue({
      id: 7,
      nickname: 'testnick',
      deletedAt: null,
    });

    await expect(service.create({ nickname: 'testnick' }, 11)).rejects.toThrow(
      ConflictException,
    );
  });
});
