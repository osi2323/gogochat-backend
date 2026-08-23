import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class VoiceOfferPayload {
  @IsString()
  @IsNotEmpty()
  room: string;

  @IsString()
  @IsNotEmpty()
  targetUsername: string;

  @IsNotEmpty()
  offer: RTCSessionDescriptionInit;
}

export class VoiceAnswerPayload {
  @IsString()
  @IsNotEmpty()
  room: string;

  @IsString()
  @IsNotEmpty()
  targetUsername: string;

  @IsNotEmpty()
  answer: RTCSessionDescriptionInit;
}

export class VoiceIceCandidatePayload {
  @IsString()
  @IsNotEmpty()
  room: string;

  @IsString()
  @IsNotEmpty()
  targetUsername: string;

  @IsNotEmpty()
  candidate: RTCIceCandidateInit;
}

export class VoiceToggleMutePayload {
  @IsString()
  @IsNotEmpty()
  room: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsBoolean()
  isMuted: boolean;
}

export class VoiceUserStatePayload {
  @IsString()
  @IsNotEmpty()
  room: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsBoolean()
  isInVoiceChat: boolean;

  @IsBoolean()
  @IsOptional()
  isMuted?: boolean;
}

export class VoiceSeatPayload {
  @IsString()
  @IsNotEmpty()
  room: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsInt()
  @Min(0)
  @Max(4)
  @IsOptional()
  seatIndex?: number;
}
