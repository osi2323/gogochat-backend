import type { CallHistory } from '../entities/call-history.entity';

export class CallHistoryResponseDto {
  id: number;
  callId: string;
  peerName: string;
  direction: 'incoming' | 'outgoing';
  status: 'missed' | 'completed' | 'rejected' | 'canceled';
  startedAt: string;
  endedAt?: string | null;
  durationSec?: number | null;

  static fromEntity(entity: CallHistory): CallHistoryResponseDto {
    return {
      id: entity.id,
      callId: entity.callId,
      peerName: entity.peerName,
      direction: entity.direction,
      status: entity.status,
      startedAt: entity.startedAt.toISOString(),
      endedAt: entity.endedAt ? entity.endedAt.toISOString() : null,
      durationSec: entity.durationSec ?? null,
    };
  }
}
