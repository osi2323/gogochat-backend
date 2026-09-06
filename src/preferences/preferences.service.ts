import{Injectable}from'@nestjs/common';import{InjectRepository}from'@nestjs/typeorm';import{In,Repository}from'typeorm';import{UserPreference}from'./user-preference.entity';import{UpdatePreferencesDto}from'./preferences.dto';
@Injectable()export class PreferencesService{constructor(@InjectRepository(UserPreference)private repo:Repository<UserPreference>){}
 async get(userId:string){let p=await this.repo.findOneBy({userId});if(!p)p=await this.repo.save(this.repo.create({userId}));return p}
 async update(userId:string,d:UpdatePreferencesDto){const p=await this.get(userId);Object.assign(p,d);return this.repo.save(p)}
 async publicPrivacy(userId:string){const p=await this.get(userId);return{allowPrivateMessages:p.allowPrivateMessages,allowVoiceCalls:p.allowVoiceCalls,allowVideoCalls:p.allowVideoCalls,showOnlineStatus:p.showOnlineStatus}}
 async canReceiveDm(userId:string){return(await this.get(userId)).allowPrivateMessages}
 async canUseVoice(userId:string){return(await this.get(userId)).allowVoiceCalls}
 async notificationEnabled(userId:string,type:string){const p=await this.get(userId);if(type.startsWith('dm.'))return p.notifyDm;if(type.startsWith('friend.'))return p.notifyFriend;if(type.startsWith('follow.')||type.startsWith('social.follow'))return p.notifyFollow;if(type.startsWith('wall.'))return p.notifyWall;return true}
 async visibleOnlineUserIds(ids:string[]){if(!ids.length)return[];const rows=await this.repo.find({where:{userId:In(ids)}});const hidden=new Set(rows.filter(x=>!x.showOnlineStatus).map(x=>x.userId));return ids.filter(id=>!hidden.has(id))}
}
