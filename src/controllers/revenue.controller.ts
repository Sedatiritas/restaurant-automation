import { z } from "zod";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Rapor ayı YYYY-AA biçiminde olmalıdır.");

type DailyRevenue = {
  date: string;
  totalCents: number;
  cashCents: number;
  cardCents: number;
  count: number;
};

function moneyFromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function istanbulDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

export const getAdminRevenueReport: RequestHandler = async (req, res, next) => {
  const parsedMonth = monthSchema.safeParse(req.query.month);
  if (!parsedMonth.success) {
    res.status(400).json({ error: parsedMonth.error.issues[0]?.message ?? "Rapor ayı geçersiz." });
    return;
  }

  try {
    const [year, month] = parsedMonth.data.split("-").map(Number);

    // Report boundaries follow Turkey's local calendar (UTC+3).
    const startAt = new Date(Date.UTC(year, month - 1, 1) - 3 * 60 * 60 * 1000);
    const endAt = new Date(Date.UTC(year, month, 1) - 3 * 60 * 60 * 1000);

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startAt, lt: endAt }
      },
      select: {
        amount: true,
        method: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    });

    let totalCents = 0;
    let cashCents = 0;
    let cardCents = 0;
    const daily = new Map<string, DailyRevenue>();

    for (const payment of payments) {
      const amountCents = Math.round(Number(payment.amount) * 100);
      const date = istanbulDateKey(payment.createdAt);
      totalCents += amountCents;

      if (payment.method === "CASH") cashCents += amountCents;
      else if (payment.method === "CARD") cardCents += amountCents;

      let day = daily.get(date);
      if (!day) {
        day = { date, totalCents: 0, cashCents: 0, cardCents: 0, count: 0 };
        daily.set(date, day);
      }

      day.totalCents += amountCents;
      day.count += 1;
      if (payment.method === "CASH") day.cashCents += amountCents;
      else if (payment.method === "CARD") day.cardCents += amountCents;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      month: parsedMonth.data,
      summary: {
        total: moneyFromCents(totalCents),
        cash: moneyFromCents(cashCents),
        card: moneyFromCents(cardCents),
        count: payments.length
      },
      days: Array.from(daily.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((day) => ({
          date: day.date,
          total: moneyFromCents(day.totalCents),
          cash: moneyFromCents(day.cashCents),
          card: moneyFromCents(day.cardCents),
          count: day.count
        }))
    });
  } catch (error) {
    next(error);
  }
};
