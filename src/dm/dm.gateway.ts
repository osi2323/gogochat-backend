import {ConnectedSocket,MessageBody,OnGatewayConnection,OnGatewayDisconnect,SubscribeMessage,WebSocketGateway,WebSocketServer} from '@nestjs/websockets';
import {JwtService} from '@nestjs/jwt';
import {Server,Socket} from 'socket.io';
import {DmService} from './dm.service';
import {parseCorsOrigins} from '../config/http-security';
type Ack=(p:{ok:true;data?:unknown}|{ok:false;error:string})=>void;
type S=Socket&{data:{user?:{id:string;username:string};dmRooms?:Set<string>}};
@WebSocketGateway({namespace:'/dm',cors:{origin:parseCorsOrigins(process.env.CORS_ORIGINS ?? 'http://localhost:3000'),credentials:true}})
export class DmGateway implements OnGatewayConnection,OnGatewayDisconnect{
 @WebSocketServer() server!:Server;private socketsByUser=new Map<string,Set<string>>();
 constructor(private jwt:JwtService,private dm:DmService){}
 async handleConnection(c:S){try{const token=String(c.handshake.auth?.token??'');const p=await this.jwt.verifyAsync(token);c.data.user={id:String(p.sub),username:String(p.username??'')};c.data.dmRooms=new Set();let set=this.socketsByUser.get(c.data.user.id);if(!set)this.socketsByUser.set(c.data.user.id,set=new Set());set.add(c.id);}catch{c.emit('auth:error',{message:'Oturum doğrulanamadı'});c.disconnect(true)}}
 handleDisconnect(c:S){const id=c.data.user?.id;if(!id)return;const set=this.socketsByUser.get(id);set?.delete(c.id);if(set&&!set.size)this.socketsByUser.delete(id)}
 @SubscribeMessage('dm:join')async join(@ConnectedSocket()c:S,@MessageBody()b:{conversationId?:string},ack?:Ack){try{const id=String(b.conversationId??'');await this.dm.assertMember(this.user(c).id,id);await c.join(this.key(id));c.data.dmRooms?.add(id);ack?.({ok:true});}catch(e){ack?.({ok:false,error:this.err(e)})}}
 @SubscribeMessage('dm:leave')async leave(@ConnectedSocket()c:S,@MessageBody()b:{conversationId?:string},ack?:Ack){const id=String(b.conversationId??'');await c.leave(this.key(id));c.data.dmRooms?.delete(id);ack?.({ok:true})}
 @SubscribeMessage('dm:send')async send(@ConnectedSocket()c:S,@MessageBody()b:{conversationId?:string;clientId?:string;body?:string;mediaAssetId?:string},ack?:Ack){try{const id=String(b.conversationId??'');if(!c.data.dmRooms?.has(id))throw new Error('Önce konuşmaya katılmalısın');const msg=await this.dm.send(this.user(c).id,id,String(b.clientId??''),b.body,b.mediaAssetId);this.server.to(this.key(id)).emit('dm:new',{conversationId:id,message:msg});const peers=await this.dm.memberIds(id);for(const uid of peers.filter(x=>x!==this.user(c).id))for(const sid of this.socketsByUser.get(uid)??[])this.server.to(sid).emit('dm:conversation',{conversationId:id});ack?.({ok:true,data:msg});}catch(e){ack?.({ok:false,error:this.err(e)})}}
 @SubscribeMessage('dm:read')async read(@ConnectedSocket()c:S,@MessageBody()b:{conversationId?:string;messageId?:string},ack?:Ack){try{const id=String(b.conversationId??'');const data=await this.dm.markRead(this.user(c).id,id,String(b.messageId??''));this.server.to(this.key(id)).emit('dm:read',{conversationId:id,userId:this.user(c).id,messageId:data.messageId,readAt:data.readAt});ack?.({ok:true,data});}catch(e){ack?.({ok:false,error:this.err(e)})}}
 private user(c:S){if(!c.data.user)throw new Error('Oturum doğrulanamadı');return c.data.user}private key(id:string){return`dm:${id}`}private err(e:unknown){return e instanceof Error?e.message:'İşlem başarısız'}
}
