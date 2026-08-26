import { Gender } from '../../common/enums/gender.enum';

export class FriendUserDto {
  id: number;
  username: string;
  displayUsername?: string | null;
  agentNickname?: string | null;
  gender: Gender;
  icon?: string | null;
  frame?: string | null;
  roleName?: string | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
  userGif?: string | null;
}
