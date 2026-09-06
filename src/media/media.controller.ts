import {BadRequestException,Controller,Delete,Param,Post,Query,Req,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';import {FileInterceptor} from '@nestjs/platform-express';import {memoryStorage} from 'multer';import {JwtGuard} from '../auth/jwt.guard';import {MediaService} from './media.service';
const PURPOSES=['avatar','cover','gallery','wall','room','dm'] as const;
@Controller('media')@UseGuards(JwtGuard) export class MediaController{constructor(private media:MediaService){}
 @Post('upload')@UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:15*1024*1024,files:1}})) upload(@Req()req:any,@Query('purpose')purpose:string,@UploadedFile()file:Express.Multer.File){if(!PURPOSES.includes(purpose as any))throw new BadRequestException('Geçersiz medya amacı');return this.media.upload(req.user.id,purpose as any,file);}
 @Delete(':id') remove(@Req()req:any,@Param('id')id:string){return this.media.remove(req.user.id,id);}}
