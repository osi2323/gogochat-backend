import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SetupModeGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const setupMode = this.configService.get('SETUP_MODE');
    // Check both string 'true' and boolean true
    if (setupMode === 'true' || setupMode === true) {
      return true;
    }
    throw new ForbiddenException(
      'This endpoint is only available in SETUP_MODE',
    );
  }
}
