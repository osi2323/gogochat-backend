import {Column,Entity,JoinColumn,ManyToOne,PrimaryGeneratedColumn} from 'typeorm';import {Rank} from '../ranks/rank.entity';
@Entity('users') export class User{@PrimaryGeneratedColumn('uuid') id!:string;@Column({unique:true,length:32}) username!:string;@Column({name:'password_hash',type:'varchar',nullable:true}) passwordHash!:string|null;@Column({name:'is_guest',default:false}) isGuest!:boolean;@Column({name:'rank_id'}) rankId!:string;@ManyToOne(()=>Rank,{eager:true})@JoinColumn({name:'rank_id'}) rank!:Rank;}

