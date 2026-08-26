import { applyDecorators, UseGuards } from '@nestjs/common';
import { SetupModeGuard } from '../guards/setup-mode.guard';

export function RequireSetupMode() {
  return applyDecorators(UseGuards(SetupModeGuard));
}
