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
  chooseAceValueController,
  placeBetController,
  getBetsController,
  houseHitController,
  houseStandController,
  houseChooseAceController,
  resolveWinnersController,
  disconnectPlayerController,
} from "../controllers/game.controller.js";

const router = Router();

// Listar todas las partidas
router.get("/", listGamesController);

// Crear nueva partida (3-5 jugadores)
router.post("/create", createGameController);

// Obtener información de una partida
router.get("/:id", getGameController);

// Colocar apuesta
router.post("/:id/bet", placeBetController);

// Ver apuestas
router.get("/:id/bets", getBetsController);

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

// Elegir valor del AS (1 u 11)
router.post("/:id/choose-ace", chooseAceValueController);

// Desconectar jugador
router.post("/:id/disconnect", disconnectPlayerController);

// === ENDPOINTS DE LA CASA ===

// Casa pide carta
router.post("/:id/house/hit", houseHitController);

// Casa se planta
router.post("/:id/house/stand", houseStandController);

// Casa elige valor del AS
router.post("/:id/house/choose-ace", houseChooseAceController);

// === RESOLUCIÓN DE GANADORES ===

// Resolver ganadores (se llama automáticamente, pero está disponible manual)
router.post("/:id/resolve", resolveWinnersController);

export default router;
