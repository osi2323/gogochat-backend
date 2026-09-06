"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteConfigService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const site_setting_entity_1 = require("../admin/site-setting.entity");
let SiteConfigService = class SiteConfigService {
    settings;
    constructor(settings) {
        this.settings = settings;
    }
    async value(key, fallback) { const row = await this.settings.findOneBy({ key }); return row?.value === undefined ? fallback : row.value; }
    async enabled(key, fallback = true) { return Boolean(await this.value(key, fallback)); }
    async publicConfig() { const rows = await this.settings.findBy([{ key: 'site.name' }, { key: 'site.announcement' }, { key: 'guest.enabled' }, { key: 'wall.enabled' }, { key: 'voice.enabled' }]); const map = new Map(rows.map(r => [r.key, r.value])); return { siteName: String(map.get('site.name') ?? 'GogoChat'), announcement: String(map.get('site.announcement') ?? ''), guestEnabled: Boolean(map.get('guest.enabled') ?? true), wallEnabled: Boolean(map.get('wall.enabled') ?? true), voiceEnabled: Boolean(map.get('voice.enabled') ?? true) }; }
};
exports.SiteConfigService = SiteConfigService;
exports.SiteConfigService = SiteConfigService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(site_setting_entity_1.SiteSetting)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SiteConfigService);
//# sourceMappingURL=site-config.service.js.map