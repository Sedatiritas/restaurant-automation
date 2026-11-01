import { z } from "zod";
import type { RequestHandler } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { publishCashierUpdate, subscribeCashierUpdates } from "../lib/realtime.js";

const tableIdSchema = z.string().uuid();
const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99)
  })).min(1).max(100)
});
const collectSchema = z.object({
  paymentMethod: z.enum(["cash", "card"]),
  items: z.array(z.object({
    orderId: z.string().uuid(),
    itemId: z.string().uuid(),
    unitIndex: z.number().int().min(1)
  })).min(1).max(200).refine((items) => {
    const keys = items.map((item) => item.itemId + ":" + item.unitIndex);
    return new Set(keys).size === keys.length;
  }, "Aynı ürün adedi bir tahsilatta birden fazla seçilemez.")
});

type BillItemSnapshot = {
  quantity: number;
  unitPrice: Prisma.Decimal;
  allocations: Array<{ amount: Prisma.Decimal }>;
};

function sendError(res: Parameters<RequestHandler>[1], status: number, message: string): void {
  res.status(status).json({ error: message, message });
}

function calculateBill(items: BillItemSnapshot[]) {
  const total = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const paid = items.reduce(
    (sum, item) => sum + item.allocations.reduce((itemSum, allocation) => itemSum + Number(allocation.amount), 0),
    0
  );
  return {
    total: Number(total.toFixed(2)),
    paid: Number(paid.toFixed(2)),
    remaining: Number(Math.max(0, total - paid).toFixed(2))
  };
}

