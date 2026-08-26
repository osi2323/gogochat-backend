import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { User } from '../user/entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private convertPermissions(permissions: Record<string, boolean>): string[] {
    return Object.entries(permissions)
      .filter(([_, value]) => value === true)
      .map(([key]) => key);
  }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const existingRole = await this.roleRepository.findOne({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new ConflictException('Role with this name already exists');
    }

    const role = this.roleRepository.create(createRoleDto);
    return this.roleRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  async findLowerThanStarCount(starCount: number): Promise<Role[]> {
    return this.roleRepository.find({
      where: { starCount: LessThan(starCount) },
      order: { starCount: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: updateRoleDto.name },
      });

      if (existingRole) {
        throw new ConflictException('Role with this name already exists');
      }
    }

    Object.assign(role, updateRoleDto);
    const updatedRole = await this.roleRepository.save(role);

    const hasPermissionsInPayload = Object.prototype.hasOwnProperty.call(
      updateRoleDto,
      'permissions',
    );

    if (hasPermissionsInPayload) {
      const userPermissions = this.convertPermissions(updatedRole.permissions);
      await this.userRepository.update(
        { roleId: id },
        { permissions: userPermissions },
      );
    }

    return updatedRole;
  }

  async remove(id: number): Promise<void> {
    const role = await this.findOne(id);
    await this.roleRepository.softDelete(id);
  }
}
