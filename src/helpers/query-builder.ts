import { Brackets, SelectQueryBuilder } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/*


*/

export class QueryBuilder {
  private andOperator = '$and';
  private orOperator = '$or';

  public whereBuilder(
    where: any,
    alias: string = '',
    or: boolean = false,
  ): Brackets {
    if (where instanceof Array) {
      return new Brackets((q) => {
        where.map((item) => {
          if (this.isCondition(item)) {
            const cond = QueryBuilder.buildCondition(item, alias);
            if (or) {
              q.orWhere(cond.condition, cond.params);
            } else {
              q.andWhere(cond.condition, cond.params);
            }
          } else if (item instanceof Object) {
            if (or) {
              q.orWhere(this.whereBuilder(item, alias, true));
            } else {
              q.andWhere(this.whereBuilder(item, alias));
            }
          }
        });
      });
    } else if (where instanceof Object) {
      return new Brackets((q) => {
        for (const key in where) {
          const item = where[key];
          if (!this.isAndOrOperator(key)) {
            throw new Error(`${key} is invalid`);
          }
          if (item instanceof Array) {
            if (key == this.getAndOperator()) {
              q.andWhere(this.whereBuilder(item, alias));
            } else if (key == this.getOrOperator()) {
              q.orWhere(this.whereBuilder(item, alias, true));
            }
          } else if (item instanceof Object) {
            if (key == this.getAndOperator()) {
              q.andWhere(this.whereBuilder(item));
            } else if (key == this.getOrOperator()) {
              q.orWhere(this.whereBuilder(item, alias, true));
            }
          }
        }
      });
    }
    throw new Error('Parameter is invalid');
  }

  public buildOrderBy(
    query: SelectQueryBuilder<any>,
    orderBy: any,
    alias: string = '',
  ) {
    if (orderBy instanceof Object) {
      for (let column in orderBy) {
        const orderType = orderBy[column];
        if (alias && alias.length > 0 && column.split('.').length == 1) {
          column = `${alias}.${column}`;
        }
        query.addOrderBy(column, orderType.toUpperCase());
      }
    }
  }

  public searchBuilder(cols: string[], value: string = '', alias: string = '') {
    return new Brackets((q) => {
      cols.map((col) => {
        const cond = QueryBuilder.buildCondition({ col, op: '$lk', val: value });
        q.orWhere(cond.condition, cond.params);
      });
    });
  }

  static buildCondition(items: any, alias: string = '') {
    let col = items?.col;
    const op = items?.op;
    const val = items?.val;
    const params = {};
    const index = uuidv4().replaceAll('-', '');
    if (alias && alias.length > 0 && col.split('.').length == 1) {
      col = `${alias}.${col}`;
    }
    const key = `${col}_${index}`;
    params[key] = val;
    switch (op) {
      case '$eq':
        return { condition: `${col} = :${key}`, params };
      case '$ne':
        return { condition: `${col} != :${key}`, params };
      case '$lt':
        return { condition: `${col} < :${key}`, params };
      case '$lte':
        return { condition: `${col} <= :${key}`, params };
      case '$gt':
        return { condition: `${col} > :${key}`, params };
      case '$gte':
        return { condition: `${col} >= :${key}`, params };
      case '$lk':
        params[key] = `%${val}%`;
        return { condition: `${col} LIKE :${key}`, params };
      case '$sw':
        params[key] = `${val}%`;
        return { condition: `${col} LIKE :${key}`, params };
      case '$ew':
        params[key] = `%${val}`;
        return { condition: `${col} LIKE :${key}`, params };
      case '$ilk':
        params[key] = `%${val}%`;
        return { condition: `${col} ILIKE :${key}`, params };
      case '$isw':
        params[key] = `${val}%`;
        return { condition: `${col} ILIKE :${key}`, params };
      case '$iew':
        params[key] = `%${val}`;
        return { condition: `${col} ILIKE :${key}`, params };
      case '$in':
        return { condition: `${col} IN (:...${key})`, params };
      case '$nin':
        return { condition: `${col} NOT IN (:...${key})`, params };
      case '$btw':
        params[`first_${key}`] = `${val}`;
        params[`second_${key}`] = `${val}`;
        return {
          condition: `${col} BETWEEN :first_${key} AND :second${key}`,
          params,
        };
      case '$inu':
        return { condition: `${col} IS NULL` };
      case '$nnu':
        return { condition: `${col} IS NOT NULL` };
      case '$contains':
        return { condition: `${col} @> :${key}`, params };
      case '$isContained':
        return { condition: `${col} <@ :${key}`, params };
      default:
        throw new Error(`${op} is invalid`);
    }
  }

  private getAndOperator() {
    return this.andOperator;
  }

  private getOrOperator() {
    return this.orOperator;
  }

  private isAndOrOperator(op: string) {
    return op == this.getAndOperator() || op == this.getOrOperator();
  }

  private isCondition(obj: any) {
    return obj instanceof Object && 'col' in obj && 'op' in obj && 'val' in obj;
  }
}
