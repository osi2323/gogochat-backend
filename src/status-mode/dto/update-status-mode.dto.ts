import { PartialType } from '@nestjs/swagger';
import { CreateStatusModeDto } from './create-status-mode.dto';

export class UpdateStatusModeDto extends PartialType(CreateStatusModeDto) {}
