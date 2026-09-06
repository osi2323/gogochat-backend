import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { VoiceSession } from './voice-session.entity';
import { PreferencesService } from '../preferences/preferences.service';
import { SiteConfigService } from '../site-config/site-config.service';
export declare class VoiceService implements OnModuleInit, OnModuleDestroy {
    private sessions;
    private db;
    private prefs;
    private siteConfig;
    private timer?;
    private readonly url;
    private readonly key;
    private readonly secret;
    private roomClient?;
    constructor(sessions: Repository<VoiceSession>, db: DataSource, prefs: PreferencesService, siteConfig: SiteConfigService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private configured;
    issue(roomId: string, userId: string): Promise<{
        url: string;
        token: string;
        sessionId: string;
        expiresAt: string;
        remainingSeconds: number;
        maxMicrophones: number;
    }>;
    leave(roomId: string, userId: string): Promise<{
        ok: boolean;
    }>;
    status(roomId: string, userId: string): Promise<{
        active: boolean;
        remainingSeconds: number;
        expiresAt: null;
        activeCount: number;
        maxMicrophones: number;
    } | {
        active: boolean;
        remainingSeconds: number;
        expiresAt: string;
        activeCount: number;
        maxMicrophones: number;
    }>;
    participants(roomId: string, userId: string): Promise<{
        sessionId: string;
        userId: string;
        username: string;
        starCount: number;
        rankName: string;
        startedAt: Date;
        expiresAt: Date;
    }[]>;
    forceLeave(roomId: string, actorId: string, targetUserId: string, reason?: string): Promise<{
        ok: boolean;
        userId: string;
    }>;
    private expireSessions;
    private removeParticipant;
}
