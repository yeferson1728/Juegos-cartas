import express from "express";
import morgan from "morgan";

import gameRoutes from "./routes/game.routes.js";

const app = express();

/* ======================
   Middlewares globales
====================== */
app.use(express.json()); // Leer body en JSON
app.use(morgan("dev")); // Logs en consola

/* ======================
   Ruta base (health check)
====================== */
app.get("/", (req, res) => res.json({ status: "ok", name: "RELANCINA API" }));

/* ======================
   Rutas del juego
====================== */
app.use("/api/game", gameRoutes);

/* ======================
   404 - Ruta no encontrada
====================== */
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
  });
});

export default app;
