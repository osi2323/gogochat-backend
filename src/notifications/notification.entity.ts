import {Column,CreateDateColumn,Entity,Index,PrimaryGeneratedColumn} from 'typeorm';
@Entity('notifications')
@Index(['userId','createdAt'])
export class Notification{
 @PrimaryGeneratedColumn('uuid') id!:string;
 @Column({name:'user_id',type:'uuid'}) userId!:string;
 @Column({name:'actor_id',type:'uuid',nullable:true}) actorId!:string|null;
 @Column({length:40}) type!:string;
 @Column({type:'jsonb',default:()=>"'{}'::jsonb"}) data!:Record<string,unknown>;
 @Column({name:'read_at',type:'timestamptz',nullable:true}) readAt!:Date|null;
 @CreateDateColumn({name:'created_at'}) createdAt!:Date;
}
