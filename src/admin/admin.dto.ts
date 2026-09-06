import {IsBoolean,IsInt,IsObject,IsOptional,IsString,Length,Max,Min} from 'class-validator';
export class UpdateRoomDto{@IsOptional()@IsString()@Length(2,48)name?:string;@IsOptional()@IsString()@Length(0,180)description?:string;@IsOptional()@IsBoolean()isLocked?:boolean;@IsOptional()@IsInt()@Min(2)@Max(5000)maxMembers?:number;@IsOptional()@IsInt()@Min(1)@Max(20)maxMicrophones?:number;}
export class UpdateRankDto{@IsOptional()@IsString()@Length(2,40)name?:string;@IsOptional()@IsString()@Length(1,20)starColor?:string;@IsOptional()@IsString()@Length(1,16)icon?:string;@IsOptional()@IsInt()@Min(30)@Max(86400)microphoneDuration?:number;@IsOptional()@IsObject()permissions?:Record<string,boolean>;}
export class SetUserRankDto{@IsInt()@Min(1)@Max(27)starCount!:number;}
export class UpdateSettingDto{@IsString()@Length(2,80)key!:string;value!:unknown;}
export class AdminContentQueryDto{@IsOptional()@IsString()@Length(0,80)q?:string;@IsOptional()@IsInt()@Min(1)@Max(100)limit?:number;}
