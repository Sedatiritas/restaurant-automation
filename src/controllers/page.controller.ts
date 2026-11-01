import type { RequestHandler } from "express";

export const renderLogin: RequestHandler = (_req, res) => {
  res.render("auth/login", { error: null, selectedRole: "", email: "" });
};

export const renderMenu: RequestHandler = (_req, res) => {
  res.render("menu/index");
};

export const renderAdmin: RequestHandler = (_req, res) => {
  res.render("admin/index");
};

export const renderWaiter: RequestHandler = (_req, res) => {
  res.render("waiter/index");
};

export const renderCashier: RequestHandler = (_req, res) => {
  res.render("cashier/index");
};
