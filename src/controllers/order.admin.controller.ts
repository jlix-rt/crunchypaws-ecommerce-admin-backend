import type { Request, Response, NextFunction } from 'express';
import { OrderAdminAction } from '@prisma/client';
import * as orderAdminService from '../services/order.admin.service.js';

const ACTIONS = new Set<string>(Object.values(OrderAdminAction));

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await orderAdminService.listOrders();
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function applyAction(req: Request, res: Response, next: NextFunction) {
  try {
    const action = req.body?.action as string | undefined;
    if (!action || !ACTIONS.has(action)) {
      res.status(400).json({ error: 'Acción inválida (REJECT, PREPARE, SHIP, FINALIZE)' });
      return;
    }
    const updated = await orderAdminService.applyOrderAction(req.params.id, action as OrderAdminAction);
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

/** Reasigna pedidos COD que siguen en estados del flujo transferencia (sin transiciones). */
export async function repairCodStatuses(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await orderAdminService.repairCodOrdersMisplacedStatuses();
    res.json(result);
  } catch (e) {
    next(e);
  }
}
