import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Account, AccountStatus } from '../../entities/accounts.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { EmailProvidersService } from 'src/providers/email-providers.service';
import { PaginateDto } from 'src/shared/dto/paginate.dto';
import { QueryBuilder } from 'src/helpers/query-builder';
import { paginate, Pagination } from 'nestjs-typeorm-paginate';

@Injectable()
export class AccountsService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly configService: ConfigService,
    private readonly emailProvidersService: EmailProvidersService,
    // @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {
    // Get encryption key from environment (32 bytes = 64 hex chars)
    this.encryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    if (this.encryptionKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
  }

  async create(createAccountDto: CreateAccountDto, user: any): Promise<any> {
    const existEmail = await this.accountRepository.findOne({
      where: {
        email: createAccountDto.email,
      },
    });
    if (existEmail) {
      throw new Error('Email is existed');
    }

    const account = this.accountRepository.create({
      clerkUserId: user.id,
      name: createAccountDto.name,
      email: createAccountDto.email,
      provider: createAccountDto.provider,
      isActive: createAccountDto.isActive ?? true,
      status: createAccountDto.status ?? AccountStatus.ACTIVE,
    });

    // Encrypt credentials
    account.setCredentials(createAccountDto.credentials, this.encryptionKey);
    return this.accountRepository.save(account);
  }

  async findAll(
    clerkUserId: string,
    params: PaginateDto,
  ): Promise<Account[] | Pagination<Account>> {
    const { filter, page, size, sort } = params;
    const queryBuilder = new QueryBuilder();

    const query = this.accountRepository.createQueryBuilder('account');
    // console.log(clerkUserId)
    if (clerkUserId) {
      query.where('account.clerkUserId = :clerkUserId', { clerkUserId });
    }

    if (filter) {
      query.andWhere(queryBuilder.whereBuilder(JSON.parse(filter), 'account'));
    }

    if (sort) {
      queryBuilder.buildOrderBy(query, JSON.parse(sort), 'account');
    }

    if (size) {
      return paginate(query, { page, limit: size });
    }

    return await query.getMany();
  }

  async findOne(id: string, user: any): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id, clerkUserId: user.id },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async findByClerkUserId(clerkUserId: string): Promise<Account[]> {
    return this.accountRepository.find({
      where: { clerkUserId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateAccountDto: UpdateAccountDto,
    user,
  ): Promise<Account> {
    const account = await this.findOne(id, user);

    // Update basic fields
    if (updateAccountDto.name) account.name = updateAccountDto.name;
    if (updateAccountDto.email) account.email = updateAccountDto.email;
    if (updateAccountDto.sentToday !== undefined)
      account.sentToday = updateAccountDto.sentToday;
    if (updateAccountDto.isActive !== undefined)
      account.isActive = updateAccountDto.isActive;
    if (updateAccountDto.status) account.status = updateAccountDto.status;
    if (updateAccountDto.dailyLimit)
      account.dailyLimit = updateAccountDto.dailyLimit;
    if (updateAccountDto.maxPerHour)
      account.maxPerHour = updateAccountDto.maxPerHour;
    if (updateAccountDto.delayBetweenEmailsFrom)
      account.delayBetweenEmailsFrom = updateAccountDto.delayBetweenEmailsFrom;
    if (updateAccountDto.delayBetweenEmailsTo)
      account.delayBetweenEmailsTo = updateAccountDto.delayBetweenEmailsTo;

    // Update credentials if provided
    if (updateAccountDto.credentials) {
      account.setCredentials(updateAccountDto.credentials, this.encryptionKey);
    }

    return this.accountRepository.save(account);
  }

  async remove(id: string, user: any): Promise<void> {
    const account = await this.findOne(id, user);
    await this.accountRepository.remove(account);
  }

  async incrementSentToday(
    id: string,
    count: number = 1,
    user: any,
  ): Promise<Account> {
    const account = await this.findOne(id, user);

    account.sentToday += count;

    // Check if exceeded daily limit
    if (account.sentToday > account.dailyLimit) {
      throw new BadRequestException(
        `Account ${account.name} has exceeded daily limit of ${account.dailyLimit}`,
      );
    }

    return this.accountRepository.save(account);
  }

  async resetDailyCounter(id: string, user: any): Promise<Account> {
    const account = await this.findOne(id, user);

    account.sentToday = 0;
    account.lastResetDate = new Date();

    return this.accountRepository.save(account);
  }

  async resetAllDailyCounters(): Promise<void> {
    await this.accountRepository
      .createQueryBuilder()
      .update(Account)
      .set({
        sentToday: 0,
        lastResetDate: new Date(),
      })
      .execute();
  }

  async getActiveAccounts(clerkUserId?: string): Promise<Account[]> {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .where('account.isActive = :isActive', { isActive: true });

    if (clerkUserId) {
      query.andWhere('account.clerkUserId = :clerkUserId', { clerkUserId });
    }

    return query.orderBy('account.sentToday', 'ASC').getMany();
  }

  async getAvailableAccounts(clerkUserId?: string): Promise<Account[]> {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .where('account.isActive = :isActive', { isActive: true })
      .andWhere('account.sentToday < account.dailyLimit');

    if (clerkUserId) {
      query.andWhere('account.clerkUserId = :clerkUserId', { clerkUserId });
    }

    return query.orderBy('account.sentToday', 'ASC').getMany();
  }

  async getCredentials(id: string, user: any) {
    const account = await this.findOne(id, user);

    if (!account.hasCredentials()) {
      throw new BadRequestException('Account has no credentials');
    }

    return account.getTypedCredentials(this.encryptionKey);
  }
}
