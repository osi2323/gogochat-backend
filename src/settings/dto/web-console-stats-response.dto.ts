import { ApiProperty } from '@nestjs/swagger';

export class WebConsoleStatsListItemDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  count: number;

  @ApiProperty()
  percent: number;
}

export class WebConsoleStatsSummaryDto {
  @ApiProperty()
  registeredUsers: number;

  @ApiProperty()
  registeredLast24Hours: number;

  @ApiProperty()
  staffUsers: number;

  @ApiProperty()
  staffFemaleCount: number;

  @ApiProperty()
  staffMaleCount: number;

  @ApiProperty()
  maleUsers: number;

  @ApiProperty()
  maleActivePercent: number;

  @ApiProperty()
  femaleUsers: number;

  @ApiProperty()
  femaleActivePercent: number;

  @ApiProperty()
  loginsLast30Days: number;

  @ApiProperty()
  loginsLast7Days: number;

  @ApiProperty()
  adminActionsLast30Days: number;

  @ApiProperty()
  adminActionsLast24Hours: number;
}

export class WebConsoleStatsDeviceUsageDto {
  @ApiProperty({ type: [WebConsoleStatsListItemDto] })
  devices: WebConsoleStatsListItemDto[];

  @ApiProperty({ type: [WebConsoleStatsListItemDto] })
  browsers: WebConsoleStatsListItemDto[];
}

export class WebConsoleStatsResponseDto {
  @ApiProperty({ type: WebConsoleStatsSummaryDto })
  summary: WebConsoleStatsSummaryDto;

  @ApiProperty({ type: [WebConsoleStatsListItemDto] })
  topVisitors: WebConsoleStatsListItemDto[];

  @ApiProperty({ type: WebConsoleStatsDeviceUsageDto })
  deviceUsage: WebConsoleStatsDeviceUsageDto;
}
