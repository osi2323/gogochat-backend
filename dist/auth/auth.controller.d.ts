import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GuestDto, LoginDto, RegisterDto } from './auth.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    private meta;
    private cookieOptions;
    private cookie;
    private clear;
    private raw;
    private assertTrustedOrigin;
    private establish;
    register(dto: RegisterDto, req: Request, res: Response): Promise<{
        accessToken: any;
        user: any;
    }>;
    login(dto: LoginDto, req: Request, res: Response): Promise<{
        accessToken: any;
        user: any;
    }>;
    guest(dto: GuestDto, req: Request, res: Response): Promise<{
        accessToken: any;
        user: any;
    }>;
    refresh(req: Request, res: Response): Promise<{
        accessToken: any;
        user: any;
    }>;
    logout(req: Request, res: Response): Promise<{
        ok: boolean;
    }>;
    me(req: any): Promise<{
        id: string;
        username: string;
        isGuest: boolean;
        rank: import("../ranks/rank.entity").Rank;
    }>;
}
