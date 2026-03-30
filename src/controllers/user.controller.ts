import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import * as userService from '../services/user.service.js';

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await userService.listUsers();
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, fullName, role, isVerified } = req.body;
    if (!email || !password || !fullName || !role) {
      res.status(400).json({ error: 'email, password, fullName y role requeridos' });
      return;
    }
    const u = await userService.createUser(
      email,
      password,
      fullName,
      role as UserRole,
      isVerified !== false,
    );
    res.status(201).json(u);
  } catch (e) {
    next(e);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.body;
    if (!role) {
      res.status(400).json({ error: 'role requerido' });
      return;
    }
    const u = await userService.updateUserRole(req.params.id, role as UserRole);
    res.json(u);
  } catch (e) {
    next(e);
  }
}

export async function updateDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { alias, free_shipping } = req.body;
    const updated = await userService.updateUserDetails(req.params.id, {
      alias,
      freeShipping: free_shipping,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
}
