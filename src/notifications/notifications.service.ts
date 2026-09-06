import {Injectable,NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {IsNull,Repository} from 'typeorm';
import {Notification} from './notification.entity';import{PreferencesService}from'../preferences/preferences.service';
@Injectable() export class NotificationsService{
 constructor(@InjectRepository(Notification) private repo:Repository<Notification>,private prefs:PreferencesService){}
 async create(userId:string,type:string,actorId:string|null,data:Record<string,unknown>={}){if(userId===actorId)return null;if(!await this.prefs.notificationEnabled(userId,type))return null;return this.repo.save(this.repo.create({userId,type,actorId,data,readAt:null}));}
 async list(userId:string,before?:string){let q=this.repo.createQueryBuilder('n').where('n.userId=:userId',{userId}).orderBy('n.createdAt','DESC').addOrderBy('n.id','DESC').take(40);if(before){const c=await this.repo.findOneBy({id:before,userId});if(c)q=q.andWhere('(n.createdAt < :d OR (n.createdAt=:d AND n.id<:id))',{d:c.createdAt,id:c.id});}const items=await q.getMany();return{items,nextCursor:items.length===40?items.at(-1)!.id:null,unreadCount:await this.repo.countBy({userId,readAt:IsNull()})};}
 unreadCount(userId:string){return this.repo.countBy({userId,readAt:IsNull()});}
 async read(userId:string,id:string){const n=await this.repo.findOneBy({id,userId});if(!n)throw new NotFoundException('Bildirim bulunamadı');if(!n.readAt){n.readAt=new Date();await this.repo.save(n);}return{ok:true,readAt:n.readAt};}
 async readAll(userId:string){await this.repo.createQueryBuilder().update(Notification).set({readAt:new Date()}).where('user_id=:userId AND read_at IS NULL',{userId}).execute();return{ok:true};}
}
