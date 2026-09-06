import { Repository } from 'typeorm';
import { UserPreference } from './user-preference.entity';
import { UpdatePreferencesDto } from './preferences.dto';
export declare class PreferencesService {
    private repo;
    constructor(repo: Repository<UserPreference>);
    get(userId: string): Promise<UserPreference>;
    update(userId: string, d: UpdatePreferencesDto): Promise<UserPreference>;
    publicPrivacy(userId: string): Promise<{
        allowPrivateMessages: boolean;
        allowVoiceCalls: boolean;
        allowVideoCalls: boolean;
        showOnlineStatus: boolean;
    }>;
    canReceiveDm(userId: string): Promise<boolean>;
    canUseVoice(userId: string): Promise<boolean>;
    notificationEnabled(userId: string, type: string): Promise<boolean>;
    visibleOnlineUserIds(ids: string[]): Promise<string[]>;
}
