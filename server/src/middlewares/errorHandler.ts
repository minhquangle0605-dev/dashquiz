import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors: unknown[] | null;
  /** Optional JSON payload (e.g. retryAfterSeconds for 429) */
  public data: unknown | null;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    errors: unknown[] | null = null,
    data: unknown | null = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    this.data = data;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal Server Error';
  const errors = err instanceof AppError ? err.errors : null;
  const data = err instanceof AppError ? err.data : null;

  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${err.message}`, { stack: err.stack });
  } else {
    logger.warn(`${statusCode} - ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(data != null ? { data } : {}),
    timestamp: new Date().toISOString(),
  });
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    errors: null,
    timestamp: new Date().toISOString(),
  });
};
