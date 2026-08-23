import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RadioSettings } from './entities/radio-settings.entity';
import { RadioSettingsResponseDto } from './dto/radio-settings-response.dto';
import { UpdateRadioSettingsDto } from './dto/update-radio-settings.dto';

@Injectable()
export class RadioSettingsService {
  constructor(
    @InjectRepository(RadioSettings)
    private readonly radioSettingsRepository: Repository<RadioSettings>,
  ) {}

  async getSettings(): Promise<RadioSettingsResponseDto> {
    const settings = await this.getOrCreate();
    return this.toResponse(settings);
  }

  async updateSettings(
    dto: UpdateRadioSettingsDto,
  ): Promise<RadioSettingsResponseDto> {
    const settings = await this.getOrCreate();

    const { id: _ignoreId, ...rest } = dto;
    Object.assign(settings, rest);

    const saved = await this.radioSettingsRepository.save(settings);
    return this.toResponse(saved);
  }

  private async getOrCreate(): Promise<RadioSettings> {
    let settings = await this.radioSettingsRepository.findOne({
      where: { id: 1 },
    });

    if (!settings) {
      settings = this.radioSettingsRepository.create({ id: 1 });
      settings = await this.radioSettingsRepository.save(settings);
    }

    return settings;
  }

  private toResponse(settings: RadioSettings): RadioSettingsResponseDto {
    return {
      id: settings.id,
      radioLink: settings.radioLink ?? null,
      radioRequestLink: settings.radioRequestLink ?? null,
    };
  }
}
