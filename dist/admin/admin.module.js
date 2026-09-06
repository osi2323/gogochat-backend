"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("../auth/auth.module");
const user_entity_1 = require("../auth/user.entity");
const rank_entity_1 = require("../ranks/rank.entity");
const room_entity_1 = require("../rooms/room.entity");
const message_entity_1 = require("../messages/message.entity");
const moderation_audit_entity_1 = require("../messages/moderation-audit.entity");
const site_setting_entity_1 = require("./site-setting.entity");
const wall_entity_1 = require("../social/wall.entity");
const admin_controller_1 = require("./admin.controller");
const admin_service_1 = require("./admin.service");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({ imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, rank_entity_1.Rank, room_entity_1.Room, message_entity_1.Message, moderation_audit_entity_1.ModerationAudit, site_setting_entity_1.SiteSetting, wall_entity_1.WallPost, wall_entity_1.WallComment]), auth_module_1.AuthModule], controllers: [admin_controller_1.AdminController], providers: [admin_service_1.AdminService] })
], AdminModule);
//# sourceMappingURL=admin.module.js.map