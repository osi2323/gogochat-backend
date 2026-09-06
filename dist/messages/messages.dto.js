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
exports.ModerateUserDto = exports.DeleteMessageDto = exports.EditMessageDto = exports.MarkReadDto = exports.MessageQueryDto = exports.SendMessageDto = exports.JoinRoomDto = void 0;
const class_validator_1 = require("class-validator");
class JoinRoomDto {
}
exports.JoinRoomDto = JoinRoomDto;
class SendMessageDto {
    body;
    clientId;
    replyToId;
    mediaAssetId;
}
exports.SendMessageDto = SendMessageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 4000),
    __metadata("design:type", String)
], SendMessageDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "replyToId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "mediaAssetId", void 0);
class MessageQueryDto {
    before;
    limit = 50;
}
exports.MessageQueryDto = MessageQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MessageQueryDto.prototype, "before", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], MessageQueryDto.prototype, "limit", void 0);
class MarkReadDto {
    messageId;
}
exports.MarkReadDto = MarkReadDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MarkReadDto.prototype, "messageId", void 0);
class EditMessageDto {
    body;
}
exports.EditMessageDto = EditMessageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 4000),
    __metadata("design:type", String)
], EditMessageDto.prototype, "body", void 0);
class DeleteMessageDto {
    reason;
}
exports.DeleteMessageDto = DeleteMessageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], DeleteMessageDto.prototype, "reason", void 0);
class ModerateUserDto {
    targetUserId;
    action;
    durationMinutes;
    reason;
}
exports.ModerateUserDto = ModerateUserDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ModerateUserDto.prototype, "targetUserId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['mute', 'unmute', 'kick', 'ban', 'unban']),
    __metadata("design:type", String)
], ModerateUserDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10080),
    __metadata("design:type", Number)
], ModerateUserDto.prototype, "durationMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], ModerateUserDto.prototype, "reason", void 0);
//# sourceMappingURL=messages.dto.js.map