async function fetchTableSnapshots() {
  const tables = await prisma.diningTable.findMany({
    select: {
      id: true,
      name: true,
      seats: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      bills: {
        where: { status: "OPEN" },
        take: 1,
        orderBy: { openedAt: "desc" },
        select: {
          id: true,
          orders: {
            orderBy: { roundNumber: "asc" },
            select: {
              id: true,
              roundNumber: true,
              sentAt: true,
              items: {
                select: {
                  id: true,
                  productName: true,
                  quantity: true,
                  unitPrice: true,
                  allocations: { select: { amount: true } }
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return tables.map((table) => {
    const bill = table.bills[0] ?? null;
    const orders = bill?.orders ?? [];
    const items = orders.flatMap((order) => order.items);
    const summary = calculateBill(items);
    const lastOrder = orders.length ? orders[orders.length - 1] : null;

    return {
      id: table.id,
      name: table.name,
      seats: table.seats,
      sortOrder: table.sortOrder,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
      billId: bill?.id ?? null,
      billStatus: bill ? "OPEN" : "EMPTY",
      currentBillTotal: summary.remaining.toFixed(2),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      sentOrderCount: orders.length,
      lastActivityAt: lastOrder?.sentAt ?? null,
      sentOrders: orders.map((order) => ({
        id: order.id,
        roundNumber: order.roundNumber,
        sentAt: order.sentAt,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString()
        }))
      })),
      hasOpenBill: Boolean(bill),
      openTotal: summary.remaining,
      openOrderCount: orders.length
    };
  });
}

export const streamCashierEvents: RequestHandler = (_req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Ask EventSource to reconnect shortly after a dropped connection.
  res.write("retry: 3000\n\n");

  const unsubscribe = subscribeCashierUpdates((event) => {
    if (res.destroyed || res.writableEnded) return;
    res.write("event: cashier_update\n");
    res.write("data: " + JSON.stringify(event) + "\n\n");
  });

  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(": keep-alive\n\n");
    }
  }, 20000);

  res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};

export const getWaiterTables: RequestHandler = async (_req, res, next) => {
  try {
    const tables = await fetchTableSnapshots();
    res.setHeader("Cache-Control", "no-store");
    res.json({ tables });
  } catch (error) {
    next(error);
  }
};

export const createWaiterOrder: RequestHandler = async (req, res, next) => {
  const tableId = tableIdSchema.safeParse(req.params.tableId);
  const parsed = orderSchema.safeParse(req.body);
  if (!tableId.success || !parsed.success) {
    sendError(res, 400, "Masa veya sipariş ürünleri geçersiz.");
    return;
  }

  const authUser = res.locals.authUser as { userId?: string } | undefined;
  if (!authUser?.userId) {
    sendError(res, 401, "Garson oturumu bulunamadı. Yeniden giriş yapın.");
    return;
  }

  try {
    const table = await prisma.diningTable.findUnique({
      where: { id: tableId.data },
      select: { id: true, name: true }
    });
    if (!table) {
      sendError(res, 404, "Masa bulunamadı.");
      return;
    }

    const quantities = new Map<string, number>();
    parsed.data.items.forEach((item) => {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    });
    const productIds = Array.from(quantities.keys());
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
      select: { id: true, name: true, price: true }
    });
    if (products.length !== productIds.length) {
      sendError(res, 400, "Ürünlerden biri artık satışta değil. Menüyü yenileyip tekrar deneyin.");
      return;
    }

    const order = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.upsert({
        where: { activeTableId: table.id },
        create: { tableId: table.id, activeTableId: table.id },
        update: {}
      });
      const latest = await tx.order.aggregate({
        where: { billId: bill.id },
        _max: { roundNumber: true }
      });
      const nextRound = (latest._max.roundNumber ?? 0) + 1;
      const items = products.map((product) => ({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: quantities.get(product.id) ?? 0
      }));

      return tx.order.create({
        data: {
          billId: bill.id,
          waiterId: authUser.userId!,
          roundNumber: nextRound,
          items: { create: items }
        },
        include: { items: true }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    publishCashierUpdate({
      type: "order_created",
      tableId: table.id,
      tableName: table.name,
      orderId: order.id,
      roundNumber: order.roundNumber,
      occurredAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      table: { id: table.id, name: table.name },
      order: {
        id: order.id,
        roundNumber: order.roundNumber,
        sentAt: order.sentAt,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.productName,
          price: item.unitPrice.toString(),
          quantity: item.quantity
        }))
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      sendError(res, 409, "Masa siparişi aynı anda güncellendi. Lütfen yeniden deneyin.");
      return;
    }
    next(error);
  }
};

export const getCashierTables: RequestHandler = async (_req, res, next) => {
  try {
    const tables = await fetchTableSnapshots();
    res.setHeader("Cache-Control", "no-store");
    res.json({ tables });
  } catch (error) {
    next(error);
  }
};

export const getCashierBill: RequestHandler = async (req, res, next) => {
  const tableId = tableIdSchema.safeParse(req.params.tableId);
  if (!tableId.success) {
    sendError(res, 400, "Masa kimliği geçersiz.");
    return;
  }

  try {
    const bill = await prisma.bill.findFirst({
      where: { tableId: tableId.data, status: "OPEN" },
      include: {
        table: { select: { id: true, name: true, seats: true } },
        orders: {
          orderBy: { roundNumber: "asc" },
          include: {
            items: {
              orderBy: { createdAt: "asc" },
              include: {
                allocations: {
                  include: {
                    payment: { select: { method: true, createdAt: true } }
                  },
                  orderBy: { unitIndex: "asc" }
                }
              }
            }
          }
        }
      }
    });

    if (!bill) {
      sendError(res, 404, "Bu masa için açık adisyon bulunamadı.");
      return;
    }

    const orders = bill.orders.map((order) => ({
      id: order.id,
      roundNumber: order.roundNumber,
      sentAt: order.sentAt,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.productName,
        price: item.unitPrice.toString(),
        quantity: item.quantity,
        paidQuantity: item.allocations.length,
        unitPayments: item.allocations.map((allocation) => ({
          unitIndex: allocation.unitIndex,
          paymentMethod: allocation.payment.method.toLowerCase(),
          paidAt: allocation.payment.createdAt
        }))
      }))
    }));

    res.setHeader("Cache-Control", "no-store");
    res.json({ id: bill.id, table: bill.table, orders });
  } catch (error) {
    next(error);
  }
};

