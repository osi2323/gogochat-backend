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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreference = void 0;
const typeorm_1 = require("typeorm");
let UserPreference = class UserPreference {
    userId;
    allowPrivateMessages;
    allowVoiceCalls;
    allowVideoCalls;
    showOnlineStatus;
    notifyDm;
    notifyFriend;
    notifyFollow;
    notifyWall;
    compactMessages;
    reduceMotion;
    soundEnabled;
    language;
    updatedAt;
};
exports.UserPreference = UserPreference;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid', { name: 'user_id' }),
    __metadata("design:type", String)
], UserPreference.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allow_private_messages', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "allowPrivateMessages", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allow_voice_calls', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "allowVoiceCalls", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allow_video_calls', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "allowVideoCalls", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'show_online_status', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "showOnlineStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notify_dm', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "notifyDm", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notify_friend', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "notifyFriend", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notify_follow', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "notifyFollow", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notify_wall', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "notifyWall", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'compact_messages', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "compactMessages", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reduce_motion', default: false }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "reduceMotion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sound_enabled', default: true }),
    __metadata("design:type", Boolean)
], UserPreference.prototype, "soundEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 8, default: 'tr' }),
    __metadata("design:type", String)
], UserPreference.prototype, "language", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserPreference.prototype, "updatedAt", void 0);
exports.UserPreference = UserPreference = __decorate([
    (0, typeorm_1.Entity)('user_preferences')
], UserPreference);
//# sourceMappingURL=user-preference.entity.js.map