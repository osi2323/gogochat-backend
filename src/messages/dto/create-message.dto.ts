import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { MessageType } from '../enums/message-type.enum';

export class CreateMessageDto {
  @ApiPropertyOptional({ description: 'Mesaj içeriği' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Mesaj tipi',
    enum: MessageType,
    default: MessageType.NORMAL,
  })
  @IsEnum(MessageType)
  type: MessageType;

  @ApiProperty({ description: 'Oda adı' })
  @IsNotEmpty()
  @IsString()
  roomName: string;

  @ApiPropertyOptional({
    description: 'Yanıt verilen mesaj ID (sadece type=reply ise gerekli)',
  })
  @IsOptional()
  @IsNumber()
  replyToMessageId?: number;

  @ApiPropertyOptional({ description: 'Resim base64 verisi' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Ses base64 verisi' })
  @IsOptional()
  @IsString()
  audio?: string;

  @ApiPropertyOptional({ description: 'Ses dosyası adı' })
  @IsOptional()
  @IsString()
  audioFileName?: string;

  @ApiPropertyOptional({ description: 'Mesaj yazı rengi' })
  @IsOptional()
  @IsString()
  fontColor?: string;

  @ApiPropertyOptional({ description: 'Mesaj hedef kitlesi' })
  @IsOptional()
  @IsString()
  targetGroup?: string;
}
