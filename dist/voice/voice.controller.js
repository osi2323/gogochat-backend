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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const jwt_guard_1 = require("../auth/jwt.guard");
const voice_service_1 = require("./voice.service");
class VoiceRemoveDto {
    targetUserId;
    reason;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], VoiceRemoveDto.prototype, "targetUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], VoiceRemoveDto.prototype, "reason", void 0);
let VoiceController = class VoiceController {
    voice;
    constructor(voice) {
        this.voice = voice;
    }
    token(roomId, req) { return this.voice.issue(roomId, req.user.id); }
    leave(roomId, req) { return this.voice.leave(roomId, req.user.id); }
    status(roomId, req) { return this.voice.status(roomId, req.user.id); }
    participants(roomId, req) { return this.voice.participants(roomId, req.user.id); }
    remove(roomId, req, body) { return this.voice.forceLeave(roomId, req.user.id, body.targetUserId, body.reason); }
};
exports.VoiceController = VoiceController;
__decorate([
    (0, common_1.Post)(':roomId/token'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VoiceController.prototype, "token", null);
__decorate([
    (0, common_1.Post)(':roomId/leave'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VoiceController.prototype, "leave", null);
__decorate([
    (0, common_1.Get)(':roomId/status'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VoiceController.prototype, "status", null);
__decorate([
    (0, common_1.Get)(':roomId/participants'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VoiceController.prototype, "participants", null);
__decorate([
    (0, common_1.Post)(':roomId/remove'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, VoiceRemoveDto]),
    __metadata("design:returntype", void 0)
], VoiceController.prototype, "remove", null);
exports.VoiceController = VoiceController = __decorate([
    (0, common_1.Controller)('voice'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    __metadata("design:paramtypes", [voice_service_1.VoiceService])
], VoiceController);
//# sourceMappingURL=voice.controller.js.map