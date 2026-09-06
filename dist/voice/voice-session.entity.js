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
exports.VoiceSession = void 0;
const typeorm_1 = require("typeorm");
let VoiceSession = class VoiceSession {
    id;
    roomId;
    userId;
    participantIdentity;
    startedAt;
    expiresAt;
    endedAt;
    createdAt;
    updatedAt;
};
exports.VoiceSession = VoiceSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VoiceSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'room_id', type: 'uuid' }),
    __metadata("design:type", String)
], VoiceSession.prototype, "roomId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], VoiceSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'participant_identity', unique: true }),
    __metadata("design:type", String)
], VoiceSession.prototype, "participantIdentity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], VoiceSession.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], VoiceSession.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ended_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], VoiceSession.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], VoiceSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], VoiceSession.prototype, "updatedAt", void 0);
exports.VoiceSession = VoiceSession = __decorate([
    (0, typeorm_1.Entity)('voice_sessions'),
    (0, typeorm_1.Index)(['roomId', 'userId'], { unique: true, where: '"ended_at" IS NULL' })
], VoiceSession);
//# sourceMappingURL=voice-session.entity.js.map