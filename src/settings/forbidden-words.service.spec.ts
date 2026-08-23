import { ConflictException } from '@nestjs/common';
import { ForbiddenWordsService } from './forbidden-words.service';

describe('ForbiddenWordsService', () => {
  const createService = () => {
    const forbiddenWordRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      restore: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      softDelete: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };

    const service = new ForbiddenWordsService(
      forbiddenWordRepository as any,
      userService as any,
    );

    return {
      service,
      forbiddenWordRepository,
      userService,
    };
  };

  it('create should restore soft-deleted words with the new replacement', async () => {
    const { service, forbiddenWordRepository } = createService();
    const deletedAt = new Date('2026-05-05T10:00:00.000Z');

    forbiddenWordRepository.findOne
      .mockResolvedValueOnce({
        id: 7,
        forbiddenWord: 'as',
        replacementWord: 'eski',
        deletedAt,
      })
      .mockResolvedValueOnce({
        id: 7,
        forbiddenWord: 'as',
        replacementWord: 'yeni',
        deletedAt: null,
        createdById: 11,
        createdBy: { id: 11, username: 'admin' },
        createdAt: new Date('2026-05-05T10:01:00.000Z'),
      });
    forbiddenWordRepository.update.mockResolvedValue(undefined);
    forbiddenWordRepository.restore.mockResolvedValue(undefined);

    await expect(
      service.create({ forbiddenWord: 'as', replacementWord: 'yeni' }, 11),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 7,
        forbiddenWord: 'as',
        replacementWord: 'yeni',
      }),
    );

    expect(forbiddenWordRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { forbiddenWord: 'as' },
      withDeleted: true,
    });
    expect(forbiddenWordRepository.update).toHaveBeenCalledWith(7, {
      replacementWord: 'yeni',
      createdById: 11,
    });
    expect(forbiddenWordRepository.restore).toHaveBeenCalledWith(7);
  });

  it('create should reject an already active forbidden word', async () => {
    const { service, forbiddenWordRepository } = createService();
    forbiddenWordRepository.findOne.mockResolvedValue({
      id: 7,
      forbiddenWord: 'as',
      replacementWord: 'eski',
      deletedAt: null,
    });

    await expect(
      service.create({ forbiddenWord: 'as', replacementWord: 'yeni' }, 11),
    ).rejects.toThrow(ConflictException);
  });
});
