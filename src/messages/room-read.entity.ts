import {Column,Entity,PrimaryColumn,UpdateDateColumn} from 'typeorm';
@Entity('room_reads')export class RoomRead{@PrimaryColumn({name:'room_id',type:'uuid'})roomId!:string;@PrimaryColumn({name:'user_id',type:'uuid'})userId!:string;@Column({name:'last_read_message_id',type:'uuid',nullable:true})lastReadMessageId!:string|null;@UpdateDateColumn({name:'last_read_at'})lastReadAt!:Date;}
