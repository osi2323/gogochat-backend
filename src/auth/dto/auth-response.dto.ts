export class AuthResponseDto {
  id: number;
  username: string;
  gender: string;
  frame?: string | null;
  createdAt: Date;
  accessToken: string;
  loginHistoryId?: number;
}
