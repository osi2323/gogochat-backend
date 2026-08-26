export class LoginIpIdentityDto {
  displayName: string;
  username: string;
  agentNickname: string | null;
  isGuest: boolean;
  role: string | null;
  lastLoginDate: string;
}

export class LoginIdentitiesResponseDto {
  loginHistoryId: number;
  ipAddress: string;
  identities: LoginIpIdentityDto[];
}
