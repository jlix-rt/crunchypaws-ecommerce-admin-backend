import { OrderAdminAction, OrderPaymentFlow } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.js';

function normalizeCode(input: string): string {
  const s = input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
  if (!s) return `ST_${Date.now()}`;
  return s;
}

export async function listStatuses() {
  return prisma.orderStatusDefinition.findMany({
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
}

export async function listTransitions(paymentFlow?: OrderPaymentFlow) {
  return prisma.orderStatusTransition.findMany({
    where: paymentFlow ? { paymentFlow } : undefined,
    include: {
      fromStatus: { select: { id: true, code: true, labelAdmin: true } },
      toStatus: { select: { id: true, code: true, labelAdmin: true } },
    },
    orderBy: [{ paymentFlow: 'asc' }, { id: 'asc' }],
  });
}

export async function createStatus(input: {
  code: string;
  labelAdmin: string;
  labelCustomer: string;
  sortOrder?: number;
  isInitial?: boolean;
  allowsProofUpload?: boolean;
  isCancelled?: boolean;
  isTerminal?: boolean;
  paymentFlow?: OrderPaymentFlow;
}) {
  const code = normalizeCode(input.code);
  const exists = await prisma.orderStatusDefinition.findUnique({ where: { code } });
  if (exists) {
    throw new AppError(400, 'Ya existe un estado con ese código');
  }

  const flow = input.paymentFlow ?? OrderPaymentFlow.ADVANCE;

  return prisma.$transaction(async (tx) => {
    if (input.isInitial) {
      await tx.orderStatusDefinition.updateMany({
        where: { paymentFlow: flow, isInitial: true },
        data: { isInitial: false },
      });
    }
    return tx.orderStatusDefinition.create({
      data: {
        code,
        labelAdmin: input.labelAdmin.trim(),
        labelCustomer: input.labelCustomer.trim(),
        sortOrder: input.sortOrder ?? 100,
        isInitial: input.isInitial ?? false,
        allowsProofUpload: input.allowsProofUpload ?? false,
        isCancelled: input.isCancelled ?? false,
        isTerminal: input.isTerminal ?? false,
        paymentFlow: flow,
      },
    });
  });
}

export async function updateStatus(
  id: string,
  input: Partial<{
    labelAdmin: string;
    labelCustomer: string;
    sortOrder: number;
    isInitial: boolean;
    allowsProofUpload: boolean;
    isCancelled: boolean;
    isTerminal: boolean;
  }>,
) {
  const cur = await prisma.orderStatusDefinition.findUnique({ where: { id } });
  if (!cur) {
    throw new AppError(404, 'Estado no encontrado');
  }

  return prisma.$transaction(async (tx) => {
    if (input.isInitial) {
      const flow = cur.paymentFlow;
      if (flow) {
        await tx.orderStatusDefinition.updateMany({
          where: { paymentFlow: flow, isInitial: true, id: { not: id } },
          data: { isInitial: false },
        });
      }
    }
    return tx.orderStatusDefinition.update({
      where: { id },
      data: {
        ...(input.labelAdmin !== undefined ? { labelAdmin: input.labelAdmin.trim() } : {}),
        ...(input.labelCustomer !== undefined ? { labelCustomer: input.labelCustomer.trim() } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isInitial !== undefined ? { isInitial: input.isInitial } : {}),
        ...(input.allowsProofUpload !== undefined ? { allowsProofUpload: input.allowsProofUpload } : {}),
        ...(input.isCancelled !== undefined ? { isCancelled: input.isCancelled } : {}),
        ...(input.isTerminal !== undefined ? { isTerminal: input.isTerminal } : {}),
      },
    });
  });
}

export async function deleteStatus(id: string) {
  const n = await prisma.order.count({ where: { statusId: id } });
  if (n > 0) {
    throw new AppError(400, 'Hay pedidos con este estado; no se puede eliminar');
  }
  await prisma.$transaction([
    prisma.orderStatusTransition.deleteMany({
      where: { OR: [{ fromStatusId: id }, { toStatusId: id }] },
    }),
    prisma.orderStatusDefinition.delete({ where: { id } }),
  ]);
}

export async function createTransition(input: {
  fromStatusId: string;
  action: OrderAdminAction;
  toStatusId: string;
  paymentFlow: OrderPaymentFlow;
}) {
  try {
    return await prisma.orderStatusTransition.create({
      data: {
        fromStatusId: input.fromStatusId,
        action: input.action,
        toStatusId: input.toStatusId,
        paymentFlow: input.paymentFlow,
      },
      include: {
        fromStatus: { select: { id: true, code: true, labelAdmin: true } },
        toStatus: { select: { id: true, code: true, labelAdmin: true } },
      },
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      throw new AppError(400, 'Ya existe una acción igual desde ese estado para este flujo');
    }
    throw e;
  }
}

export async function cloneTransition(sourceId: string, targetPaymentFlow: OrderPaymentFlow) {
  if (targetPaymentFlow === OrderPaymentFlow.SHARED) {
    throw new AppError(400, 'No se puede clonar a SHARED');
  }
  const src = await prisma.orderStatusTransition.findUnique({ where: { id: sourceId } });
  if (!src) {
    throw new AppError(404, 'Transición no encontrada');
  }
  if (src.paymentFlow === targetPaymentFlow) {
    throw new AppError(400, 'El flujo destino es el mismo que el origen');
  }
  return createTransition({
    fromStatusId: src.fromStatusId,
    action: src.action,
    toStatusId: src.toStatusId,
    paymentFlow: targetPaymentFlow,
  });
}

export async function updateTransition(
  id: string,
  input: {
    toStatusId?: string;
  },
) {
  const cur = await prisma.orderStatusTransition.findUnique({ where: { id } });
  if (!cur) {
    throw new AppError(404, 'Transición no encontrada');
  }
  return prisma.orderStatusTransition.update({
    where: { id },
    data: {
      ...(input.toStatusId ? { toStatusId: input.toStatusId } : {}),
    },
    include: {
      fromStatus: { select: { id: true, code: true, labelAdmin: true } },
      toStatus: { select: { id: true, code: true, labelAdmin: true } },
    },
  });
}

export async function deleteTransition(id: string) {
  await prisma.orderStatusTransition.delete({ where: { id } });
}
