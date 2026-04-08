/**
 * Generate a random string of given length
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Format API response consistently
 */
export const apiResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
  errors?: unknown[],
) => ({
  success,
  message,
  data: data ?? null,
  errors: errors ?? null,
  timestamp: new Date().toISOString(),
});

/**
 * Calculate pagination metadata
 */
export const paginationMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});
