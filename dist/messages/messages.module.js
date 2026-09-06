"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const room_entity_1 = require("../rooms/room.entity");
const room_member_entity_1 = require("./room-member.entity");
const room_read_entity_1 = require("./room-read.entity");
const message_entity_1 = require("./message.entity");
const user_entity_1 = require("../auth/user.entity");
const messages_controller_1 = require("./messages.controller");
const messages_service_1 = require("./messages.service");
const chat_gateway_1 = require("./chat.gateway");
const moderation_audit_entity_1 = require("./moderation-audit.entity");
const room_ban_entity_1 = require("./room-ban.entity");
const auth_module_1 = require("../auth/auth.module");
const media_module_1 = require("../media/media.module");
const preferences_module_1 = require("../preferences/preferences.module");
let MessagesModule = class MessagesModule {
};
exports.MessagesModule = MessagesModule;
exports.MessagesModule = MessagesModule = __decorate([
    (0, common_1.Module)({ imports: [typeorm_1.TypeOrmModule.forFeature([room_entity_1.Room, room_member_entity_1.RoomMember, message_entity_1.Message, room_read_entity_1.RoomRead, user_entity_1.User, moderation_audit_entity_1.ModerationAudit, room_ban_entity_1.RoomBan]), auth_module_1.AuthModule, media_module_1.MediaModule, preferences_module_1.PreferencesModule], controllers: [messages_controller_1.MessagesController], providers: [messages_service_1.MessagesService, chat_gateway_1.ChatGateway], exports: [messages_service_1.MessagesService] })
], MessagesModule);
//# sourceMappingURL=messages.module.js.map