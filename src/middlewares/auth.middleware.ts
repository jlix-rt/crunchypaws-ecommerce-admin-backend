import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from './error.js';

export interface AdminJwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    next(new AppError(401, 'No autorizado'));
    return;
  }
  try {
    const payload = jwt.verify(h.slice(7), env.jwtSecret) as AdminJwtPayload;
    req.admin = payload;
    next();
  } catch {
    next(new AppError(401, 'Token inválido'));
  }
}

export function roleMiddleware(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) {
      next(new AppError(401, 'No autorizado'));
      return;
    }
    if (!allowed.includes(req.admin.role)) {
      next(new AppError(403, 'Sin permiso'));
      return;
    }
    next();
  };
}

