import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

type PaginateOptions = {
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
};

type CursorPaginationOptions<T extends ObjectLiteral> = {
  alias: string;
  cursorColumn: keyof T & string;
  direction?: 'ASC' | 'DESC';
};

type CursorPayload = {
  value: string;
  id: ID;
};

const CURSOR_VALUE_ALIAS = '__pagination_cursor_value';

export async function paginate<T extends ObjectLiteral>(
  source: SelectQueryBuilder<T>,
  options: PaginateOptions,
  cursorOptions: CursorPaginationOptions<T>,
) {
  const limit = Math.min(options.limit || 20, 50);
  const direction = cursorOptions.direction ?? 'DESC';
  const cursor = getPaginationCursor(options);
  const isAfter = Boolean(options.after);
  const queryDirection = isAfter ? reverseDirection(direction) : direction;
  const comparison = getPaginationComparison(direction, isAfter);
  const aliasColumn = `${cursorOptions.alias}.${cursorOptions.cursorColumn}`;
  const aliasId = `${cursorOptions.alias}.id`;

  if (cursor) {
    source.andWhere(
      `(${aliasColumn} ${comparison} :cursorValue OR (${aliasColumn} = :cursorValue AND ${aliasId} ${comparison} :cursorId))`,
      {
        cursorValue: cursor.value,
        cursorId: cursor.id,
      },
    );
  }

  const { entities, raw } = await source
    .addSelect(`CAST(${aliasColumn} AS text)`, CURSOR_VALUE_ALIAS)
    .orderBy(aliasColumn, queryDirection)
    .addOrderBy(aliasId, queryDirection)
    .take(limit + 1)
    .getRawAndEntities();

  const hasMore = entities.length > limit;
  const data = hasMore ? entities.slice(0, limit) : entities;
  const cursorValuesById = getCursorValuesById(raw, cursorOptions.alias);
  const nextCursor = hasMore
    ? encodeEntityCursor(data[data.length - 1], cursorOptions, cursorValuesById)
    : undefined;

  return {
    data,
    meta: {
      limit,
      before: options.before ?? options.cursor,
      after: options.after,
      cursor: options.cursor,
      nextCursor: isAfter ? undefined : nextCursor,
      nextBefore: isAfter ? undefined : nextCursor,
      nextAfter: isAfter ? nextCursor : undefined,
      hasMore,
      hasMoreBefore: isAfter ? false : hasMore,
      hasMoreAfter: isAfter ? hasMore : false,
      order: queryDirection,
    },
  };
}

function getPaginationCursor(options: PaginateOptions) {
  const cursorCount = [options.cursor, options.before, options.after].filter(Boolean).length;

  if (cursorCount > 1) {
    throw new BadRequestException('Use only one of cursor, before, or after');
  }

  const cursor = options.after ?? options.before ?? options.cursor;

  return cursor ? decodeCursor(cursor) : undefined;
}

function getPaginationComparison(direction: 'ASC' | 'DESC', isAfter: boolean) {
  if (isAfter) {
    return direction === 'DESC' ? '>' : '<';
  }

  return direction === 'DESC' ? '<' : '>';
}

function reverseDirection(direction: 'ASC' | 'DESC') {
  return direction === 'DESC' ? 'ASC' : 'DESC';
}

function encodeEntityCursor<T extends ObjectLiteral>(
  entity: T,
  options: CursorPaginationOptions<T>,
  cursorValuesById: Map<ID, string>,
) {
  const value = entity[options.cursorColumn] as unknown;
  const id = entity.id;

  if (!id || !value) {
    return undefined;
  }

  return encodeCursor({
    value:
      cursorValuesById.get(id) ?? (value instanceof Date ? value.toISOString() : String(value)),
    id,
  });
}

function getCursorValuesById(rawRows: ObjectLiteral[], alias: string) {
  const entityIdAlias = `${alias}_id`;
  const values = new Map<ID, string>();

  rawRows.forEach((row) => {
    const id = row[entityIdAlias];
    const value = row[CURSOR_VALUE_ALIAS];

    if (id && value && !values.has(id)) {
      values.set(id, value);
    }
  });

  return values;
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;

    if (!decoded.value || !decoded.id) {
      throw new Error('Invalid cursor payload');
    }

    return decoded;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
