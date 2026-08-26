import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull } from 'typeorm';
import { AdminAction } from './entities/admin-action.entity';
import {
  AdminActionResponseDto,
  toAdminActionResponse,
} from './dto/admin-action-response.dto';

type LogActionParams = {
  adminId?: number | null;
  adminUsername?: string | null;
  actionType: string;
  description?: string | null;
  targetUserId?: number | null;
  targetUsername?: string | null;
  status?: string;
  metadata?: Record<string, any> | null;
};

@Injectable()
export class AdminActionsService {
  constructor(
    @InjectRepository(AdminAction)
    private readonly adminActionRepository: Repository<AdminAction>,
  ) {}

  async logAction(params: LogActionParams): Promise<AdminActionResponseDto> {
    const {
      adminId = null,
      adminUsername = null,
      actionType,
      description = null,
      targetUserId = null,
      targetUsername = null,
      status = 'COMPLETED',
      metadata = null,
    } = params;

    const adminAction = this.adminActionRepository.create({
      adminId,
      actionType,
      description,
      targetUserId,
      targetUsername,
      status,
      metadata,
    });

    const saved = await this.adminActionRepository.save(adminAction);

    const withAdmin: AdminAction = {
      ...saved,
      admin: adminId
        ? ({
            id: adminId,
            username: adminUsername ?? undefined,
          } as any)
        : undefined,
    };

    return toAdminActionResponse(withAdmin);
  }

  async findAllPaginated(
    page = 1,
    limit = 20,
    requestingUserStarCount: number,
    actionType?: string,
  ): Promise<{
    items: AdminActionResponseDto[];
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  }> {
    const safePage = page < 1 ? 1 : page;
    const safeLimit = limit < 1 ? 1 : Math.min(limit, 100);
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.adminActionRepository.findAndCount({
      where: [
        {
          ...(actionType ? { actionType } : {}),
          admin: {
            role: {
              starCount: LessThanOrEqual(requestingUserStarCount),
            },
          },
        },
        {
          ...(actionType ? { actionType } : {}),
          adminId: IsNull(),
        },
      ],
      relations: ['admin', 'admin.role'],
      order: { createdAt: 'DESC' },
      skip,
      take: safeLimit,
      select: {
        id: true,
        actionType: true,
        description: true,
        targetUserId: true,
        targetUsername: true,
        status: true,
        metadata: true,
        createdAt: true,
        admin: {
          id: true,
          username: true,
          role: {
            id: true,
            starCount: true,
          },
        },
      },
    });

    return {
      items: items.map(toAdminActionResponse),
      total,
      page: safePage,
      limit: safeLimit,
      pageCount: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }
}
