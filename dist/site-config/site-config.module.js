"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteConfigModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const site_setting_entity_1 = require("../admin/site-setting.entity");
const site_config_controller_1 = require("./site-config.controller");
const site_config_service_1 = require("./site-config.service");
let SiteConfigModule = class SiteConfigModule {
};
exports.SiteConfigModule = SiteConfigModule;
exports.SiteConfigModule = SiteConfigModule = __decorate([
    (0, common_1.Module)({ imports: [typeorm_1.TypeOrmModule.forFeature([site_setting_entity_1.SiteSetting])], controllers: [site_config_controller_1.SiteConfigController], providers: [site_config_service_1.SiteConfigService], exports: [site_config_service_1.SiteConfigService] })
], SiteConfigModule);
//# sourceMappingURL=site-config.module.js.map