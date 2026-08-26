import { AdminAction } from '../entities/admin-action.entity';

export class AdminActionResponseDto {
  id: number;
  adminId?: number | null;
  adminUsername?: string | null;
  actionType: string;
  description?: string | null;
  targetUserId?: number | null;
  targetUsername?: string | null;
  status: string;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export const toAdminActionResponse = (
  adminAction: AdminAction,
): AdminActionResponseDto => ({
  id: adminAction.id,
  adminId: adminAction.adminId ?? null,
  adminUsername: adminAction.admin?.username ?? null,
  actionType: adminAction.actionType,
  description: adminAction.description ?? null,
  targetUserId: adminAction.targetUserId ?? null,
  targetUsername: adminAction.targetUsername ?? null,
  status: adminAction.status,
  metadata: adminAction.metadata ?? null,
  createdAt: adminAction.createdAt,
});
