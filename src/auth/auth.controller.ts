import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Request,
  UseGuards,
  Patch,
  Header,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CheckUsernameDto } from './dto/check-username.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CheckUsernameResponseDto } from './dto/check-username-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GuestDto } from './dto/guest.dto';
import { GuestResponseDto } from './dto/guest-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { AuthGuard } from './auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('check-username')
  @HttpCode(HttpStatus.OK)
  async checkUsername(
    @Query() checkUsernameDto: CheckUsernameDto,
  ): Promise<CheckUsernameResponseDto> {
    return this.authService.checkUsername(checkUsernameDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Request() req,
  ): Promise<AuthResponseDto> {
    return this.authService.login(loginDto, req);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req,
  ): Promise<AuthResponseDto> {
    return this.authService.register(registerDto, req);
  }

  @Post('guest')
  @HttpCode(HttpStatus.OK)
  async guest(
    @Body() guestDto: GuestDto,
    @Request() req,
  ): Promise<GuestResponseDto> {
    return this.authService.guest(guestDto, req);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    type: MeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Request() req): Promise<MeResponseDto> {
    const userId = Number(req.user.sub);
    return this.authService.getMe(userId);
  }

  @Patch('change-password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Şifre değiştirme' })
  @ApiResponse({ status: 200, description: 'Şifre değiştirildi' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ status: 'ok' }> {
    const userId = Number(req?.user?.sub);
    await this.authService.changePassword(userId, changePasswordDto);
    return { status: 'ok' };
  }
}
