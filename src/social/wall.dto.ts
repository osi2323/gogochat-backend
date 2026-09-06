import {IsOptional,IsString,IsUUID,MaxLength,MinLength} from 'class-validator';
export class CreateWallPostDto{@IsOptional()@IsString()@MaxLength(2000)body?:string;@IsOptional()@IsUUID()mediaAssetId?:string}
export class CreateWallCommentDto{@IsString()@MinLength(1)@MaxLength(1000)body!:string}

export class UpdateWallPostDto{@IsString()@MinLength(1)@MaxLength(2000)body!:string}
