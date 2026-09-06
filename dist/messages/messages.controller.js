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
exports.MessagesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const messages_dto_1 = require("./messages.dto");
const messages_service_1 = require("./messages.service");
let MessagesController = class MessagesController {
    service;
    constructor(service) {
        this.service = service;
    }
    join(roomId, r) { return this.service.join(roomId, r.user.id); }
    members(roomId, r) { return this.service.listMembers(roomId, r.user.id); }
    messages(roomId, r, q) { return this.service.history(roomId, r.user.id, q.limit, q.before); }
    send(roomId, r, d) { return this.service.send(roomId, r.user.id, d.body, d.clientId, d.replyToId, d.mediaAssetId); }
    edit(roomId, messageId, r, d) { return this.service.edit(roomId, r.user.id, messageId, d.body); }
    remove(roomId, messageId, r, d) { return this.service.remove(roomId, r.user.id, messageId, d.reason); }
    moderate(roomId, r, d) { return this.service.moderate(roomId, r.user.id, d.targetUserId, d.action, d.durationMinutes, d.reason); }
    audit(roomId, r, limit) { return this.service.audit(roomId, r.user.id, Number(limit) || 50); }
    read(roomId, r, d) { return this.service.markRead(roomId, r.user.id, d.messageId); }
    unread(roomId, r) { return this.service.unread(roomId, r.user.id); }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, common_1.Post)('join'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "join", null);
__decorate([
    (0, common_1.Get)('members'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "members", null);
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, messages_dto_1.MessageQueryDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)('messages'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, messages_dto_1.SendMessageDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "send", null);
__decorate([
    (0, common_1.Patch)('messages/:messageId'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, messages_dto_1.EditMessageDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "edit", null);
__decorate([
    (0, common_1.Delete)('messages/:messageId'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, messages_dto_1.DeleteMessageDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('moderate'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, messages_dto_1.ModerateUserDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "moderate", null);
__decorate([
    (0, common_1.Get)('audit'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "audit", null);
__decorate([
    (0, common_1.Post)('read'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, messages_dto_1.MarkReadDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "read", null);
__decorate([
    (0, common_1.Get)('unread'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "unread", null);
exports.MessagesController = MessagesController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    (0, common_1.Controller)('rooms/:roomId'),
    __metadata("design:paramtypes", [messages_service_1.MessagesService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map