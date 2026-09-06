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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const auth_dto_1 = require("./auth.dto");
const jwt_guard_1 = require("./jwt.guard");
const http_security_1 = require("../config/http-security");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    meta(req) {
        return { userAgent: req.headers['user-agent'], ip: req.ip };
    }
    cookieOptions() {
        const production = process.env.NODE_ENV === 'production';
        return {
            httpOnly: true,
            secure: production,
            sameSite: 'lax',
            path: '/api/auth',
        };
    }
    cookie(res, token, expiresAt) {
        res.cookie('gogo_refresh', token, { ...this.cookieOptions(), expires: expiresAt });
    }
    clear(res) {
        res.clearCookie('gogo_refresh', this.cookieOptions());
    }
    raw(req) {
        const cookie = String(req.headers.cookie ?? '')
            .split(';')
            .map((x) => x.trim())
            .find((x) => x.startsWith('gogo_refresh='));
        return cookie ? decodeURIComponent(cookie.slice('gogo_refresh='.length)) : undefined;
    }
    assertTrustedOrigin(req) {
        const origin = req.headers.origin;
        if (!origin)
            return;
        const allowed = (0, http_security_1.parseCorsOrigins)(process.env.CORS_ORIGINS ?? 'http://localhost:3000');
        if (!allowed.includes(origin))
            throw new common_1.ForbiddenException('Untrusted request origin');
    }
    async establish(promise, res) {
        const result = await promise;
        this.cookie(res, result.refreshToken, result.refreshExpiresAt);
        return { accessToken: result.accessToken, user: result.user };
    }
    register(dto, req, res) {
        this.assertTrustedOrigin(req);
        return this.establish(this.auth.register(dto.username, dto.password, this.meta(req)), res);
    }
    login(dto, req, res) {
        this.assertTrustedOrigin(req);
        return this.establish(this.auth.login(dto.username, dto.password, this.meta(req)), res);
    }
    guest(dto, req, res) {
        this.assertTrustedOrigin(req);
        return this.establish(this.auth.guest(dto.nickname, this.meta(req)), res);
    }
    refresh(req, res) {
        this.assertTrustedOrigin(req);
        return this.establish(this.auth.refresh(this.raw(req), this.meta(req)), res);
    }
    async logout(req, res) {
        this.assertTrustedOrigin(req);
        const result = await this.auth.logout(this.raw(req));
        this.clear(res);
        return result;
    }
    me(req) {
        return this.auth.me(req.user.id);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('guest'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.GuestDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "guest", null);
__decorate([
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map