import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.js';
import { env } from '../config/env.js';

export async function listProducts() {
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  sku?: string | null;
  isVisible?: boolean;
  tracksStock?: boolean;
}) {
  const cat = await prisma.category.findFirst({ where: { id: data.categoryId, deletedAt: null } });
  if (!cat) throw new AppError(400, 'Categoría no encontrada');
  return prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      stock: data.stock,
      tracksStock: data.tracksStock ?? true,
      categoryId: data.categoryId,
      sku: data.sku ?? null,
      isVisible: data.isVisible ?? true,
    },
    include: { images: true, category: true },
  });
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number;
    categoryId: string;
    sku: string | null;
    imageUrl: string | null;
    isVisible: boolean;
    tracksStock: boolean;
  }>,
) {
  const p = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!p) throw new AppError(404, 'Producto no encontrado');
  if (data.categoryId) {
    const c = await prisma.category.findFirst({ where: { id: data.categoryId, deletedAt: null } });
    if (!c) throw new AppError(400, 'Categoría no encontrada');
  }

  // `ProductUpdateInput` solo admite la relación `category`, no el escalar `categoryId`.
  // `ProductUncheckedUpdateInput` sí acepta `categoryId` (igual que en create).
  const prismaData: Prisma.ProductUncheckedUpdateInput = {};
  if (data.name !== undefined) prismaData.name = data.name;
  if (data.description !== undefined) prismaData.description = data.description;
  if (data.price !== undefined) prismaData.price = data.price;
  if (data.stock !== undefined) prismaData.stock = data.stock;
  if (data.categoryId !== undefined) prismaData.categoryId = data.categoryId;
  if (data.sku !== undefined) prismaData.sku = data.sku;
  if (data.imageUrl !== undefined) prismaData.imageUrl = data.imageUrl;
  if (data.isVisible !== undefined) prismaData.isVisible = data.isVisible;
  if (data.tracksStock !== undefined) prismaData.tracksStock = data.tracksStock;

  return prisma.product.update({
    where: { id },
    data: prismaData,
    include: { images: true, category: true },
  });
}

export async function deleteProduct(id: string) {
  const p = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!p) throw new AppError(404, 'Producto no encontrado');
  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), isVisible: false, stock: 0 },
  });
}

export function publicImageUrl(filename: string): string {
  const base = env.publicShopApiUrl.replace(/\/$/, '');
  return `${base}/uploads/products/${filename}`;
}

export async function addProductImage(productId: string, filename: string) {
  const p = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!p) throw new AppError(404, 'Producto no encontrado');
  const url = publicImageUrl(filename);
  const count = await prisma.productImage.count({ where: { productId } });
  const img = await prisma.productImage.create({
    data: { productId, imageUrl: url, sortOrder: count },
  });
  if (!p.imageUrl) {
    await prisma.product.update({ where: { id: productId }, data: { imageUrl: url } });
  }
  return img;
}

export async function replaceProductImage(
  productId: string,
  imageId: string,
  filename: string,
) {
  const img = await prisma.productImage.findFirst({
    where: { id: imageId, productId, product: { deletedAt: null } },
  });
  if (!img) throw new AppError(404, 'Imagen no encontrada');
  const url = publicImageUrl(filename);
  return prisma.productImage.update({
    where: { id: imageId },
    data: { imageUrl: url },
  });
}

export async function deleteProductImage(productId: string, imageId: string) {
  const img = await prisma.productImage.findFirst({
    where: { id: imageId, productId, product: { deletedAt: null } },
  });
  if (!img) throw new AppError(404, 'Imagen no encontrada');
  await prisma.productImage.delete({ where: { id: imageId } });
  const first = await prisma.productImage.findFirst({
    where: { productId, product: { deletedAt: null } },
    orderBy: { sortOrder: 'asc' },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: first?.imageUrl ?? null },
  });
}
