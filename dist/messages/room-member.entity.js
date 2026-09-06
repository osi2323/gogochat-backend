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
exports.RoomMember = void 0;
const typeorm_1 = require("typeorm");
let RoomMember = class RoomMember {
    id;
    roomId;
    userId;
    mutedUntil;
    joinedAt;
};
exports.RoomMember = RoomMember;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RoomMember.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'room_id', type: 'uuid' }),
    __metadata("design:type", String)
], RoomMember.prototype, "roomId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], RoomMember.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'muted_until', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], RoomMember.prototype, "mutedUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'joined_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], RoomMember.prototype, "joinedAt", void 0);
exports.RoomMember = RoomMember = __decorate([
    (0, typeorm_1.Entity)('room_members'),
    (0, typeorm_1.Unique)(['roomId', 'userId'])
], RoomMember);
//# sourceMappingURL=room-member.entity.js.map