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
exports.Friendship = void 0;
const typeorm_1 = require("typeorm");
let Friendship = class Friendship {
    id;
    requesterId;
    addresseeId;
    status;
    createdAt;
    updatedAt;
};
exports.Friendship = Friendship;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Friendship.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'requester_id' }),
    __metadata("design:type", String)
], Friendship.prototype, "requesterId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'addressee_id' }),
    __metadata("design:type", String)
], Friendship.prototype, "addresseeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 16, default: 'pending' }),
    __metadata("design:type", String)
], Friendship.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Friendship.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Friendship.prototype, "updatedAt", void 0);
exports.Friendship = Friendship = __decorate([
    (0, typeorm_1.Entity)('friendships')
], Friendship);
//# sourceMappingURL=friendship.entity.js.map