import { SelectQueryBuilder, Repository, FindManyOptions, ObjectLiteral } from 'typeorm';

type PaginateOptions = {
  limit?: number;
  offset?: number;
};

export async function paginate<T extends ObjectLiteral>(
  source: SelectQueryBuilder<T> | Repository<T>,
  options: PaginateOptions,
  findOptions?: FindManyOptions<T>,
) {
  const limit = Math.min(options.limit || 20, 50);
  const offset = options.offset || 0;

  let data: T[];
  let total: number;

  if (source instanceof SelectQueryBuilder) {
    const [result, count] = await source.take(limit).skip(offset).getManyAndCount();

    data = result;
    total = count;
  } else {
    const [result, count] = await source.findAndCount({
      ...findOptions,
      take: limit,
      skip: offset,
    });

    data = result;
    total = count;
  }

  return {
    data,
    meta: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}
