import type { Request, Response, NextFunction } from 'express';
import { OrderAdminAction, OrderPaymentFlow } from '@prisma/client';
import * as svc from '../services/order-status.admin.service.js';

const ACTIONS = new Set<string>(Object.values(OrderAdminAction));

const PAYMENT_FLOWS = new Set<string>(Object.values(OrderPaymentFlow));

function parsePaymentFlow(raw: unknown): OrderPaymentFlow | undefined {
  if (raw == null || raw === '') return undefined;
  const s = String(raw);
  if (!PAYMENT_FLOWS.has(s)) return undefined;
  return s as OrderPaymentFlow;
}

export async function listStatuses(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.listStatuses());
  } catch (e) {
    next(e);
  }
}

export async function listTransitions(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.paymentFlow;
    if (q != null && String(q) !== '' && parsePaymentFlow(q) === undefined) {
      res.status(400).json({ error: 'paymentFlow inválido' });
      return;
    }
    const flow = parsePaymentFlow(q);
    res.json(await svc.listTransitions(flow));
  } catch (e) {
    next(e);
  }
}

export async function createStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      code,
      labelAdmin,
      labelCustomer,
      sortOrder,
      isInitial,
      allowsProofUpload,
      isCancelled,
      isTerminal,
      paymentFlow: paymentFlowRaw,
    } = req.body ?? {};
    if (!code || !labelAdmin || !labelCustomer) {
      res.status(400).json({ error: 'code, labelAdmin y labelCustomer son requeridos' });
      return;
    }
    const paymentFlow = parsePaymentFlow(paymentFlowRaw);
    if (paymentFlowRaw != null && paymentFlowRaw !== '' && paymentFlow === undefined) {
      res.status(400).json({ error: 'paymentFlow inválido' });
      return;
    }
    const row = await svc.createStatus({
      code: String(code),
      labelAdmin: String(labelAdmin),
      labelCustomer: String(labelCustomer),
      sortOrder: sortOrder != null ? Number(sortOrder) : undefined,
      isInitial: Boolean(isInitial),
      allowsProofUpload: Boolean(allowsProofUpload),
      isCancelled: Boolean(isCancelled),
      isTerminal: Boolean(isTerminal),
      paymentFlow,
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.updateStatus(req.params.id, req.body ?? {});
    res.json(row);
  } catch (e) {
    next(e);
  }
}

export async function deleteStatus(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteStatus(req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function createTransition(req: Request, res: Response, next: NextFunction) {
  try {
    const { fromStatusId, action, toStatusId, paymentFlow: paymentFlowRaw } = req.body ?? {};
    if (!fromStatusId || !action || !toStatusId || paymentFlowRaw == null || paymentFlowRaw === '') {
      res.status(400).json({ error: 'fromStatusId, action, toStatusId y paymentFlow son requeridos' });
      return;
    }
    if (!ACTIONS.has(String(action))) {
      res.status(400).json({ error: 'action inválida' });
      return;
    }
    const paymentFlow = parsePaymentFlow(paymentFlowRaw);
    if (!paymentFlow || paymentFlow === OrderPaymentFlow.SHARED) {
      res.status(400).json({ error: 'paymentFlow debe ser ADVANCE o COD' });
      return;
    }
    const row = await svc.createTransition({
      fromStatusId: String(fromStatusId),
      action: action as OrderAdminAction,
      toStatusId: String(toStatusId),
      paymentFlow,
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
}

export async function cloneTransition(req: Request, res: Response, next: NextFunction) {
  try {
    const { sourceId, paymentFlow: paymentFlowRaw } = req.body ?? {};
    if (!sourceId || paymentFlowRaw == null || paymentFlowRaw === '') {
      res.status(400).json({ error: 'sourceId y paymentFlow son requeridos' });
      return;
    }
    const paymentFlow = parsePaymentFlow(paymentFlowRaw);
    if (!paymentFlow || paymentFlow === OrderPaymentFlow.SHARED) {
      res.status(400).json({ error: 'paymentFlow debe ser ADVANCE o COD' });
      return;
    }
    const row = await svc.cloneTransition(String(sourceId), paymentFlow);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
}

export async function updateTransition(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.updateTransition(req.params.id, req.body ?? {});
    res.json(row);
  } catch (e) {
    next(e);
  }
}

export async function deleteTransition(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteTransition(req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
