import {IsString,Length,Matches} from 'class-validator';
export class RegisterDto { @IsString() @Length(3,32) @Matches(/^[\p{L}\p{N}_.-]+$/u) username!: string; @IsString() @Length(8,128) password!: string; }
export class LoginDto { @IsString() @Length(3,32) username!: string; @IsString() @Length(8,128) password!: string; }
export class GuestDto { @IsString() @Length(3,24) @Matches(/^[\p{L}\p{N}_.-]+$/u) nickname!: string; }
