import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenWord } from './entities/forbidden-word.entity';
import { CreateForbiddenWordDto } from './dto/create-forbidden-word.dto';
import { UserService } from '../user/user.service';
import { ForbiddenWordResponseDto } from './dto/forbidden-word-response.dto';

@Injectable()
export class ForbiddenWordsService {
  constructor(
    @InjectRepository(ForbiddenWord)
    private readonly forbiddenWordRepository: Repository<ForbiddenWord>,
    private readonly userService: UserService,
  ) {}

  async create(
    createForbiddenWordDto: CreateForbiddenWordDto,
    createdById?: number,
  ): Promise<ForbiddenWordResponseDto> {
    if (!createdById) {
      throw new UnauthorizedException('Geçersiz kullanıcı bilgisi');
    }

    // Soft deleted kayıtları da dahil et
    const existing = await this.forbiddenWordRepository.findOne({
      where: { forbiddenWord: createForbiddenWordDto.forbiddenWord },
      withDeleted: true,
    });

    if (existing) {
      if (!existing.deletedAt) {
        // Aktif kayıt varsa hata ver
        throw new ConflictException('Bu yasaklı kelime zaten ekli');
      } else {
        // Soft deleted kayıt varsa yeni karşılığıyla restore et
        await this.forbiddenWordRepository.update(existing.id, {
          replacementWord: createForbiddenWordDto.replacementWord,
          createdById,
        });
        await this.forbiddenWordRepository.restore(existing.id);
        const restored = await this.forbiddenWordRepository.findOne({
          where: { id: existing.id },
          relations: ['createdBy'],
        });

        if (!restored) {
          throw new NotFoundException('Yasaklı kelime geri yüklenemedi');
        }

        return this.toResponse(restored);
      }
    }

    const creator = await this.userService.findById(createdById);
    if (!creator) {
      throw new NotFoundException('Admin bulunamadı');
    }

    const forbiddenWord = this.forbiddenWordRepository.create({
      forbiddenWord: createForbiddenWordDto.forbiddenWord,
      replacementWord: createForbiddenWordDto.replacementWord,
      createdById,
    });

    const saved = await this.forbiddenWordRepository.save(forbiddenWord);

    return this.findOneById(saved.id);
  }

  async findAll(): Promise<ForbiddenWordResponseDto[]> {
    const items = await this.forbiddenWordRepository.find({
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        forbiddenWord: true,
        replacementWord: true,
        createdAt: true,
        createdBy: {
          id: true,
          username: true,
        },
      },
    });

    return items.map((item) => this.toResponse(item));
  }

  async findEntityById(id: number): Promise<ForbiddenWord | null> {
    return this.forbiddenWordRepository.findOne({ where: { id } });
  }

  async remove(id: number): Promise<void> {
    const existing = await this.forbiddenWordRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Yasaklı kelime bulunamadı');
    }

    await this.forbiddenWordRepository.softDelete(id);
  }

  private async findOneById(id: number): Promise<ForbiddenWordResponseDto> {
    const item = await this.forbiddenWordRepository.findOne({
      where: { id },
      relations: ['createdBy'],
      select: {
        id: true,
        forbiddenWord: true,
        replacementWord: true,
        createdAt: true,
        createdBy: {
          id: true,
          username: true,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Yasaklı kelime bulunamadı');
    }

    return this.toResponse(item);
  }

  private toResponse(forbiddenWord: ForbiddenWord): ForbiddenWordResponseDto {
    return {
      id: forbiddenWord.id,
      forbiddenWord: forbiddenWord.forbiddenWord,
      replacementWord: forbiddenWord.replacementWord,
      createdAt: forbiddenWord.createdAt,
      createdBy: forbiddenWord.createdBy
        ? {
            id: forbiddenWord.createdBy.id,
            username: forbiddenWord.createdBy.username,
          }
        : null,
    };
  }
}
