import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { Account } from '../../entities/accounts.entity';
import { EmailProvidersService } from 'src/providers/email-providers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  controllers: [AccountsController],
  providers: [AccountsService, EmailProvidersService],
  exports: [AccountsService],
})
export class AccountsModule {}
