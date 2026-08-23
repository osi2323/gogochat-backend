export class CheckUsernameResponseDto {
  available: boolean;
  message: string;
  existingUsername?: string;
}
