import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.js';
import { slugify } from '../utils/slug.js';

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isVisible: boolean;
  parentId: string | null;
  children: CategoryTreeNode[];
};

async function getDescendantCategoryIds(rootId: string): Promise<string[]> {
  const rows = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const childrenOf = new Map<string | null, string[]>();
  for (const r of rows) {
    const p = r.parentId ?? null;
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p)!.push(r.id);
  }
  const out: string[] = [];
  const q = [rootId];
  for (let i = 0; i < q.length; i++) {
    const id = q[i]!;
    out.push(id);
    for (const c of childrenOf.get(id) ?? []) q.push(c);
  }
  return out;
}

async function uniqueSlug(base: string): Promise<string> {
  let s = base;
  let n = 0;
  while (await prisma.category.findUnique({ where: { slug: s } })) {
    n += 1;
    s = `${base}-${n}`;
  }
  return s;
}

function buildTree(
  flat: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isVisible: boolean;
    parentId: string | null;
  }[],
): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sort(n.children);
  };
  sort(roots);
  return roots;
}

export async function getTree(): Promise<CategoryTreeNode[]> {
  const flat = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, description: true, isVisible: true, parentId: true },
  });
  return buildTree(flat);
}

export async function createCategory(
  name: string,
  parentId: string | null,
  description?: string,
  isVisible: boolean = true,
) {
  if (parentId) {
    const parent = await prisma.category.findFirst({ where: { id: parentId, deletedAt: null } });
    if (!parent) throw new AppError(400, 'Categoría padre no encontrada');
  }
  const base = parentId
    ? slugify(`${(await prisma.category.findUnique({ where: { id: parentId! } }))!.slug}-${name}`)
    : slugify(name);
  const slug = await uniqueSlug(base);
  return prisma.category.create({
    data: { name, slug, description: description ?? null, parentId, isVisible },
  });
}

export async function updateCategory(
  id: string,
  data: { name?: string; description?: string | null; parentId?: string | null; isVisible?: boolean },
) {
  const cat = await prisma.category.findFirst({ where: { id, deletedAt: null } });
  if (!cat) throw new AppError(404, 'Categoría no encontrada');
  if (data.parentId === id) throw new AppError(400, 'La categoría no puede ser padre de sí misma');
  if (data.parentId) {
    const p = await prisma.category.findFirst({ where: { id: data.parentId, deletedAt: null } });
    if (!p) throw new AppError(400, 'Padre no encontrado');
    const isDescendant = await wouldCreateCycle(id, data.parentId);
    if (isDescendant) throw new AppError(400, 'No se puede asignar un descendiente como padre');
  }
  let slug = cat.slug;
  if (data.name && data.name !== cat.name) {
    const base = data.parentId != null
      ? slugify(
          `${(await prisma.category.findUnique({ where: { id: data.parentId! } }))?.slug ?? 'cat'}-${data.name}`,
        )
      : slugify(data.name);
    slug = await uniqueSlug(base);
  }

  const nextIsVisible = data.isVisible;
  if (nextIsVisible === false) {
    const ids = await getDescendantCategoryIds(id);
    const [updated] = await prisma.$transaction([
      prisma.category.update({
        where: { id },
        data: {
          ...(data.name != null && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.parentId !== undefined && { parentId: data.parentId }),
          isVisible: false,
          slug,
        },
      }),
      prisma.product.updateMany({
        where: { categoryId: { in: ids }, deletedAt: null },
        data: { isVisible: false },
      }),
    ]);
    return updated;
  }

  return prisma.category.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
      slug,
    },
  });
}

async function wouldCreateCycle(categoryId: string, newParentId: string): Promise<boolean> {
  let current: string | null = newParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === categoryId) return true;
    if (seen.has(current)) break;
    seen.add(current);
    const row: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return false;
}

export async function deleteCategory(id: string) {
  const cat = await prisma.category.findFirst({ where: { id, deletedAt: null } });
  if (!cat) throw new AppError(404, 'Categoría no encontrada');

  // Soft delete en cascada: categoría, descendientes y productos en el subárbol.
  const ids = await getDescendantCategoryIds(id);
  await prisma.$transaction([
    prisma.product.updateMany({
      where: { categoryId: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), isVisible: false, stock: 0 },
    }),
    prisma.category.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), isVisible: false },
    }),
  ]);
}
