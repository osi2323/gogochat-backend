import {ConnectedSocket,MessageBody,OnGatewayConnection,OnGatewayDisconnect,SubscribeMessage,WebSocketGateway,WebSocketServer} from '@nestjs/websockets';
import {JwtService} from '@nestjs/jwt';
import {Server,Socket} from 'socket.io';
import {MessagesService} from './messages.service';import{PreferencesService}from'../preferences/preferences.service';
import {parseCorsOrigins} from '../config/http-security';

type Ack=(payload:{ok:true;data?:unknown}|{ok:false;error:string})=>void;
type AuthedSocket=Socket&{data:{user?:{id:string;username:string};joinedRooms?:Set<string>}};

@WebSocketGateway({namespace:'/chat',cors:{origin:parseCorsOrigins(process.env.CORS_ORIGINS ?? 'http://localhost:3000'),credentials:true}})
export class ChatGateway implements OnGatewayConnection,OnGatewayDisconnect{
 @WebSocketServer() server!:Server;
 private readonly presence=new Map<string,Map<string,Set<string>>>();
 constructor(private jwt:JwtService,private messages:MessagesService,private prefs:PreferencesService){}
 async handleConnection(client:AuthedSocket){
  try{const raw=String(client.handshake.auth?.token??'');if(!raw)throw new Error();const p=await this.jwt.verifyAsync(raw);client.data.user={id:String(p.sub),username:String(p.username??'')};client.data.joinedRooms=new Set();}
  catch{client.emit('auth:error',{message:'Oturum doğrulanamadı'});client.disconnect(true);}
 }
 handleDisconnect(client:AuthedSocket){for(const roomId of client.data.joinedRooms??[])this.removePresence(roomId,client);}
 @SubscribeMessage('room:join') async join(@ConnectedSocket()client:AuthedSocket,@MessageBody()body:{roomId?:string},ack?:Ack){
  try{const user=this.user(client),roomId=String(body?.roomId??'');await this.messages.assertMember(roomId,user.id);await client.join(this.key(roomId));client.data.joinedRooms?.add(roomId);this.addPresence(roomId,client);const onlineUserIds=await this.visibleOnline(roomId);this.server.to(this.key(roomId)).emit('presence:changed',{roomId,userId:user.id,online:true,onlineUserIds});ack?.({ok:true,data:{onlineUserIds}});}
  catch(e){ack?.({ok:false,error:this.error(e)});}
 }
 @SubscribeMessage('room:leave') async leave(@ConnectedSocket()client:AuthedSocket,@MessageBody()body:{roomId?:string},ack?:Ack){
  try{const roomId=String(body?.roomId??'');await client.leave(this.key(roomId));client.data.joinedRooms?.delete(roomId);this.removePresence(roomId,client);ack?.({ok:true});}catch(e){ack?.({ok:false,error:this.error(e)});}
 }
 @SubscribeMessage('message:send') async send(@ConnectedSocket()client:AuthedSocket,@MessageBody()body:{roomId?:string;body?:string;clientId?:string;replyToId?:string;mediaAssetId?:string},ack?:Ack){
  try{const user=this.user(client),roomId=String(body?.roomId??'');if(!client.data.joinedRooms?.has(roomId))throw new Error('Önce realtime odaya katılmalısın');const message=await this.messages.send(roomId,user.id,String(body?.body??''),String(body?.clientId??''),body?.replyToId,body?.mediaAssetId);this.server.to(this.key(roomId)).emit('message:new',{roomId,message});ack?.({ok:true,data:message});}
  catch(e){ack?.({ok:false,error:this.error(e)});}
 }
 @SubscribeMessage('message:edit') async edit(@ConnectedSocket()client:AuthedSocket,@MessageBody()body:{roomId?:string;messageId?:string;body?:string},ack?:Ack){try{const u=this.user(client),roomId=String(body.roomId??'');if(!client.data.joinedRooms?.has(roomId))throw new Error('Önce realtime odaya katılmalısın');const message=await this.messages.edit(roomId,u.id,String(body.messageId??''),String(body.body??''));this.server.to(this.key(roomId)).emit('message:updated',{roomId,message});ack?.({ok:true,data:message});}catch(e){ack?.({ok:false,error:this.error(e)});}}
 @SubscribeMessage('message:delete') async remove(@ConnectedSocket()client:AuthedSocket,@MessageBody()body:{roomId?:string;messageId?:string;reason?:string},ack?:Ack){try{const u=this.user(client),roomId=String(body.roomId??'');if(!client.data.joinedRooms?.has(roomId))throw new Error('Önce realtime odaya katılmalısın');const result=await this.messages.remove(roomId,u.id,String(body.messageId??''),body.reason);this.server.to(this.key(roomId)).emit('message:deleted',{...result,roomId});ack?.({ok:true,data:result});}catch(e){ack?.({ok:false,error:this.error(e)});}}
 @SubscribeMessage('room:moderate') async moderate(@ConnectedSocket()client:AuthedSocket,@MessageBody()body:{roomId?:string;targetUserId?:string;action?:'mute'|'unmute'|'kick'|'ban'|'unban';durationMinutes?:number;reason?:string},ack?:Ack){try{const u=this.user(client),roomId=String(body.roomId??''),targetUserId=String(body.targetUserId??''),action=body.action;if(!action)throw new Error('Moderasyon işlemi eksik');if(!client.data.joinedRooms?.has(roomId))throw new Error('Önce realtime odaya katılmalısın');const result=await this.messages.moderate(roomId,u.id,targetUserId,action,body.durationMinutes,body.reason);this.server.to(this.key(roomId)).emit('moderation:changed',result);if(result.forceLeave)await this.forceLeave(roomId,targetUserId,action);ack?.({ok:true,data:result});}catch(e){ack?.({ok:false,error:this.error(e)});}}
 @SubscribeMessage('typing:set') async typing(@ConnectedSocket()client:AuthedSocket,@MessageBody()body:{roomId?:string;typing?:boolean}){
  const user=this.user(client),roomId=String(body?.roomId??'');if(!client.data.joinedRooms?.has(roomId))return;client.to(this.key(roomId)).emit('typing:changed',{roomId,userId:user.id,username:user.username,typing:body?.typing===true});
 }
 private async forceLeave(roomId:string,userId:string,action:string){const sockets=await this.server.in(this.key(roomId)).fetchSockets();for(const remote of sockets){const s=remote as unknown as AuthedSocket;if(s.data.user?.id!==userId)continue;await s.leave(this.key(roomId));s.data.joinedRooms?.delete(roomId);this.removePresence(roomId,s);s.emit('room:removed',{roomId,action});}}
 private user(client:AuthedSocket){if(!client.data.user)throw new Error('Oturum doğrulanamadı');return client.data.user;}
 private key(roomId:string){return `room:${roomId}`;}
 private addPresence(roomId:string,client:AuthedSocket){const user=this.user(client);let users=this.presence.get(roomId);if(!users)this.presence.set(roomId,users=new Map());let sockets=users.get(user.id);if(!sockets)users.set(user.id,sockets=new Set());sockets.add(client.id);}
 private async visibleOnline(roomId:string){return this.prefs.visibleOnlineUserIds(this.online(roomId))}
 private removePresence(roomId:string,client:AuthedSocket){const user=client.data.user;if(!user)return;const users=this.presence.get(roomId),sockets=users?.get(user.id);if(!users||!sockets)return;sockets.delete(client.id);if(!sockets.size){users.delete(user.id);void this.visibleOnline(roomId).then(onlineUserIds=>this.server.to(this.key(roomId)).emit('presence:changed',{roomId,userId:user.id,online:false,onlineUserIds}));}if(!users.size)this.presence.delete(roomId);}
 private online(roomId:string){return [...(this.presence.get(roomId)?.keys()??[])];}
 private error(e:unknown){return e instanceof Error?e.message:'İşlem başarısız';}
}
