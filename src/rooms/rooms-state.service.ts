import { Injectable } from '@nestjs/common';

type RoomMember = {
  socketId: string;
  userId?: number;
  roomId?: number;
  username: string;
  gender: 'male' | 'female';
  isGuest: boolean;
  tenantId?: string;
  isInVoiceChat?: boolean;
  isMuted?: boolean;
  isInVoiceSeat?: boolean;
  voiceSeatJoinedAt?: number;
  voiceSeatIndex?: number;
  isHandRaised?: boolean;
  handRaisedAt?: number;
  statusModeId?: number;
  statusModeName?: string;
  roleName?: string;
  roleStarColor?: string;
  roleStarCount?: number;
  roleIcon?: string;
  frame?: string;
  icon?: string;
  fontName?: string;
  granite?: string;
  nickColor?: string;
  userGif?: string;
  flashNick?: string;
  joinEffect?: string;
  agentNickname?: string;
  deviceType?: string;
  device?: string;
  clientType?: string;
  isBot?: boolean;
  isAI?: boolean;
  micBanned?: boolean;
  micBannedByStarCount?: number;
  cameraBanned?: boolean;
  cameraBannedByStarCount?: number;
  roomMuted?: boolean;
  roomMutedByStarCount?: number;
  globalMuted?: boolean;
  globalMutedByStarCount?: number;
  rejectRoomInvites?: boolean;
};

@Injectable()
export class RoomsStateService {
  private static readonly sharedRooms = new Map<
    string,
    Map<string, RoomMember>
  >();
  private static readonly sharedRoomNames = new Map<string, string>();
  private static readonly sharedSocketRooms = new Map<string, Set<string>>();
  private static readonly sharedActiveCalls = new Map<
    string,
    {
      callId: string;
      callType: 'voice' | 'video';
      tenantId: string;
      callerUsername: string;
      targetUsername: string;
      callerSocketId: string;
      targetSocketId: string;
      status: 'ringing' | 'active' | 'ended';
      createdAt: number;
      acceptedAt?: number;
      timeoutId?: NodeJS.Timeout;
    }
  >();
  private static readonly sharedUserActiveCalls = new Map<string, string>();

  readonly rooms = RoomsStateService.sharedRooms;
  readonly roomNames = RoomsStateService.sharedRoomNames;
  readonly socketRooms = RoomsStateService.sharedSocketRooms;
  readonly activeCalls = RoomsStateService.sharedActiveCalls;
  readonly userActiveCalls = RoomsStateService.sharedUserActiveCalls;
}
