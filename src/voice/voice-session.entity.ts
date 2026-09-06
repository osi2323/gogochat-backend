import {Column,CreateDateColumn,Entity,Index,PrimaryGeneratedColumn,UpdateDateColumn} from 'typeorm';
@Entity('voice_sessions')
@Index(['roomId','userId'],{unique:true,where:'"ended_at" IS NULL'})
export class VoiceSession{@PrimaryGeneratedColumn('uuid')id!:string;@Column({name:'room_id',type:'uuid'})roomId!:string;@Column({name:'user_id',type:'uuid'})userId!:string;@Column({name:'participant_identity',unique:true})participantIdentity!:string;@Column({name:'started_at',type:'timestamptz'})startedAt!:Date;@Column({name:'expires_at',type:'timestamptz'})expiresAt!:Date;@Column({name:'ended_at',type:'timestamptz',nullable:true})endedAt!:Date|null;@CreateDateColumn({name:'created_at'})createdAt!:Date;@UpdateDateColumn({name:'updated_at'})updatedAt!:Date;}
