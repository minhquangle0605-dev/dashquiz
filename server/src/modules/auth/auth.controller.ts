import type { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { env } from '../../config/env';
import { REFRESH_COOKIE_NAME } from '../../utils/constants';
import { AppError } from '../../middlewares/errorHandler';
import { getClientIp } from '../../utils/request';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    maxAge: env.cookie.refreshMaxAge,
    path: env.cookie.path,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    path: env.cookie.path,
  });
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body, getClientIp(req));

    setRefreshCookie(res, result.refreshToken);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const accessToken = req.headers.authorization?.split(' ')[1];

    await authService.logout(refreshToken, accessToken);

    clearRefreshCookie(res);

    res.json({ success: true, message: 'Logout successful', data: null });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined ||
      req.body?.refreshToken as string | undefined;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 401);
    }

    const result = await authService.refresh(refreshToken);

    setRefreshCookie(res, result.refreshToken);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { accessToken: result.accessToken },
    });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
