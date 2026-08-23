import { WallPostsService } from './wall-posts.service';

describe('WallPostsService delete permissions', () => {
  const createService = () => {
    const wallPostRepository = {
      findOne: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };
    const wallPostLikeRepository = {};
    const wallPostCommentRepository = {
      findOne: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    const wallPostViewRepository = {
      find: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };

    const service = new WallPostsService(
      wallPostRepository as any,
      wallPostLikeRepository as any,
      wallPostCommentRepository as any,
      wallPostViewRepository as any,
      userService as any,
    );

    return {
      service,
      wallPostRepository,
      wallPostCommentRepository,
      wallPostViewRepository,
      userService,
    };
  };

  it('removePost should allow deleting own post without Hikaye Silme', async () => {
    const { service, wallPostRepository, userService } = createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: [],
      role: { permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 10 });
    wallPostRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.removePost(10, 55)).resolves.toBeUndefined();
    expect(wallPostRepository.delete).toHaveBeenCalledWith({ id: 55 });
  });

  it('removePost should reject deleting others post without Hikaye Silme', async () => {
    const { service, wallPostRepository, userService } = createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: [],
      role: { permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 20 });

    await expect(service.removePost(10, 55)).rejects.toThrow(
      'Bu duvar yazısını silme yetkiniz yok',
    );
    expect(wallPostRepository.delete).not.toHaveBeenCalled();
  });

  it('removePost should allow deleting others post with Hikaye Silme', async () => {
    const { service, wallPostRepository, userService } = createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Hikaye Silme'],
      role: { starCount: 3, permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({
      id: 55,
      userId: 20,
      user: { id: 20, role: { starCount: 1 } },
    });
    wallPostRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.removePost(10, 55)).resolves.toBeUndefined();
    expect(wallPostRepository.delete).toHaveBeenCalledWith({ id: 55 });
  });

  it('removePost should reject deleting same-rank post with Hikaye Silme', async () => {
    const { service, wallPostRepository, userService } = createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Hikaye Silme'],
      role: { starCount: 2, permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({
      id: 55,
      userId: 20,
      user: { id: 20, role: { starCount: 2 } },
    });

    await expect(service.removePost(10, 55)).rejects.toThrow(
      'Bu duvar yazısını silme yetkiniz yok',
    );
    expect(wallPostRepository.delete).not.toHaveBeenCalled();
  });

  it('removeComment should allow deleting own comment without Hikaye Silme', async () => {
    const { service, wallPostRepository, wallPostCommentRepository, userService } =
      createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: [],
      role: { permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 20 });
    wallPostCommentRepository.findOne.mockResolvedValue({
      id: 99,
      userId: 10,
      wallPostId: 55,
    });
    wallPostCommentRepository.delete.mockResolvedValue({ affected: 1 });
    wallPostCommentRepository.count.mockResolvedValue(0);
    wallPostRepository.update.mockResolvedValue({ affected: 1 });

    await expect(service.removeComment(10, 55, 99)).resolves.toBeUndefined();
    expect(wallPostCommentRepository.delete).toHaveBeenCalledWith({ id: 99 });
  });

  it('removeComment should reject deleting others comment without Hikaye Silme', async () => {
    const { service, wallPostRepository, wallPostCommentRepository, userService } =
      createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: [],
      role: { permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 20 });
    wallPostCommentRepository.findOne.mockResolvedValue({
      id: 99,
      userId: 33,
      wallPostId: 55,
    });

    await expect(service.removeComment(10, 55, 99)).rejects.toThrow(
      'Bu yorumu silme yetkiniz yok',
    );
    expect(wallPostCommentRepository.delete).not.toHaveBeenCalled();
  });

  it('removeComment should allow deleting others comment with role Hikaye Silme', async () => {
    const { service, wallPostRepository, wallPostCommentRepository, userService } =
      createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: [],
      role: { starCount: 4, permissions: { 'Hikaye Silme': true } },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 20 });
    wallPostCommentRepository.findOne.mockResolvedValue({
      id: 99,
      userId: 33,
      wallPostId: 55,
      user: { id: 33, role: { starCount: 2 } },
    });
    wallPostCommentRepository.delete.mockResolvedValue({ affected: 1 });
    wallPostCommentRepository.count.mockResolvedValue(3);
    wallPostRepository.update.mockResolvedValue({ affected: 1 });

    await expect(service.removeComment(10, 55, 99)).resolves.toBeUndefined();
    expect(wallPostCommentRepository.delete).toHaveBeenCalledWith({ id: 99 });
    expect(wallPostRepository.update).toHaveBeenCalledWith(
      { id: 55 },
      { commentCount: 3 },
    );
  });

  it('removeComment should reject deleting same-rank comment with Hikaye Silme', async () => {
    const { service, wallPostRepository, wallPostCommentRepository, userService } =
      createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Hikaye Silme'],
      role: { starCount: 2, permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 20 });
    wallPostCommentRepository.findOne.mockResolvedValue({
      id: 99,
      userId: 33,
      wallPostId: 55,
      user: { id: 33, role: { starCount: 2 } },
    });

    await expect(service.removeComment(10, 55, 99)).rejects.toThrow(
      'Bu yorumu silme yetkiniz yok',
    );
    expect(wallPostCommentRepository.delete).not.toHaveBeenCalled();
  });

  it('listViews should reject non-owner even with Hikaye Silme', async () => {
    const { service, wallPostRepository, wallPostViewRepository, userService } =
      createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'staff',
      permissions: ['Hikaye Silme'],
      role: { permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 20 });

    await expect(service.listViews(10, 55)).rejects.toThrow(
      'Bu görüntülemeleri görme yetkiniz yok',
    );
    expect(wallPostViewRepository.find).not.toHaveBeenCalled();
  });

  it('listViews should allow only the post owner', async () => {
    const { service, wallPostRepository, wallPostViewRepository, userService } =
      createService();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'owner',
      permissions: [],
      role: { permissions: {} },
    });
    wallPostRepository.findOne.mockResolvedValue({ id: 55, userId: 10 });
    wallPostViewRepository.find.mockResolvedValue([
      {
        id: 1,
        user: { id: 30, username: 'viewer', icon: null },
        createdAt: new Date(2026, 3, 9, 17, 2, 0, 0),
      },
    ]);

    await expect(service.listViews(10, 55)).resolves.toEqual([
      {
        id: 1,
        user: { id: 30, username: 'viewer', icon: null },
        createdAt: '2026-04-09T17:02:00.000Z',
      },
    ]);
    expect(wallPostViewRepository.find).toHaveBeenCalledWith({
      where: { wallPostId: 55 },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  });

  it('should normalize Date values by preserving wall-clock time as UTC', () => {
    const { service } = createService();
    const localDate = new Date(2026, 3, 9, 17, 2, 0, 0);

    expect((service as any).toIsoDate(localDate)).toBe(
      '2026-04-09T17:02:00.000Z',
    );
  });

  it('should normalize timezone-less timestamp strings as UTC', () => {
    const { service } = createService();

    expect((service as any).toIsoDate('2026-04-09 17:02:00')).toBe(
      '2026-04-09T17:02:00.000Z',
    );
  });
});
