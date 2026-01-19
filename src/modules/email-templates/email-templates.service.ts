import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from 'src/entities/email-templates.entity';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { PaginateDto } from 'src/shared/dto/paginate.dto';
import { QueryBuilder } from 'src/helpers/query-builder';
import { paginate } from 'nestjs-typeorm-paginate/dist/paginate';
import { Pagination } from 'nestjs-typeorm-paginate';

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly emailTemplateRepository: Repository<EmailTemplate>,
  ) {}

  async create(
    createDto: CreateEmailTemplateDto,
    user: any,
  ): Promise<EmailTemplate> {
    const template = this.emailTemplateRepository.create({
      clerkUserId: user.id,
      name: createDto.name,
      subject: createDto.subject,
      content: createDto.content,
    });

    return this.emailTemplateRepository.save(template);
  }

  async findAll(
    clerkUserId: string,
    params: PaginateDto,
  ): Promise<EmailTemplate[] | Pagination<EmailTemplate>> {
    const { filter, page, size, sort } = params;
    const queryBuilder = new QueryBuilder();
    const query = await this.emailTemplateRepository
      .createQueryBuilder('template')
      .where('template.clerkUserId = :clerkUserId', { clerkUserId });

    if (filter) {
      query.andWhere(queryBuilder.whereBuilder(JSON.parse(filter), 'template'));
    }

    if (sort) {
      queryBuilder.buildOrderBy(query, JSON.parse(sort), 'template');
    }

    if (size) {
      return paginate(query, { page, limit: size });
    }

    return await query.getMany();
  }

  async findOne(id: string, clerkUserId: string): Promise<EmailTemplate> {
    const template = await this.emailTemplateRepository.findOne({
      where: { id, clerkUserId },
      relations: ['campaigns'],
    });

    if (!template) {
      throw new NotFoundException(`Email template with ID ${id} not found`);
    }

    return template;
  }

  async update(
    id: string,
    updateDto: UpdateEmailTemplateDto,
    clerkUserId: string,
  ): Promise<EmailTemplate> {
    const template = await this.findOne(id, clerkUserId);

    if (updateDto.name) template.name = updateDto.name;
    if (updateDto.subject) template.subject = updateDto.subject;
    if (updateDto.content) template.content = updateDto.content;

    return this.emailTemplateRepository.save(template);
  }

  async remove(id: string, clerkUserId: string): Promise<void> {
    const template = await this.findOne(id, clerkUserId);
    await this.emailTemplateRepository.remove(template);
  }
}
