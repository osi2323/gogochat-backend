import { FriendRequestStatus } from '../entities/friend-request.entity';
import { FriendUserDto } from './friend-user.dto';

export class FriendRequestResponseDto {
  id: number;
  requesterId: number;
  addresseeId: number;
  status: FriendRequestStatus;
  user: FriendUserDto;
  createdAt: Date;
  updatedAt: Date;
}
