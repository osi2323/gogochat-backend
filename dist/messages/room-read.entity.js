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
exports.RoomRead = void 0;
const typeorm_1 = require("typeorm");
let RoomRead = class RoomRead {
    roomId;
    userId;
    lastReadMessageId;
    lastReadAt;
};
exports.RoomRead = RoomRead;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'room_id', type: 'uuid' }),
    __metadata("design:type", String)
], RoomRead.prototype, "roomId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], RoomRead.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_read_message_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], RoomRead.prototype, "lastReadMessageId", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'last_read_at' }),
    __metadata("design:type", Date)
], RoomRead.prototype, "lastReadAt", void 0);
exports.RoomRead = RoomRead = __decorate([
    (0, typeorm_1.Entity)('room_reads')
], RoomRead);
//# sourceMappingURL=room-read.entity.js.map