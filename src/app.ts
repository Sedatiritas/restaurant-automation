import express from "express";
import helmet from "helmet";
import { resolve } from "node:path";
import pageRoutes from "./routes/page.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";

const app = express();

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", resolve(process.cwd(), "views"));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"]
      }
    }
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static(resolve(process.cwd(), "public")));

app.use(authRoutes);
app.use(pageRoutes);
app.use(notFoundHandler);

export default app;
