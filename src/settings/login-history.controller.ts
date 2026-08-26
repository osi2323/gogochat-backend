import {
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { LoginHistoryService } from './login-history.service';
import { LoginHistory } from './entities/login-history.entity';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { LoginLocationResponseDto } from './dto/login-location-response.dto';
import { LoginIdentitiesResponseDto } from './dto/login-identities-response.dto';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@Controller('login-history')
@UseGuards(AuthGuard)
export class LoginHistoryController {
  constructor(
    private readonly loginHistoryService: LoginHistoryService,
    private readonly userService: UserService,
  ) {}

  private async ensureLoginHistoryPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') {
      return;
    }

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    const hasAdminPanelPermission = hasPermissionForUser(
      user,
      PERMISSION_LABELS.ADMIN_PANEL,
    );
    if (!hasAdminPanelPermission) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }

    const hasLoginHistoryPermission = hasPermissionForUser(
      user,
      PERMISSION_LABELS.LOGIN_HISTORY,
    );
    if (!hasLoginHistoryPermission) {
      throw new ForbiddenException('Giriş kayıtları görüntüleme yetkiniz yok.');
    }
  }

  private async hasIpViewPermission(req: any): Promise<boolean> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') {
      return true;
    }

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    return hasPermissionForUser(user, PERMISSION_LABELS.IP_VIEW);
  }

  @Get()
  @UseGuards(AuthGuard, StarCountGuard)
  @MinStarCount(1)
  async getAllLoginHistory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<{
    items: LoginHistory[];
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  }> {
    await this.ensureLoginHistoryPermission(req);
    const requesterStarCount: number = req.fullUser?.role?.starCount ?? 0;
    const canViewIp = await this.hasIpViewPermission(req);
    return await this.loginHistoryService.findAllPaginated(
      page,
      limit,
      requesterStarCount,
      canViewIp,
    );
  }

  @Get(':id/location')
  async getLoginLocation(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<LoginLocationResponseDto> {
    await this.ensureLoginHistoryPermission(req);
    const canViewIp = await this.hasIpViewPermission(req);
    if (!canViewIp) {
      throw new ForbiddenException('İp görme yetkiniz yok.');
    }
    return this.loginHistoryService.getLocationByRecordId(id, Number(req.user?.sub));
  }

  @Get(':id/identities')
  async getLoginIdentities(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<LoginIdentitiesResponseDto> {
    await this.ensureLoginHistoryPermission(req);
    const canViewIp = await this.hasIpViewPermission(req);
    if (!canViewIp) {
      throw new ForbiddenException('İp görme yetkiniz yok.');
    }
    return this.loginHistoryService.getIdentitiesByRecordId(
      id,
      Number(req.user?.sub),
    );
  }
}
