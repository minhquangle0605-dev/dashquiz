/** JSON shape returned by route handlers while business logic is still stubbed */
export type PlaceholderJsonResponse = Readonly<{ success: true; message: string }>;

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown[] | null;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface JwtPayload {
  id: number;
  email: string;
  /** Present on tokens issued after username-only login; older tokens may omit. */
  username?: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
}
