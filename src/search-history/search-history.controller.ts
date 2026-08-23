import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CreateSearchHistoryDto } from './dto/create-search-history.dto';
import { SearchHistoryService } from './search-history.service';

@ApiTags('SearchHistory')
@Controller('search-history')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class SearchHistoryController {
  constructor(private readonly searchHistoryService: SearchHistoryService) {}

  @Post()
  @ApiOperation({ summary: 'Arama kaydı oluştur' })
  async create(@Request() req, @Body() dto: CreateSearchHistoryDto) {
    const userId = Number(req.user.sub);
    const username = String(req.user.username || '');
    return await this.searchHistoryService.create(dto, userId, username);
  }
}
