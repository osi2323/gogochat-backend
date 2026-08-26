import { Body, Controller, Delete, Get, Post, Patch } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';
import { RequireSetupMode } from '../common/decorators/require-setup-mode.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantDto } from './dto/tenant.dto';
import { CreateRoomDto } from '../rooms/dto/create-room.dto';
import { RoomResponseDto } from '../rooms/dto/room-response.dto';
import { SeedDefaultRolesDto } from './dto/seed-default-roles.dto';
import { SeedDefaultRoomsDto } from './dto/seed-default-rooms.dto';

@ApiTags('Tenant Admin')
@RequireSetupMode()
@Controller('admin/tenants')
export class TenantAdminController {
  constructor(private service: TenantAdminService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant and initialize schema' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Tenant already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not in SETUP_MODE)' })
  create(@Body() dto: TenantDto) {
    return this.service.createTenant(dto.tenant);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete an existing tenant and drop schema' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 400, description: 'Tenant does not exist' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not in SETUP_MODE)' })
  delete(@Body() dto: TenantDto) {
    return this.service.deleteTenant(dto.tenant);
  }

  @Get()
  @ApiOperation({ summary: 'List all existing tenants' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not in SETUP_MODE)' })
  list() {
    return this.service.listTenants();
  }

  @Post('rooms')
  @ApiOperation({
    summary: 'Setup modundayken master tenant içinde yeni oda oluştur',
  })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  createRoom(@Body() dto: CreateRoomDto): Promise<RoomResponseDto> {
    return this.service.createRoomInMaster(dto);
  }

  @Patch('default-roles')
  @ApiOperation({
    summary: 'Belirtilen şemaya default rolleri yükler',
  })
  @ApiResponse({ status: 200, description: 'Default roles seeded' })
  @ApiResponse({ status: 404, description: 'Tenant schema not found' })
  seedDefaultRoles(@Body() dto: SeedDefaultRolesDto) {
    return this.service.seedDefaultRoles(dto.schema);
  }

  @Patch('default-rooms')
  @ApiOperation({
    summary: 'Belirtilen şemaya default odaları yükler',
  })
  @ApiResponse({ status: 200, description: 'Default rooms seeded' })
  @ApiResponse({ status: 404, description: 'Tenant schema not found' })
  seedDefaultRooms(@Body() dto: SeedDefaultRoomsDto) {
    return this.service.seedDefaultRooms(dto.schema);
  }
}
