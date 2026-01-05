import {
  Controller,
  UseInterceptors,
  ClassSerializerInterceptor,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { EmailImportSessionsService } from './email-import-sessions.service';
import { ImportExcelDto } from './dto';
import { GetUser } from 'src/decorators/get-user.decorator';

@Controller('email-import-sessions')
@UseInterceptors(ClassSerializerInterceptor)
export class EmailImportSessionsController {
  constructor(
    private readonly emailImportSessionsService: EmailImportSessionsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAllByUser(@GetUser() user: any) {
    return this.emailImportSessionsService.findAllByUserId(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() importExcelDto: ImportExcelDto, @GetUser() user: any) {
    // console.log(importExcelDto);
    return this.emailImportSessionsService.importExcelProcess(
      importExcelDto,
      user,
    );
  }
}
