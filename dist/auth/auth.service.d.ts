import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { User } from './user.entity';
import { Rank } from '../ranks/rank.entity';
import { AuthSession } from './auth-session.entity';
import { SiteConfigService } from '../site-config/site-config.service';
export declare class AuthService {
    private users;
    private ranks;
    private sessions;
    private jwt;
    private siteConfig;
    private db;
    constructor(users: Repository<User>, ranks: Repository<Rank>, sessions: Repository<AuthSession>, jwt: JwtService, siteConfig: SiteConfigService, db: DataSource);
    private publicUser;
    private hash;
    private access;
    private makeRefresh;
    private issue;
    register(username: string, password: string, meta?: any): Promise<{
        accessToken: string;
        refreshToken: string;
        refreshExpiresAt: Date;
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: Rank;
        };
    }>;
    login(username: string, password: string, meta?: any): Promise<{
        accessToken: string;
        refreshToken: string;
        refreshExpiresAt: Date;
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: Rank;
        };
    }>;
    guest(nickname: string, meta?: any): Promise<{
        accessToken: string;
        refreshToken: string;
        refreshExpiresAt: Date;
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: Rank;
        };
    }>;
    refresh(raw: string | undefined, meta?: any): Promise<{
        accessToken: string;
        refreshToken: string;
        refreshExpiresAt: Date;
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: Rank;
        };
    }>;
    logout(raw: string | undefined): Promise<{
        ok: boolean;
    }>;
    me(id: string): Promise<{
        id: string;
        username: string;
        isGuest: boolean;
        rank: Rank;
    }>;
}
