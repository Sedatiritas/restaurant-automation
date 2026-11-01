import { Router } from "express";
import { requireRole } from "../middlewares/auth.middleware.js";
import {
  closeCashierBill,
  collectCashierPayment,
  createWaiterOrder,
  getCashierBill,
  getCashierTables,
  getWaiterTables
} from "../controllers/orders.controller.js";

const router = Router();

// Waiter: submit a new order round for a dining table.
router.get("/api/waiter/tables", requireRole("WAITER"), getWaiterTables);
router.post("/api/waiter/tables/:tableId/orders", requireRole("WAITER"), createWaiterOrder);

// Cashier: read open bills, record partial/full payments and close settled bills.
router.get("/api/cashier/tables", requireRole("CASHIER"), getCashierTables);
router.get("/api/cashier/tables/:tableId/bill", requireRole("CASHIER"), getCashierBill);
router.post("/api/cashier/tables/:tableId/collect", requireRole("CASHIER"), collectCashierPayment);
router.post("/api/cashier/tables/:tableId/close", requireRole("CASHIER"), closeCashierBill);

export default router;
