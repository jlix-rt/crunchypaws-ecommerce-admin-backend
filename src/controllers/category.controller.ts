import type { Request, Response, NextFunction } from 'express';
import * as catService from '../services/category.admin.service.js';

export async function tree(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await catService.getTree());
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, parentId, description, isVisible } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name requerido' });
      return;
    }
    const c = await catService.createCategory(
      name,
      parentId ?? null,
      description,
      isVisible ?? true,
    );
    res.status(201).json(c);
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, parentId, isVisible } = req.body;
    const c = await catService.updateCategory(req.params.id, {
      ...(name != null && { name }),
      ...(description !== undefined && { description }),
      ...(parentId !== undefined && { parentId }),
      ...(isVisible !== undefined && { isVisible: Boolean(isVisible) }),
    });
    res.json(c);
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await catService.deleteCategory(req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
