import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenNickname } from './entities/forbidden-nickname.entity';
import { CreateForbiddenNicknameDto } from './dto/create-forbidden-nickname.dto';
import { ForbiddenNicknameResponseDto } from './dto/forbidden-nickname-response.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class ForbiddenNicknamesService {
  constructor(
    @InjectRepository(ForbiddenNickname)
    private readonly forbiddenNicknameRepository: Repository<ForbiddenNickname>,
    private readonly userService: UserService,
  ) {}

  async create(
    createDto: CreateForbiddenNicknameDto,
    createdById?: number,
  ): Promise<ForbiddenNicknameResponseDto> {
    if (!createdById) {
      throw new UnauthorizedException('Geçersiz kullanıcı bilgisi');
    }

    // Soft deleted kayıtları da dahil et
    const existing = await this.forbiddenNicknameRepository.findOne({
      where: { nickname: createDto.nickname },
      withDeleted: true,
    });

    if (existing) {
      if (!existing.deletedAt) {
        // Aktif kayıt varsa hata ver
        throw new ConflictException('Bu yasaklı nick zaten ekli');
      } else {
        // Soft deleted kayıt varsa restore et
        await this.forbiddenNicknameRepository.restore(existing.id);
        const restored = await this.forbiddenNicknameRepository.findOne({
          where: { id: existing.id },
          relations: ['createdBy'],
        });

        if (!restored) {
          throw new NotFoundException('Yasaklı nick geri yüklenemedi');
        }

        return this.toResponse(restored, restored.createdBy?.username);
      }
    }

    const creator = await this.userService.findById(createdById);
    if (!creator) {
      throw new NotFoundException('Admin bulunamadı');
    }

    const entity = this.forbiddenNicknameRepository.create({
      nickname: createDto.nickname,
      createdById,
    });

    const saved = await this.forbiddenNicknameRepository.save(entity);
    return this.toResponse(saved, creator.username);
  }

  async findAll(): Promise<ForbiddenNicknameResponseDto[]> {
    const items = await this.forbiddenNicknameRepository.find({
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        nickname: true,
        createdAt: true,
        createdBy: {
          id: true,
          username: true,
        },
      },
    });

    return items.map((item) => this.toResponse(item, item.createdBy?.username));
  }

  async findEntityById(id: number): Promise<ForbiddenNickname | null> {
    return this.forbiddenNicknameRepository.findOne({ where: { id } });
  }

  async findByNickname(nickname: string): Promise<ForbiddenNickname | null> {
    return this.forbiddenNicknameRepository.findOne({
      where: { nickname },
    });
  }

  async remove(id: number): Promise<void> {
    const existing = await this.forbiddenNicknameRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Yasaklı nick bulunamadı');
    }

    await this.forbiddenNicknameRepository.softDelete(id);
  }

  private toResponse(
    forbiddenNickname: ForbiddenNickname,
    createdByUsername?: string,
  ): ForbiddenNicknameResponseDto {
    return {
      id: forbiddenNickname.id,
      nickname: forbiddenNickname.nickname,
      createdById: forbiddenNickname.createdById ?? null,
      createdByUsername: createdByUsername ?? null,
      createdAt: forbiddenNickname.createdAt,
    };
  }
}
