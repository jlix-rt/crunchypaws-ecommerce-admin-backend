import { OrderAdminAction, OrderPaymentFlow, PaymentMethod, PaymentRecordStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.js';

function orderPaymentFlow(pm: PaymentMethod): OrderPaymentFlow {
  return pm === PaymentMethod.CASH_ON_DELIVERY ? OrderPaymentFlow.COD : OrderPaymentFlow.ADVANCE;
}

const initialAdvanceCodes = new Set(['INITIAL', 'ADV_RECEIVED']);
const checkingCodes = new Set(['PROOF_REVIEW', 'ADV_CHECKING']);
const paidCodes = new Set(['PAID', 'ADV_PAID']);

/**
 * Pedidos contra entrega que quedaron en ids del flujo anticipado (p. ej. osd_prep) no tienen transiciones COD.
 * Reasigna al estado equivalente del flujo COD.
 */
const ADVANCE_STATUS_TO_COD: Array<{ advanceId: string; codId: string }> = [
  { advanceId: 'osd_init', codId: 'cod_recv' },
  { advanceId: 'osd_proof', codId: 'cod_ver' },
  { advanceId: 'osd_paid', codId: 'cod_con' },
  { advanceId: 'osd_ack', codId: 'cod_con' },
  { advanceId: 'osd_prep', codId: 'cod_pre' },
  { advanceId: 'osd_ready', codId: 'cod_rdy' },
  { advanceId: 'osd_ship', codId: 'cod_shp' },
  { advanceId: 'osd_done', codId: 'cod_dn' },
];

export async function repairCodOrdersMisplacedStatuses(): Promise<{ updated: number }> {
  let updated = 0;
  for (const { advanceId, codId } of ADVANCE_STATUS_TO_COD) {
    const r = await prisma.order.updateMany({
      where: {
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        statusId: advanceId,
      },
      data: { statusId: codId },
    });
    updated += r.count;
  }
  return { updated };
}

export async function listOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      status: true,
      user: { select: { id: true, email: true, fullName: true } },
    },
  });
}

export async function applyOrderAction(orderId: string, action: OrderAdminAction) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { status: true },
  });
  if (!order) {
    throw new AppError(404, 'Pedido no encontrado');
  }

  const paymentFlow = orderPaymentFlow(order.paymentMethod);

  const transition = await prisma.orderStatusTransition.findUnique({
    where: {
      fromStatusId_action_paymentFlow: {
        fromStatusId: order.statusId,
        action,
        paymentFlow,
      },
    },
    include: { toStatus: true },
  });
  if (!transition) {
    throw new AppError(400, 'Acción no permitida para el estado actual');
  }

  if (
    order.paymentMethod === PaymentMethod.BANK_TRANSFER &&
    action === OrderAdminAction.PREPARE &&
    initialAdvanceCodes.has(order.status.code) &&
    !checkingCodes.has(transition.toStatus.code)
  ) {
    throw new AppError(400, 'Esperando comprobante de transferencia del cliente');
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { statusId: transition.toStatusId },
    });
    if (paidCodes.has(transition.toStatus.code) && order.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      await tx.paymentRecord.updateMany({
        where: { orderId },
        data: { status: PaymentRecordStatus.COMPLETED },
      });
    }
  });

  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      status: true,
      user: { select: { id: true, email: true, fullName: true } },
      items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
    },
  });
}
