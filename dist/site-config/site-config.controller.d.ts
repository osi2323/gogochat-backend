import { SiteConfigService } from './site-config.service';
export declare class SiteConfigController {
    private config;
    constructor(config: SiteConfigService);
    get(): Promise<import("./site-config.service").PublicSiteConfig>;
}
