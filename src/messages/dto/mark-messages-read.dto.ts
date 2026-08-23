import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class MarkMessagesReadDto {
  @ApiProperty({
    description: 'Görülen mesaj ID listesi',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  messageIds: number[];
}
