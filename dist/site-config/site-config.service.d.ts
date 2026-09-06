import { Repository } from 'typeorm';
import { SiteSetting } from '../admin/site-setting.entity';
export type PublicSiteConfig = {
    siteName: string;
    announcement: string;
    guestEnabled: boolean;
    wallEnabled: boolean;
    voiceEnabled: boolean;
};
export declare class SiteConfigService {
    private settings;
    constructor(settings: Repository<SiteSetting>);
    private value;
    enabled(key: string, fallback?: boolean): Promise<boolean>;
    publicConfig(): Promise<PublicSiteConfig>;
}