export const collectCashierPayment: RequestHandler = async (req, res, next) => {
  const tableId = tableIdSchema.safeParse(req.params.tableId);
  const parsed = collectSchema.safeParse(req.body);
  if (!tableId.success || !parsed.success) {
    sendError(res, 400, "Tahsilat bilgileri geçersiz.");
    return;
  }

  const authUser = res.locals.authUser as { userId?: string } | undefined;
  if (!authUser?.userId) {
    sendError(res, 401, "Kasiyer oturumu bulunamadı. Yeniden giriş yapın.");
    return;
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({
        where: { tableId: tableId.data, status: "OPEN" },
        select: { id: true }
      });
      if (!bill) throw new Error("OPEN_BILL_NOT_FOUND");

      const itemIds = Array.from(new Set(parsed.data.items.map((item) => item.itemId)));
      const orderItems = await tx.orderItem.findMany({
        where: { id: { in: itemIds }, order: { billId: bill.id } },
        include: {
          order: { select: { id: true } },
          allocations: { select: { unitIndex: true } }
        }
      });
      const itemMap = new Map<string, typeof orderItems[number]>();
      orderItems.forEach((item) => itemMap.set(item.id, item));
      let total = 0;
      const allocations: Array<{ orderItemId: string; unitIndex: number; amount: number }> = [];

      for (const selection of parsed.data.items) {
        const item = itemMap.get(selection.itemId);
        if (!item || item.order.id !== selection.orderId) {
          throw new Error("INVALID_BILL_ITEM");
        }
        if (selection.unitIndex > item.quantity) {
          throw new Error("INVALID_UNIT_INDEX");
        }
        if (item.allocations.some((allocation) => allocation.unitIndex === selection.unitIndex)) {
          throw new Error("UNIT_ALREADY_PAID");
        }

        const amount = Number(item.unitPrice);
        total += amount;
        allocations.push({
          orderItemId: item.id,
          unitIndex: selection.unitIndex,
          amount
        });
      }

      if (!(total > 0)) throw new Error("INVALID_PAYMENT_TOTAL");

      return tx.payment.create({
        data: {
          billId: bill.id,
          cashierId: authUser.userId!,
          method: parsed.data.paymentMethod === "card" ? "CARD" : "CASH",
          amount: Number(total.toFixed(2)),
          allocations: { create: allocations }
        },
        select: { id: true, amount: true, method: true, createdAt: true }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    publishCashierUpdate({
      type: "payment_recorded",
      tableId: tableId.data,
      occurredAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount.toString(),
        method: payment.method.toLowerCase(),
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "OPEN_BILL_NOT_FOUND") {
      sendError(res, 404, "Bu masa için açık adisyon bulunamadı.");
      return;
    }
    if (error instanceof Error && error.message === "INVALID_BILL_ITEM") {
      sendError(res, 400, "Seçilen ürün bu adisyona ait değil.");
      return;
    }
    if (error instanceof Error && error.message === "INVALID_UNIT_INDEX") {
      sendError(res, 400, "Seçilen ürün adedi geçersiz.");
      return;
    }
    if (error instanceof Error && error.message === "UNIT_ALREADY_PAID") {
      sendError(res, 409, "Seçilen ürün adedi daha önce tahsil edilmiş.");
      return;
    }
    if (error instanceof Error && error.message === "INVALID_PAYMENT_TOTAL") {
      sendError(res, 400, "Tahsilat tutarı geçersiz.");
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      sendError(res, 409, "Seçilen ürün adedi başka bir tahsilatta işlendi. Adisyonu yenileyin.");
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      sendError(res, 409, "Tahsilat aynı anda güncellendi. Adisyonu yenileyip tekrar deneyin.");
      return;
    }
    next(error);
  }
};

export const closeCashierBill: RequestHandler = async (req, res, next) => {
  const tableId = tableIdSchema.safeParse(req.params.tableId);
  if (!tableId.success) {
    sendError(res, 400, "Masa kimliği geçersiz.");
    return;
  }

  try {
    const closedBill = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({
        where: { tableId: tableId.data, status: "OPEN" },
        include: {
          orders: {
            include: {
              items: {
                include: { allocations: { select: { amount: true } } }
              }
            }
          }
        }
      });
      if (!bill) throw new Error("OPEN_BILL_NOT_FOUND");

      const items = bill.orders.flatMap((order) => order.items);
      const summary = calculateBill(items);
      if (summary.remaining > 0.001) {
        throw new Error("BILL_HAS_REMAINING_BALANCE:" + summary.remaining.toFixed(2));
      }

      return tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "CLOSED",
          activeTableId: null,
          closedAt: new Date()
        },
        select: { id: true, closedAt: true }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    publishCashierUpdate({
      type: "bill_closed",
      tableId: tableId.data,
      occurredAt: new Date().toISOString()
    });

    res.json({ success: true, bill: closedBill });
  } catch (error) {
    if (error instanceof Error && error.message === "OPEN_BILL_NOT_FOUND") {
      sendError(res, 404, "Bu masa için açık adisyon bulunamadı.");
      return;
    }
    if (error instanceof Error && error.message.startsWith("BILL_HAS_REMAINING_BALANCE:")) {
      const remaining = error.message.split(":")[1] ?? "0.00";
      sendError(res, 409, "Adisyon kapatılamaz. Kalan tutar: " + remaining + " TL.");
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      sendError(res, 409, "Adisyon aynı anda güncellendi. Yenileyip tekrar deneyin.");
      return;
    }
    next(error);
  }
};
