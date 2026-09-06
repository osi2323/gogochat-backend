import {Column,CreateDateColumn,DeleteDateColumn,Entity,PrimaryGeneratedColumn} from 'typeorm';
@Entity('media_assets') export class MediaAsset{
 @PrimaryGeneratedColumn('uuid') id!:string;
 @Column({name:'owner_id',type:'uuid'}) ownerId!:string;
 @Column({length:24}) purpose!:'avatar'|'cover'|'gallery'|'wall'|'room'|'dm';
 @Column({name:'storage_key',type:'text',unique:true}) storageKey!:string;
 @Column({name:'public_url',type:'text'}) publicUrl!:string;
 @Column({name:'mime_type',length:80}) mimeType!:string;
 @Column({name:'size_bytes',type:'int'}) sizeBytes!:number;
 @Column({name:'attached_kind',type:'varchar',length:24,nullable:true}) attachedKind!:string|null;
 @Column({name:'attached_id',type:'uuid',nullable:true}) attachedId!:string|null;
 @Column({name:'attached_at',type:'timestamptz',nullable:true}) attachedAt!:Date|null;
 @CreateDateColumn({name:'created_at'}) createdAt!:Date;
 @DeleteDateColumn({name:'deleted_at',nullable:true}) deletedAt!:Date|null;
}

