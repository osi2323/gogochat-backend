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
exports.AuthSession = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let AuthSession = class AuthSession {
    id;
    userId;
    user;
    tokenHash;
    expiresAt;
    revokedAt;
    lastUsedAt;
    userAgent;
    ipAddress;
    createdAt;
};
exports.AuthSession = AuthSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AuthSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AuthSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], AuthSession.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_hash', unique: true, length: 64 }),
    __metadata("design:type", String)
], AuthSession.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], AuthSession.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'revoked_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], AuthSession.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_used_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], AuthSession.prototype, "lastUsedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_agent', type: 'varchar', length: 300, nullable: true }),
    __metadata("design:type", Object)
], AuthSession.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ip_address', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], AuthSession.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AuthSession.prototype, "createdAt", void 0);
exports.AuthSession = AuthSession = __decorate([
    (0, typeorm_1.Entity)('auth_sessions'),
    (0, typeorm_1.Index)(['userId', 'revokedAt'])
], AuthSession);
//# sourceMappingURL=auth-session.entity.js.map