"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialModule = void 0;
const site_config_module_1 = require("../site-config/site-config.module");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../auth/user.entity");
const profile_entity_1 = require("../profiles/profile.entity");
const follow_entity_1 = require("./follow.entity");
const friendship_entity_1 = require("./friendship.entity");
const social_controller_1 = require("./social.controller");
const social_service_1 = require("./social.service");
const wall_entity_1 = require("./wall.entity");
const wall_service_1 = require("./wall.service");
const wall_controller_1 = require("./wall.controller");
const notifications_module_1 = require("../notifications/notifications.module");
const media_module_1 = require("../media/media.module");
let SocialModule = class SocialModule {
};
exports.SocialModule = SocialModule;
exports.SocialModule = SocialModule = __decorate([
    (0, common_1.Module)({ imports: [site_config_module_1.SiteConfigModule, notifications_module_1.NotificationsModule, media_module_1.MediaModule, typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, profile_entity_1.Profile, follow_entity_1.Follow, friendship_entity_1.Friendship, wall_entity_1.WallPost, wall_entity_1.WallComment, wall_entity_1.WallLike])], controllers: [social_controller_1.SocialController, wall_controller_1.WallController], providers: [social_service_1.SocialService, wall_service_1.WallService], exports: [social_service_1.SocialService] })
], SocialModule);
//# sourceMappingURL=social.module.js.map