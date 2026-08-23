import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { RadioSettingsService } from './radio-settings.service';
import { RadioSettingsResponseDto } from './dto/radio-settings-response.dto';
import { UpdateRadioSettingsDto } from './dto/update-radio-settings.dto';
import { Public } from '../common/decorators/public.decorator';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('radio-settings')
@UseGuards(AuthGuard, StarCountGuard)
@MinStarCount(3)
export class RadioSettingsController {
  constructor(
    private readonly radioSettingsService: RadioSettingsService,
    private readonly userService: UserService,
  ) {}

  private async ensureAdminPanelPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;
    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Radyo ayarlarını getir (Public)' })
  @ApiResponse({ status: 200, type: RadioSettingsResponseDto })
  getSettings(): Promise<RadioSettingsResponseDto> {
    return this.radioSettingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: 'Radyo ayarlarını güncelle' })
  @ApiResponse({ status: 200, type: RadioSettingsResponseDto })
  async updateSettings(
    @Request() req,
    @Body() dto: UpdateRadioSettingsDto,
  ): Promise<RadioSettingsResponseDto> {
    await this.ensureAdminPanelPermission(req);
    return this.radioSettingsService.updateSettings(dto);
  }
}
