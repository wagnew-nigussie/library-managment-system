import express from "express";
import cors from "cors";
import apiRoutes from "./routes/index.js";
import authRoutes from "./routes/auth.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Library Management System API" });
});

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
