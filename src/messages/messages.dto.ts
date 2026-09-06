import {IsIn,IsInt,IsOptional,IsString,IsUUID,Length,Max,Min} from 'class-validator';
export class JoinRoomDto{}
export class SendMessageDto{@IsOptional()@IsString()@Length(0,4000) body?:string;@IsUUID() clientId!:string;@IsOptional()@IsUUID() replyToId?:string;@IsOptional()@IsUUID() mediaAssetId?:string;}
export class MessageQueryDto{@IsOptional()@IsUUID() before?:string;@IsOptional()@IsInt()@Min(1)@Max(100) limit:number=50;}
export class MarkReadDto{@IsUUID() messageId!:string;}

export class EditMessageDto{@IsString()@Length(1,4000) body!:string;}
export class DeleteMessageDto{@IsOptional()@IsString()@Length(1,500) reason?:string;}

export class ModerateUserDto{@IsUUID() targetUserId!:string;@IsIn(['mute','unmute','kick','ban','unban']) action!:'mute'|'unmute'|'kick'|'ban'|'unban';@IsOptional()@IsInt()@Min(1)@Max(10080) durationMinutes?:number;@IsOptional()@IsString()@Length(1,500) reason?:string;}
