import {Column,CreateDateColumn,Entity,Index,JoinColumn,ManyToOne,PrimaryGeneratedColumn} from 'typeorm';
import {User} from './user.entity';
@Entity('auth_sessions')
@Index(['userId','revokedAt'])
export class AuthSession{
 @PrimaryGeneratedColumn('uuid') id!:string;
 @Column({name:'user_id'}) userId!:string;
 @ManyToOne(()=>User,{onDelete:'CASCADE'}) @JoinColumn({name:'user_id'}) user!:User;
 @Column({name:'token_hash',unique:true,length:64}) tokenHash!:string;
 @Column({name:'expires_at',type:'timestamptz'}) expiresAt!:Date;
 @Column({name:'revoked_at',type:'timestamptz',nullable:true}) revokedAt!:Date|null;
 @Column({name:'last_used_at',type:'timestamptz',nullable:true}) lastUsedAt!:Date|null;
 @Column({name:'user_agent',type:'varchar',length:300,nullable:true}) userAgent!:string|null;
 @Column({name:'ip_address',type:'varchar',length:64,nullable:true}) ipAddress!:string|null;
 @CreateDateColumn({name:'created_at'}) createdAt!:Date;
}
