import { PAGINATION } from './constants';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function buildPaginationResponse(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export type ParsedPaginationParams = {
  page: number;
  limit: number;
  cursor?: string;
};

/**
 * Offset pagination params plus optional opaque cursor for cursor-based APIs.
 * Defaults: page=1, limit=20, max limit=100.
 */
export function parsePaginationParams(query: {
  page?: unknown;
  limit?: unknown;
  cursor?: unknown;
}): ParsedPaginationParams {
  let page: number = PAGINATION.DEFAULT_PAGE;
  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const p = Number(query.page);
    if (Number.isFinite(p) && p >= 1) page = Math.floor(p);
  }

  let limit: number = PAGINATION.DEFAULT_LIMIT;
  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const l = Number(query.limit);
    if (Number.isFinite(l) && l >= 1) {
      limit = Math.min(Math.floor(l), PAGINATION.MAX_LIMIT);
    }
  }

  const cursor =
    typeof query.cursor === 'string' && query.cursor.length > 0 ? query.cursor : undefined;

  return { page, limit, cursor };
}

/** Encode a numeric id (or composite key) as an opaque cursor for keyset-style pagination. */
export function encodeIdCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}

export function decodeIdCursor(cursor: string): number | null {
  try {
    const s = Buffer.from(cursor, 'base64url').toString('utf8');
    const id = Number(s);
    return Number.isFinite(id) && id >= 1 ? Math.floor(id) : null;
  } catch {
    return null;
  }
}
