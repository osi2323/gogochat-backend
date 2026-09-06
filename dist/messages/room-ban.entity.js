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
exports.RoomBan = void 0;
const typeorm_1 = require("typeorm");
let RoomBan = class RoomBan {
    id;
    roomId;
    userId;
    actorId;
    reason;
    expiresAt;
    createdAt;
};
exports.RoomBan = RoomBan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RoomBan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'room_id', type: 'uuid' }),
    __metadata("design:type", String)
], RoomBan.prototype, "roomId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], RoomBan.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_id', type: 'uuid' }),
    __metadata("design:type", String)
], RoomBan.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reason', length: 500, nullable: true }),
    __metadata("design:type", Object)
], RoomBan.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], RoomBan.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], RoomBan.prototype, "createdAt", void 0);
exports.RoomBan = RoomBan = __decorate([
    (0, typeorm_1.Entity)('room_bans'),
    (0, typeorm_1.Unique)(['roomId', 'userId'])
], RoomBan);
//# sourceMappingURL=room-ban.entity.js.map