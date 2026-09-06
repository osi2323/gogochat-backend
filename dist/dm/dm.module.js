"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DmModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../auth/user.entity");
const dm_entity_1 = require("./dm.entity");
const dm_controller_1 = require("./dm.controller");
const dm_service_1 = require("./dm.service");
const dm_gateway_1 = require("./dm.gateway");
const auth_module_1 = require("../auth/auth.module");
const media_module_1 = require("../media/media.module");
const preferences_module_1 = require("../preferences/preferences.module");
const notifications_module_1 = require("../notifications/notifications.module");
let DmModule = class DmModule {
};
exports.DmModule = DmModule;
exports.DmModule = DmModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, media_module_1.MediaModule, preferences_module_1.PreferencesModule, notifications_module_1.NotificationsModule, typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, dm_entity_1.DirectConversation, dm_entity_1.DirectConversationMember, dm_entity_1.DirectMessage])], controllers: [dm_controller_1.DmController], providers: [dm_service_1.DmService, dm_gateway_1.DmGateway] })
], DmModule);
//# sourceMappingURL=dm.module.js.map