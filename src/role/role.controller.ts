import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { AuthGuard } from '../auth/auth.guard';
import { UserService } from '../user/user.service';
import { RoomsGateway } from '../rooms/rooms.gateway';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Roles')
@Controller('roles')
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly userService: UserService,
    private readonly roomsGateway: RoomsGateway,
  ) {}

  private async ensureRoleManagementPermission(req: any): Promise<void> {
    const username = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (username === 'root') {
      return;
    }

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ROLE_MANAGEMENT)) {
      throw new ForbiddenException('Rütbe yönetimi yetkiniz yok.');
    }
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Role with this name already exists',
  })
  async create(@Request() req, @Body() createRoleDto: CreateRoleDto): Promise<Role> {
    await this.ensureRoleManagementPermission(req);
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'List of all roles' })
  async findAll(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Get('lower-than-me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get roles with fewer stars than current user' })
  @ApiResponse({ status: 200, description: 'Roles filtered by star count' })
  async findLowerThanMe(@Request() req): Promise<Role[]> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername !== 'root') {
      const panelUser = await this.userService.findById(Number(req?.user?.sub));
      if (!hasPermissionForUser(panelUser, PERMISSION_LABELS.ADMIN_PANEL)) {
        throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
      }
    }

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);

    if (!user || !user.role) {
      throw new ForbiddenException('Rol bilgisi bulunamadı');
    }

    return this.roleService.findLowerThanStarCount(user.role.starCount);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiResponse({ status: 200, description: 'Role found' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Role> {
    return this.roleService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 409,
    description: 'Role with this name already exists',
  })
  async update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<Role> {
    await this.ensureRoleManagementPermission(req);
    const existingRole = await this.roleService.findOne(id);
    const role = await this.roleService.update(id, updateRoleDto);

    // Broadcast the update to all connected users
    this.roomsGateway.updateRoleInAllUsers({
      id: role.id,
      name: role.name,
      previousName: existingRole?.name,
      starColor: role.starColor,
      starCount: role.starCount,
      icon: role.icon,
    });

    return role;
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 204, description: 'Role deleted successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async remove(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.ensureRoleManagementPermission(req);
    return this.roleService.remove(id);
  }
}
