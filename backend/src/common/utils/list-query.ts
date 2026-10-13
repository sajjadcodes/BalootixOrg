import { BadRequestException } from '@nestjs/common';
import { ListQueryDto } from '../dto/list-query.dto.js';
import type { PaginatedResult } from '../types/paginated-result.js';

export const DEFAULT_PAGE_SIZE = 25;

export type ListFilterKey =
  | 'email'
  | 'displayName'
  | 'name'
  | 'route'
  | 'slug'
  | 'status'
  | 'action'
  | 'scope'
  | 'type'
  | 'parentId'
  | 'unitId'
  | 'userId'
  | 'roleId'
  | 'permissionId'
  | 'resourceId'
  | 'isActive'
  | 'isManager'
  | 'emailVerified';

export interface ResolvedListQuery {
  page: number;
  pageSize: number;
  offset: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface ListQueryExecutor<T> {
  where(
    filter: Record<string, unknown> | ((record: ListQueryRecord) => unknown),
  ): ListQueryExecutor<T>;
  orderBy(selector: (record: ListQueryRecord) => unknown): ListQueryExecutor<T>;
  limit(value: number): ListQueryExecutor<T>;
  offset(value: number): ListQueryExecutor<T>;
  all(): AsyncIterable<T> | Promise<T[]>;
  count(): Promise<number | bigint>;
}

export interface ListQueryRecord {
  [field: string]: {
    asc(): unknown;
    desc(): unknown;
    eq(value: unknown): unknown;
    isNull(): unknown;
    isNotNull(): unknown;
  };
}

export type ListFilterValue = string | boolean;

export interface ListFieldFilter {
  field: string;
  normalize?: 'email';
  nullable?: boolean;
}

export interface PaginatedListOptions {
  tenantId?: string;
  defaultSortBy: string;
  sortFields: Record<string, string>;
  filters: Partial<Record<ListFilterKey, string | ListFieldFilter>>;
}

export function resolveListQuery(
  input: ListQueryDto,
  options: {
    defaultSortBy: string;
    sortFields: readonly string[];
    filterFields: readonly ListFilterKey[];
  },
): ResolvedListQuery {
  const activeFilters = Object.keys(input).filter(
    (key) =>
      (input as Record<string, unknown>)[key] !== undefined &&
      !['page', 'pageSize', 'sortBy', 'sortOrder'].includes(key),
  );
  const unsupportedFilter = activeFilters.find(
    (filter) => !options.filterFields.includes(filter as ListFilterKey),
  );
  if (unsupportedFilter) {
    throw new BadRequestException(
      `Filtering by "${unsupportedFilter}" is not supported`,
    );
  }

  const sortBy = input.sortBy ?? options.defaultSortBy;
  if (!options.sortFields.includes(sortBy)) {
    throw new BadRequestException(`Sorting by "${sortBy}" is not supported`);
  }

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    sortBy,
    sortOrder: input.sortOrder ?? 'asc',
  };
}

export function createPaginatedResult<T>(
  items: T[],
  total: number,
  query: Pick<ResolvedListQuery, 'page' | 'pageSize'>,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / query.pageSize);
  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      hasPreviousPage: query.page > 1,
      hasNextPage: query.page < totalPages,
    },
  };
}

export async function paginateQuery<T>(
  query: ListQueryExecutor<T>,
  page: Pick<ResolvedListQuery, 'page' | 'pageSize' | 'offset'>,
): Promise<PaginatedResult<T>> {
  const [rows, total] = await Promise.all([
    query.limit(page.pageSize).offset(page.offset).all(),
    query.count(),
  ]);
  const items = await toArray(rows);

  return createPaginatedResult(items, Number(total), page);
}

export async function paginateListQuery<T>(
  collection: unknown,
  input: ListQueryDto,
  options: PaginatedListOptions,
): Promise<PaginatedResult<T>> {
  const filterFields = Object.keys(options.filters) as ListFilterKey[];
  const page = resolveListQuery(input, {
    defaultSortBy: options.defaultSortBy,
    sortFields: Object.keys(options.sortFields),
    filterFields,
  });

  let query = (collection as ListQueryExecutor<T>).where(
    options.tenantId ? { tenantId: options.tenantId } : {},
  );

  for (const [key, predicate] of Object.entries(options.filters)) {
    const value = input[key as keyof ListQueryDto];
    if (value !== undefined && predicate) {
      const filter =
        typeof predicate === 'string' ? { field: predicate } : predicate;
      query = query.where((record) => {
        const field = record[filter.field];
        if (filter.nullable && typeof value === 'boolean') {
          return value ? field.isNotNull() : field.isNull();
        }

        const filterValue =
          filter.normalize === 'email' && typeof value === 'string'
            ? value.trim().toLowerCase()
            : (value as ListFilterValue);
        return field.eq(filterValue);
      });
    }
  }

  const orderedQuery = query.orderBy((record) => {
    const field = record[options.sortFields[page.sortBy]];
    return page.sortOrder === 'asc' ? field.asc() : field.desc();
  });

  return paginateQuery(orderedQuery, page);
}

async function toArray<T>(
  rows: AsyncIterable<T> | T[] | Promise<T[]>,
): Promise<T[]> {
  const resolved = await rows;
  if (Array.isArray(resolved)) {
    return resolved;
  }

  const items: T[] = [];
  for await (const row of resolved as AsyncIterable<T>) {
    items.push(row);
  }
  return items;
}
