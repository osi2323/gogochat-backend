"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const site_config_module_1 = require("../site-config/site-config.module");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const user_entity_1 = require("./user.entity");
const auth_session_entity_1 = require("./auth-session.entity");
const rank_entity_1 = require("../ranks/rank.entity");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const jwt_guard_1 = require("./jwt.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({ imports: [site_config_module_1.SiteConfigModule, typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, rank_entity_1.Rank, auth_session_entity_1.AuthSession]), jwt_1.JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '15m' } })], controllers: [auth_controller_1.AuthController], providers: [auth_service_1.AuthService, jwt_guard_1.JwtGuard], exports: [auth_service_1.AuthService, jwt_guard_1.JwtGuard, jwt_1.JwtModule] })
], AuthModule);
//# sourceMappingURL=auth.module.js.map