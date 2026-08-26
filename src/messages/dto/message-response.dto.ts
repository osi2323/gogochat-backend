import { MessageType } from '../enums/message-type.enum';

export class MessageUserDto {
  id: number;
  username: string;
  displayUsername?: string;
  agentNickname?: string | null;
  gender: string;
  isGuest: boolean;
  icon: string | null;
  fontName?: string | null;
  granite?: string | null;
  nickColor?: string | null;
  flashNick?: string | null;
  role: {
    id: number;
    name: string;
    starCount: number;
    starColor: string;
    icon: string | null;
  } | null;
}

export class ReplyToMessageDto {
  id: number;
  content: string;
  user: MessageUserDto;
  createdAt: Date;
}

export class MessageResponseDto {
  id: number;
  content: string;
  type: MessageType;
  userId: number | null;
  user: MessageUserDto;
  roomId: number;
  replyToMessageId: number | null;
  replyToMessage: ReplyToMessageDto | null;
  image: string | null;
  audio: string | null;
  audioFileName: string | null;
  fontColor: string | null;
  targetGroup: string | null;
  botId?: number | null;
  botUsername?: string | null;
  botSpeakerUsername?: string | null;
  botSpeakerDisplayName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
