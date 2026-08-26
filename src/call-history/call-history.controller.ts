import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../user/entities/user.entity';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';
import { CallHistoryService } from './call-history.service';
import { CreateCallHistoryDto } from './dto/create-call-history.dto';

@ApiTags('CallHistory')
@Controller('call-history')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CallHistoryController {
  constructor(
    private readonly callHistoryService: CallHistoryService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async getAgentNickname(req: any): Promise<string | undefined> {
    const raw = req?.headers?.['x-agent-nickname'];
    if (typeof raw !== 'string') return undefined;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    const normalized = decoded.trim();
    if (!normalized.length) return undefined;

    const normalizedUsername = String(req?.user?.username ?? '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') {
      return normalized;
    }

    const userId = Number(req?.user?.sub);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!hasPermissionForUser(user, PERMISSION_LABELS.SECRET_NICKNAME_LOGIN)) {
      return undefined;
    }

    return normalized;
  }

  @Get()
  @ApiOperation({ summary: 'Mevcut kullanıcının çağrı geçmişini listele' })
  async list(@Request() req) {
    const userId = Number(req.user.sub);
    const tenantId = String(req.tenant);
    const agentNickname = await this.getAgentNickname(req);
    return this.callHistoryService.list(tenantId, userId, agentNickname);
  }

  @Post()
  @ApiOperation({ summary: 'Çağrı geçmişi kaydı oluştur' })
  async create(@Request() req, @Body() dto: CreateCallHistoryDto) {
    const userId = Number(req.user.sub);
    const tenantId = String(req.tenant);
    const agentNickname = await this.getAgentNickname(req);
    return this.callHistoryService.create(tenantId, userId, agentNickname, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mevcut kullanıcının çağrı geçmişi kaydını sil' })
  async delete(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user.sub);
    const tenantId = String(req.tenant);
    const agentNickname = await this.getAgentNickname(req);
    await this.callHistoryService.delete(tenantId, userId, agentNickname, id);
    return { deleted: true };
  }
}
