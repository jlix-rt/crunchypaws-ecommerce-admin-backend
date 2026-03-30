import type { Request, Response, NextFunction } from 'express';
import * as productService from '../services/product.admin.service.js';

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await productService.listProducts());
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, price, stock, categoryId, sku, isVisible, tracksStock } = req.body;
    if (!name || description == null || price == null || stock == null || !categoryId) {
      res.status(400).json({ error: 'Campos requeridos incompletos' });
      return;
    }
    const p = await productService.createProduct({
      name,
      description,
      price: Number(price),
      stock: Number(stock),
      categoryId,
      sku: sku ?? null,
      isVisible: isVisible ?? true,
      tracksStock: tracksStock !== false && tracksStock !== 'false',
    });
    res.status(201).json(p);
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, price, stock, categoryId, sku, imageUrl, isVisible, tracksStock } = req.body;
    const data: Record<string, unknown> = {};
    if (name != null) data.name = name;
    if (description != null) data.description = description;
    if (price != null) data.price = Number(price);
    if (stock != null) data.stock = Number(stock);
    if (categoryId != null) data.categoryId = categoryId;
    if (sku !== undefined) data.sku = sku;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (isVisible !== undefined) data.isVisible = Boolean(isVisible);
    if (tracksStock !== undefined) {
      data.tracksStock = tracksStock !== false && tracksStock !== 'false';
    }
    const p = await productService.updateProduct(req.params.id, data as Parameters<
      typeof productService.updateProduct
    >[1]);
    res.json(p);
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await productService.deleteProduct(req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
