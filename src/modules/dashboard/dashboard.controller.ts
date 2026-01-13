import {
  Controller,
  Get,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  DashboardResponseDto,
  DashboardStatsDto,
} from './dto/dashboard-response.dto';
import { GetUser } from 'src/decorators/get-user.decorator';

@Controller('dashboard')
@UseInterceptors(ClassSerializerInterceptor)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getStats(@GetUser() user: any): Promise<DashboardResponseDto> {
    return this.dashboardService.getStats(user.id);
  }

  @Get('stats')
  async getStatsByDateRange(
    @Query('clerkUserId') clerkUserId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<DashboardStatsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.dashboardService.getStatsByDateRange(clerkUserId, start, end);
  }
}
