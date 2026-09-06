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
exports.ModerationAudit = void 0;
const typeorm_1 = require("typeorm");
let ModerationAudit = class ModerationAudit {
    id;
    actorId;
    targetUserId;
    roomId;
    messageId;
    action;
    reason;
    metadata;
    createdAt;
};
exports.ModerationAudit = ModerationAudit;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ModerationAudit.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_id', type: 'uuid' }),
    __metadata("design:type", String)
], ModerationAudit.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'target_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ModerationAudit.prototype, "targetUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'room_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ModerationAudit.prototype, "roomId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'message_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ModerationAudit.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 40 }),
    __metadata("design:type", String)
], ModerationAudit.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500, nullable: true }),
    __metadata("design:type", Object)
], ModerationAudit.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], ModerationAudit.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ModerationAudit.prototype, "createdAt", void 0);
exports.ModerationAudit = ModerationAudit = __decorate([
    (0, typeorm_1.Entity)('moderation_audit_logs')
], ModerationAudit);
//# sourceMappingURL=moderation-audit.entity.js.map