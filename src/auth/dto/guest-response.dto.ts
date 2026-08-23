import { Gender } from '../../common/enums/gender.enum';

export class GuestResponseDto {
  id: number;
  accessToken: string;
  username: string;
  gender: Gender;
  isGuest: boolean;
  loginHistoryId?: number;
}
