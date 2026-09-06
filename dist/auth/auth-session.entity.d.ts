import { User } from './user.entity';
export declare class AuthSession {
    id: string;
    userId: string;
    user: User;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
}
