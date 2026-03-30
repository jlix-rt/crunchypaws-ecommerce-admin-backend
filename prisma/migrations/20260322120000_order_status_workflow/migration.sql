-- Estado de pedidos configurable + transiciones por acción administrativa

CREATE TYPE "OrderAdminAction" AS ENUM ('REJECT', 'PREPARE', 'SHIP', 'FINALIZE');

CREATE TABLE "OrderStatusDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelAdmin" TEXT NOT NULL,
    "labelCustomer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "allowsProofUpload" BOOLEAN NOT NULL DEFAULT false,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderStatusDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderStatusDefinition_code_key" ON "OrderStatusDefinition"("code");

INSERT INTO "OrderStatusDefinition" ("id","code","labelAdmin","labelCustomer","sortOrder","isInitial","allowsProofUpload","isCancelled","isTerminal","createdAt","updatedAt") VALUES
('osd_init','INITIAL','Pendiente confirmar','Pedido recibido',10,true,true,false,false,NOW(),NOW()),
('osd_proof','PROOF_REVIEW','Comprobante en revisión','Comprobante enviado',20,false,false,false,false,NOW(),NOW()),
('osd_paid','PAID','Pago confirmado','Pago confirmado',25,false,false,false,false,NOW(),NOW()),
('osd_prep','PREPARING','En preparación','Preparando tu pedido',30,false,false,false,false,NOW(),NOW()),
('osd_ship','SHIPPED','Enviado','En ruta',40,false,false,false,false,NOW(),NOW()),
('osd_done','DELIVERED','Finalizado','Entregado',50,false,false,false,true,NOW(),NOW()),
('osd_cancel','CANCELLED','Rechazado / cancelado','Pedido cancelado',90,false,false,true,true,NOW(),NOW());

CREATE TABLE "OrderStatusTransition" (
    "id" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "action" "OrderAdminAction" NOT NULL,
    "toStatusId" TEXT NOT NULL,

    CONSTRAINT "OrderStatusTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderStatusTransition_fromStatusId_action_key" ON "OrderStatusTransition"("fromStatusId", "action");

ALTER TABLE "OrderStatusTransition" ADD CONSTRAINT "OrderStatusTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "OrderStatusDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStatusTransition" ADD CONSTRAINT "OrderStatusTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "OrderStatusDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "OrderStatusTransition" ("id","fromStatusId","action","toStatusId") VALUES
('ost1','osd_init','REJECT','osd_cancel'),
('ost2','osd_init','PREPARE','osd_prep'),
('ost3','osd_proof','REJECT','osd_cancel'),
('ost9','osd_proof','PREPARE','osd_paid'),
('ost4','osd_paid','PREPARE','osd_prep'),
('ost5','osd_prep','REJECT','osd_cancel'),
('ost6','osd_prep','SHIP','osd_ship'),
('ost7','osd_ship','FINALIZE','osd_done'),
('ost8','osd_ship','REJECT','osd_cancel');

-- Migrar pedidos existentes
ALTER TABLE "Order" ADD COLUMN "statusId" TEXT;

UPDATE "Order" SET "statusId" = CASE "status"::text
  WHEN 'PENDING_PAYMENT' THEN 'osd_init'
  WHEN 'PENDING_CONFIRMATION' THEN 'osd_proof'
  WHEN 'PAID' THEN 'osd_paid'
  WHEN 'PROCESSING' THEN 'osd_prep'
  WHEN 'SHIPPED' THEN 'osd_ship'
  WHEN 'DELIVERED' THEN 'osd_done'
  WHEN 'CANCELLED' THEN 'osd_cancel'
  ELSE 'osd_init'
END;

ALTER TABLE "Order" ALTER COLUMN "statusId" SET NOT NULL;

ALTER TABLE "Order" DROP COLUMN "status";

DROP TYPE "OrderStatus";

ALTER TABLE "Order" ADD CONSTRAINT "Order_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "OrderStatusDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Order_statusId_idx" ON "Order"("statusId");
