import { Router } from "express";
import {
  createGameController,
  getGameController,
  startGameController,
  hitController,
  standController,
  getTurnController,
  listGamesController,
  changeHandController,
  restartGameController,
} from "../controllers/game.controller.js";

const router = Router();

// Listar todas las partidas
router.get("/", listGamesController);

// Crear nueva partida (3-5 jugadores)
router.post("/create", createGameController);

// Obtener información de una partida
router.get("/:id", getGameController);

// Iniciar partida
router.post("/:id/start", startGameController);

// Reiniciar partida (nueva ronda)
router.post("/:id/restart", restartGameController);

// Ver turno actual
router.get("/:id/turn", getTurnController);

// Pedir carta (hit)
router.post("/:id/hit", hitController);

// Plantarse (stand)
router.post("/:id/stand", standController);

// Cambiar mano (cuando suma 12)
router.post("/:id/change-hand", changeHandController);

export default router;
