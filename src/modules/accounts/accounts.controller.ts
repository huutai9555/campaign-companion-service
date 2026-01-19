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
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { GetUser } from 'src/decorators/get-user.decorator';
import { PaginateDto } from 'src/shared/dto/paginate.dto';

@Controller('accounts')
@UseInterceptors(ClassSerializerInterceptor)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createAccountDto: CreateAccountDto,
    @GetUser() user: any,
  ) {
    const account = await this.accountsService.create(createAccountDto, user);
    return account;
  }

  @Get()
  async findAll(@Query() params: PaginateDto, @GetUser() user: any) {
    const accounts = await this.accountsService.findAll(user.id, params);
    return accounts;
  }

  @Get('active')
  async getActiveAccounts(@Query('clerkUserId') clerkUserId?: string) {
    const accounts = await this.accountsService.getActiveAccounts(clerkUserId);
    return accounts;
  }

  @Get('available')
  async getAvailableAccounts(@Query('clerkUserId') clerkUserId?: string) {
    const accounts =
      await this.accountsService.getAvailableAccounts(clerkUserId);
    return accounts;
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @GetUser() user: any) {
    const account = await this.accountsService.findOne(id, user);
    return account;
  }

  @Get(':id/credentials')
  async getCredentials(@Param('id') id: string, @GetUser() user: any) {
    return this.accountsService.getCredentials(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @GetUser() user: any,
  ) {
    const account = await this.accountsService.update(
      id,
      updateAccountDto,
      user,
    );
    return account;
  }

  @Patch(':id/increment-sent')
  @HttpCode(HttpStatus.OK)
  async incrementSent(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body('count') count?: number,
  ) {
    const account = await this.accountsService.incrementSentToday(
      id,
      count,
      user,
    );
    return account;
  }

  @Patch(':id/reset-counter')
  @HttpCode(HttpStatus.OK)
  async resetCounter(@Param('id') id: string, @GetUser() user: any) {
    const account = await this.accountsService.resetDailyCounter(id, user);
    return account;
  }

  @Post('reset-all-counters')
  @HttpCode(HttpStatus.OK)
  async resetAllCounters() {
    await this.accountsService.resetAllDailyCounters();
    return { message: 'All daily counters have been reset' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @GetUser() user: any) {
    await this.accountsService.remove(id, user);
  }
}
