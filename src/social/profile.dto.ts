import {IsArray,IsOptional,IsString,MaxLength} from 'class-validator';
export class UpdateProfileDto{@IsOptional()@IsString()@MaxLength(64)displayName?:string;@IsOptional()@IsString()@MaxLength(80)city?:string;@IsOptional()@IsString()@MaxLength(80)country?:string;@IsOptional()@IsString()@MaxLength(500)bio?:string;@IsOptional()@IsArray()@IsString({each:true})interests?:string[];}
