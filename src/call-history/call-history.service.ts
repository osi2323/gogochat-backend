import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateCallHistoryDto } from './dto/create-call-history.dto';
import { CallHistoryResponseDto } from './dto/call-history-response.dto';
import { CallHistory } from './entities/call-history.entity';

const DEFAULT_LIMIT = 100;

@Injectable()
export class CallHistoryService {
  constructor(
    @InjectRepository(CallHistory)
    private readonly callHistoryRepository: Repository<CallHistory>,
  ) {}

  async list(
    tenantId: string,
    userId: number,
    agentNickname?: string,
  ): Promise<CallHistoryResponseDto[]> {
    const items = await this.callHistoryRepository.find({
      where: {
        tenantId,
        userId,
        agentNickname: agentNickname ?? '',
        deletedAt: IsNull(),
      },
      order: { startedAt: 'DESC', id: 'DESC' },
      take: DEFAULT_LIMIT,
    });

    return items.map((item) => CallHistoryResponseDto.fromEntity(item));
  }

  async create(
    tenantId: string,
    userId: number,
    agentNickname: string | undefined,
    dto: CreateCallHistoryDto,
  ): Promise<CallHistoryResponseDto> {
    const entity = this.callHistoryRepository.create({
      tenantId,
      userId,
      agentNickname: agentNickname ?? '',
      callId: dto.callId.trim().slice(0, 255),
      peerName: dto.peerName.trim().slice(0, 255),
      direction: dto.direction,
      status: dto.status,
      startedAt: new Date(dto.startedAt),
      endedAt: dto.endedAt ? new Date(dto.endedAt) : null,
      durationSec: dto.durationSec ?? null,
    });

    const saved = await this.callHistoryRepository.save(entity);
    return CallHistoryResponseDto.fromEntity(saved);
  }

  async delete(
    tenantId: string,
    userId: number,
    agentNickname: string | undefined,
    id: number,
  ): Promise<void> {
    const result = await this.callHistoryRepository.softDelete({
      id,
      tenantId,
      userId,
      agentNickname: agentNickname ?? '',
    });

    if (!result.affected) {
      throw new NotFoundException('Çağrı kaydı bulunamadı');
    }
  }
}
