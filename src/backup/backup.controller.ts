import {
  Controller,
  Get,
  Post,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { BackupService, BackupFileInfo } from './backup.service';

@ApiTags('Backup')
@ApiBearerAuth()
@Controller('backup')
@UseGuards(AuthGuard, StarCountGuard)
@MinStarCount(3)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  private getTenant(req: any): string {
    return (req.headers['x-tenant'] as string) || 'master';
  }

  @Get('list')
  @ApiOperation({ summary: 'Mevcut backupların listesini getir' })
  @ApiResponse({ status: 200, description: 'Backup listesi' })
  async listBackups(@Request() req): Promise<BackupFileInfo[]> {
    const tenant = this.getTenant(req);
    return this.backupService.listBackups(tenant);
  }

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manuel backup oluştur' })
  @ApiResponse({ status: 200, description: 'Backup oluşturuldu' })
  async createBackup(
    @Request() req,
  ): Promise<{ success: boolean; filename: string; timestamp: string }> {
    const tenant = this.getTenant(req);
    return this.backupService.createBackup(tenant);
  }

  @Post('restore/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Belirtilen backupa geri dön' })
  @ApiResponse({ status: 200, description: 'Sistem geri yüklendi' })
  async restoreBackup(
    @Request() req,
    @Param('id') backupId: string,
  ): Promise<{
    success: boolean;
    message: string;
    restoredCounts: { roles: number; users: number; bots: number; settings: boolean };
  }> {
    const tenant = this.getTenant(req);
    return this.backupService.restoreBackup(tenant, backupId);
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eski backupları temizle (48 saatten eski)' })
  @ApiResponse({ status: 200, description: 'Temizlik tamamlandı' })
  async cleanupBackups(
    @Request() req,
  ): Promise<{ deletedCount: number; message: string }> {
    const tenant = this.getTenant(req);
    return this.backupService.cleanupOldBackups(tenant, 2);
  }
}