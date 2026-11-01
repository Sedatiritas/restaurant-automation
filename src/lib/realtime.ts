import { EventEmitter } from "node:events";

export type CashierUpdateType = "order_created" | "payment_recorded" | "bill_closed";

export type CashierUpdateEvent = {
  type: CashierUpdateType;
  tableId: string;
  tableName?: string;
  orderId?: string;
  roundNumber?: number;
  occurredAt: string;
};

const cashierEvents = new EventEmitter();

export function publishCashierUpdate(event: CashierUpdateEvent): void {
  cashierEvents.emit("cashier-update", event);
}

export function subscribeCashierUpdates(
  listener: (event: CashierUpdateEvent) => void
): () => void {
  cashierEvents.on("cashier-update", listener);
  return () => cashierEvents.off("cashier-update", listener);
}
