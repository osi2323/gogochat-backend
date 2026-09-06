import {Body,Controller,ForbiddenException,Get,Post,Req,Res,UseGuards} from '@nestjs/common';
import type {Request,Response} from 'express';
import {AuthService} from './auth.service';
import {GuestDto,LoginDto,RegisterDto} from './auth.dto';
import {JwtGuard} from './jwt.guard';
import {parseCorsOrigins} from '../config/http-security';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private meta(req: Request) {
    return {userAgent: req.headers['user-agent'], ip: req.ip};
  }

  private cookieOptions() {
    const production = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true as const,
      secure: production,
      // REST auth is proxied through the frontend origin in production, so the
      // refresh cookie remains first-party and does not depend on third-party cookies.
      sameSite: 'lax' as const,
      path: '/api/auth',
    };
  }

  private cookie(res: Response, token: string, expiresAt: Date) {
    res.cookie('gogo_refresh', token, {...this.cookieOptions(), expires: expiresAt});
  }

  private clear(res: Response) {
    res.clearCookie('gogo_refresh', this.cookieOptions());
  }

  private raw(req: Request) {
    const cookie = String(req.headers.cookie ?? '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('gogo_refresh='));
    return cookie ? decodeURIComponent(cookie.slice('gogo_refresh='.length)) : undefined;
  }

  /**
   * Refresh/logout are cookie-authenticated. In production the refresh cookie is
   * proxied through the frontend origin. Mutation endpoints still reject browser
   * requests from untrusted origins as defense in depth.
   * Non-browser clients without Origin are still allowed.
   */
  private assertTrustedOrigin(req: Request) {
    const origin = req.headers.origin;
    if (!origin) return;
    const allowed = parseCorsOrigins(process.env.CORS_ORIGINS ?? 'http://localhost:3000');
    if (!allowed.includes(origin)) throw new ForbiddenException('Untrusted request origin');
  }

  private async establish(promise: Promise<any>, res: Response) {
    const result = await promise;
    this.cookie(res, result.refreshToken, result.refreshExpiresAt);
    return {accessToken: result.accessToken, user: result.user};
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request, @Res({passthrough: true}) res: Response) {
    this.assertTrustedOrigin(req);
    return this.establish(this.auth.register(dto.username, dto.password, this.meta(req)), res);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request, @Res({passthrough: true}) res: Response) {
    this.assertTrustedOrigin(req);
    return this.establish(this.auth.login(dto.username, dto.password, this.meta(req)), res);
  }

  @Post('guest')
  guest(@Body() dto: GuestDto, @Req() req: Request, @Res({passthrough: true}) res: Response) {
    this.assertTrustedOrigin(req);
    return this.establish(this.auth.guest(dto.nickname, this.meta(req)), res);
  }

  @Post('refresh')
  refresh(@Req() req: Request, @Res({passthrough: true}) res: Response) {
    this.assertTrustedOrigin(req);
    return this.establish(this.auth.refresh(this.raw(req), this.meta(req)), res);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({passthrough: true}) res: Response) {
    this.assertTrustedOrigin(req);
    const result = await this.auth.logout(this.raw(req));
    this.clear(res);
    return result;
  }

  @UseGuards(JwtGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.auth.me(req.user.id);
  }
}
