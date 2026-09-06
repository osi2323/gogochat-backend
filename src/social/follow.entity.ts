import {CreateDateColumn,Entity,PrimaryColumn} from 'typeorm';
@Entity('follows') export class Follow{@PrimaryColumn('uuid',{name:'follower_id'})followerId!:string;@PrimaryColumn('uuid',{name:'following_id'})followingId!:string;@CreateDateColumn({name:'created_at'})createdAt!:Date;}
