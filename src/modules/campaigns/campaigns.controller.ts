import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  Req,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
@UseInterceptors(ClassSerializerInterceptor)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCampaignDto: CreateCampaignDto, @Req() req: any) {
    const campaign = await this.campaignsService.create(
      createCampaignDto,
      req.user,
    );
    return campaign;
  }

  @Get()
  async findAll(@Query('clerkUserId') clerkUserId?: string) {
    const campaigns = await this.campaignsService.findAll(clerkUserId);
    return campaigns;
  }

  @Get('/queue')
  async getQueue(@Query('clerkUserId') clerkUserId?: string) {
    const campaigns = await this.campaignsService.getQueueReport(clerkUserId);
    return campaigns;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const campaign = await this.campaignsService.findOne(id);
    return campaign;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    const campaign = await this.campaignsService.update(id, updateCampaignDto);
    return campaign;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.campaignsService.remove(id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async start(@Param('id') id: string) {
    const campaign = await this.campaignsService.start(id);
    return campaign;
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pause(@Param('id') id: string) {
    const campaign = await this.campaignsService.pause(id);
    return campaign;
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  async resume(@Param('id') id: string) {
    const campaign = await this.campaignsService.resume(id);
    return campaign;
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string) {
    const campaign = await this.campaignsService.complete(id);
    return campaign;
  }

  @Post(':id/send-test')
  @HttpCode(HttpStatus.OK)
  async sendTest(@Param('id') id: string, @Body('email') email: string) {
    return this.campaignsService.sendTestEmail(id, email);
  }
}
