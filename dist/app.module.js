"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const site_config_module_1 = require("./site-config/site-config.module");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const rank_entity_1 = require("./ranks/rank.entity");
const user_entity_1 = require("./auth/user.entity");
const room_entity_1 = require("./rooms/room.entity");
const profile_entity_1 = require("./profiles/profile.entity");
const room_member_entity_1 = require("./messages/room-member.entity");
const message_entity_1 = require("./messages/message.entity");
const messages_module_1 = require("./messages/messages.module");
const ranks_module_1 = require("./ranks/ranks.module");
const rooms_module_1 = require("./rooms/rooms.module");
const auth_module_1 = require("./auth/auth.module");
const social_module_1 = require("./social/social.module");
const dm_module_1 = require("./dm/dm.module");
const notifications_module_1 = require("./notifications/notifications.module");
const media_module_1 = require("./media/media.module");
const voice_module_1 = require("./voice/voice.module");
const admin_module_1 = require("./admin/admin.module");
const preferences_module_1 = require("./preferences/preferences.module");
const health_module_1 = require("./health/health.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({ imports: [typeorm_1.TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, autoLoadEntities: true, synchronize: false }), typeorm_1.TypeOrmModule.forFeature([rank_entity_1.Rank, user_entity_1.User, room_entity_1.Room, profile_entity_1.Profile, room_member_entity_1.RoomMember, message_entity_1.Message]), auth_module_1.AuthModule, ranks_module_1.RanksModule, rooms_module_1.RoomsModule, messages_module_1.MessagesModule, social_module_1.SocialModule, dm_module_1.DmModule, notifications_module_1.NotificationsModule, media_module_1.MediaModule, voice_module_1.VoiceModule, admin_module_1.AdminModule, preferences_module_1.PreferencesModule, site_config_module_1.SiteConfigModule, health_module_1.HealthModule] })
], AppModule);
//# sourceMappingURL=app.module.js.map