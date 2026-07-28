import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import { authRateLimiter } from "./middleware/rate-limit";
import { authRouter } from "./routes/auth";
import { basketsRouter } from "./routes/baskets";
import { commoditiesRouter } from "./routes/commodities";
import { communityPricesRouter } from "./routes/community-prices";
import { marketsRouter } from "./routes/markets";
import { modelRouter } from "./routes/model";
import { newsRouter } from "./routes/news";
import { pricesRouter } from "./routes/prices";
import { predictionsRouter } from "./routes/predictions";

// Express app factory, kept separate from index.ts's listen() call so tests
// can import and exercise the app directly via supertest without binding a
// port.
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRateLimiter, authRouter);
  app.use("/api/markets", marketsRouter);
  app.use("/api/commodities", commoditiesRouter);
  app.use("/api/prices", pricesRouter);
  app.use("/api/community-prices", communityPricesRouter);
  app.use("/api/predictions", predictionsRouter);
  app.use("/api/news", newsRouter);
  app.use("/api/model", modelRouter);
  app.use("/api/baskets", basketsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
