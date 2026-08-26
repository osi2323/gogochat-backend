import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { SearchHistory } from './entities/search-history.entity';
import { CreateSearchHistoryDto } from './dto/create-search-history.dto';

@Injectable()
export class SearchHistoryService {
  constructor(
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepository: Repository<SearchHistory>,
  ) {}

  async create(
    dto: CreateSearchHistoryDto,
    userId: number,
    username: string,
  ): Promise<SearchHistory | null> {
    const trimmedQuery = dto.query.trim();
    if (!trimmedQuery) {
      return null;
    }

    const safeQuery =
      trimmedQuery.length > 255 ? trimmedQuery.slice(0, 255) : trimmedQuery;

    const searchHistory = this.searchHistoryRepository.create({
      userId,
      username,
      query: safeQuery,
      scope: dto.scope,
      resultsCount: dto.resultsCount ?? null,
    } as DeepPartial<SearchHistory>);

    return await this.searchHistoryRepository.save(searchHistory);
  }
}
