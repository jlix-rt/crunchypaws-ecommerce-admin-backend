import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email y password requeridos' });
      return;
    }
    const out = await authService.login(email, password);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      res.status(400).json({ error: 'Datos incompletos' });
      return;
    }
    const out = await authService.register(email, password, fullName);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req.query.token as string) || '';
    const out = await authService.verifyEmail(token);
    res.json(out);
  } catch (e) {
    next(e);
  }
}
