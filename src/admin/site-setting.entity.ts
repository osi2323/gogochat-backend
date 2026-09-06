import {Column,Entity,PrimaryColumn,UpdateDateColumn} from 'typeorm';
@Entity('site_settings') export class SiteSetting{@PrimaryColumn({length:80})key!:string;@Column({type:'jsonb'})value!:unknown;@UpdateDateColumn({name:'updated_at'})updatedAt!:Date;}
