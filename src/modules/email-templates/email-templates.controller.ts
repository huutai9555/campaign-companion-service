import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { ClerkAuthGuard } from 'src/auth/clerk-auth.guard';
import { PaginateDto } from 'src/shared/dto/paginate.dto';

@Controller('email-templates')
@UseGuards(ClerkAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Post()
  create(@Body() createDto: CreateEmailTemplateDto, @Request() req: any) {
    return this.emailTemplatesService.create(createDto, req.user);
  }

  @Get()
  findAll(@Request() req: any, @Query() params: PaginateDto) {
    return this.emailTemplatesService.findAll(req.user.id, params);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.emailTemplatesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateEmailTemplateDto,
    @Request() req: any,
  ) {
    return this.emailTemplatesService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.emailTemplatesService.remove(id, req.user.id);
  }
}
