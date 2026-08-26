export class BannedUserDto {
  id: number;
  banType: 'user' | 'ip';
  username: string;
  bannedByUsername: string;
  bannedByStarCount: number;
  reason: string | null;
  expiresAt: Date | null;
  createdAt: Date | string | null;
  ipAddress?: string | null;
  source?: string | null;
}

export class BannedUsersResponseDto {
  bannedUsers: BannedUserDto[];
  total: number;
}
