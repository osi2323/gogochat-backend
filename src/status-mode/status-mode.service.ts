import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStatusModeDto } from './dto/create-status-mode.dto';
import { UpdateStatusModeDto } from './dto/update-status-mode.dto';
import { StatusMode } from './entities/status-mode.entity';

@Injectable()
export class StatusModeService {
  constructor(
    @InjectRepository(StatusMode)
    private readonly statusModeRepository: Repository<StatusMode>,
  ) {}

  async create(createStatusModeDto: CreateStatusModeDto): Promise<StatusMode> {
    const existing = await this.statusModeRepository.findOne({
      where: { name: createStatusModeDto.name },
    });

    if (existing) {
      throw new ConflictException('Bu isimde durum modu zaten var');
    }

    const statusMode = this.statusModeRepository.create(createStatusModeDto);
    return this.statusModeRepository.save(statusMode);
  }

  async findAll(): Promise<StatusMode[]> {
    return this.statusModeRepository.find();
  }

  async findOne(id: number): Promise<StatusMode> {
    const statusMode = await this.statusModeRepository.findOne({
      where: { id },
    });

    if (!statusMode) {
      throw new NotFoundException(`Durum modu bulunamadı: ${id}`);
    }

    return statusMode;
  }

  async update(
    id: number,
    updateStatusModeDto: UpdateStatusModeDto,
  ): Promise<StatusMode> {
    const statusMode = await this.findOne(id);

    if (
      updateStatusModeDto.name &&
      updateStatusModeDto.name !== statusMode.name
    ) {
      const existing = await this.statusModeRepository.findOne({
        where: { name: updateStatusModeDto.name },
      });

      if (existing) {
        throw new ConflictException('Bu isimde durum modu zaten var');
      }
    }

    Object.assign(statusMode, updateStatusModeDto);
    return this.statusModeRepository.save(statusMode);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.statusModeRepository.softDelete(id);
  }
}
