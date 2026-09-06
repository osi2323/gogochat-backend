import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {SiteSetting} from '../admin/site-setting.entity';

export type PublicSiteConfig={siteName:string;announcement:string;guestEnabled:boolean;wallEnabled:boolean;voiceEnabled:boolean};

@Injectable()
export class SiteConfigService{
 constructor(@InjectRepository(SiteSetting)private settings:Repository<SiteSetting>){}
 private async value<T>(key:string,fallback:T):Promise<T>{const row=await this.settings.findOneBy({key});return row?.value===undefined?fallback:row.value as T}
 async enabled(key:string,fallback=true){return Boolean(await this.value(key,fallback))}
 async publicConfig():Promise<PublicSiteConfig>{const rows=await this.settings.findBy([{key:'site.name'},{key:'site.announcement'},{key:'guest.enabled'},{key:'wall.enabled'},{key:'voice.enabled'}]);const map=new Map(rows.map(r=>[r.key,r.value]));return{siteName:String(map.get('site.name')??'GogoChat'),announcement:String(map.get('site.announcement')??''),guestEnabled:Boolean(map.get('guest.enabled')??true),wallEnabled:Boolean(map.get('wall.enabled')??true),voiceEnabled:Boolean(map.get('voice.enabled')??true)}}
}
