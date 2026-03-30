import type { Request, Response, NextFunction } from 'express';
import * as productService from '../services/product.admin.service.js';

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Archivo requerido' });
      return;
    }
    const img = await productService.addProductImage(req.params.productId, file.filename);
    res.status(201).json(img);
  } catch (e) {
    next(e);
  }
}

export async function replace(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Archivo requerido' });
      return;
    }
    const img = await productService.replaceProductImage(
      req.params.productId,
      req.params.imageId,
      file.filename,
    );
    res.json(img);
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await productService.deleteProductImage(req.params.productId, req.params.imageId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
