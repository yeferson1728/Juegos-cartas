import {
  createGame,
  getGameById,
  startGame,
  hit,
  stand,
  listGames,
  getCurrentTurn,
  changeHand,
  restartGame,
  chooseAceValue,
  placeBet,
  getBets,
  houseHit,
  houseStand,
  houseChooseAce,
  resolveWinners,
  disconnectPlayer,
} from "../services/game.service.js";

/* Crear partida */
export const createGameController = (req, res) => {
  try {
    const { players } = req.body || {};
    const game = createGame({ players });

    return res.status(201).json({
      success: true,
      message: `Partida creada exitosamente con ${game.players.length} jugadores`,
      game: {
        id: game.id,
        state: game.state,
        playerCount: game.players.length,
        players: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          credits: p.credits,
          isHouse: p.isHouse,
        })),
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Se requieren entre 3 y 5 jugadores para crear una partida",
    });
  }
};

/* Obtener partida */
export const getGameController = (req, res) => {
  try {
    const game = getGameById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        error: "Partida no encontrada",
      });
    }

    return res.json({
      success: true,
      game: {
        id: game.id,
        state: game.state,
        houseId: game.houseId,
        turnIndex: game.turnIndex,
        currentPlayer: game.players[game.turnIndex]?.name,
        deckInfo: {
          cardsRemaining: game.deck.length,
          discardedCards: game.discardPile?.length || 0,
          totalReshuffles: game.deckReshuffles || 0,
        },
        players: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          credits: p.credits,
          handCount: p.hand.length,
          status: p.status,
          isHouse: p.isHouse,
          hand: game.state !== "WAITING" ? p.hand : [],
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/* Iniciar partida */
export const startGameController = (req, res) => {
  try {
    const game = startGame(req.params.id);

    const house = game.players.find((p) => p.isHouse);
    const playersWithSpecial = game.players.filter(
      (p) => p.handAnalysis?.special && p.handAnalysis.special !== "CAN_CHANGE"
    );

    return res.json({
      success: true,
      message: "Partida iniciada",
      game: {
        id: game.id,
        state: game.state,
        housePlayer: house?.name,
        currentTurn: game.players.find(
          (p) => p.id === game.playOrder[game.turnIndex]
        )?.name,
        playOrder: game.playOrder.map(
          (id) => game.players.find((p) => p.id === id)?.name
        ),
        players: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          handCount: p.hand.length,
          isHouse: p.isHouse,
          status: p.status,
          handTotal: p.handAnalysis?.total,
          special: p.handAnalysis?.special,
        })),
        specialHands:
          playersWithSpecial.length > 0
            ? playersWithSpecial.map((p) => ({
                name: p.name,
                special: p.handAnalysis.special,
              }))
            : null,
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

/* Hit (pedir carta) - CON MEJOR MANEJO DE ERRORES */
export const hitController = (req, res) => {
  try {
    // Debug: ver qué está llegando
    console.log("Body:", req.body);
    console.log("Query:", req.query);
    console.log("Params:", req.params);

    const playerId =
      req.body?.playerId || req.query?.playerId || req.params?.playerId;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: "playerId es requerido",
        debug: {
          body: req.body,
          query: req.query,
          params: req.params,
        },
      });
    }

    const result = hit(req.params.id, playerId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Verifica que sea tu turno y que la partida esté en curso",
    });
  }
};

/* Stand (plantarse) - CON MEJOR MANEJO DE ERRORES */
export const standController = (req, res) => {
  try {
    const { playerId } = req.body || {};

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: "playerId es requerido",
      });
    }

    const result = stand(req.params.id, playerId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Verifica que sea tu turno y que la partida esté en curso",
    });
  }
};

/* Obtener turno actual - MEJORADO */
export const getTurnController = (req, res) => {
  try {
    const turnInfo = getCurrentTurn(req.params.id);
    return res.json({
      success: true,
      ...turnInfo,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/* Listar todas las partidas */
export const listGamesController = (req, res) => {
  try {
    const all = listGames();
    return res.json({
      success: true,
      count: all.length,
      games: all.map((g) => ({
        id: g.id,
        state: g.state,
        playerCount: g.players.length,
        createdAt: g.createdAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/* Cambiar mano (cuando suma 12) */
export const changeHandController = (req, res) => {
  try {
    const { playerId } = req.body || {};

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: "playerId es requerido",
      });
    }

    const result = changeHand(req.params.id, playerId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Solo puedes cambiar la mano si sumas 12 con las 2 primeras cartas",
    });
  }
};

/* Reiniciar partida (nueva ronda) */
export const restartGameController = (req, res) => {
  try {
    const game = restartGame(req.params.id);

    const house = game.players.find((p) => p.isHouse);

    return res.json({
      success: true,
      message: "Nueva ronda iniciada",
      game: {
        id: game.id,
        state: game.state,
        housePlayer: house?.name,
        currentTurn: game.players.find(
          (p) => p.id === game.playOrder[game.turnIndex]
        )?.name,
        players: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          handCount: p.hand.length,
          isHouse: p.isHouse,
          status: p.status,
          handTotal: p.handAnalysis?.total,
          special: p.handAnalysis?.special,
        })),
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Solo puedes reiniciar una partida terminada",
    });
  }
};

/* Elegir valor del AS (1 u 11) */
export const chooseAceValueController = (req, res) => {
  try {
    const { playerId, aceIndex, value } = req.body || {};

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: "playerId es requerido",
      });
    }

    if (aceIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: "aceIndex es requerido (índice de la carta AS en tu mano)",
      });
    }

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: "value es requerido (1 u 11)",
      });
    }

    const result = chooseAceValue(req.params.id, playerId, aceIndex, value);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "El AS solo puede valer 1 u 11, y no puedes cambiarlo si tienes 21 natural",
    });
  }
};

/* Colocar apuesta */
export const placeBetController = (req, res) => {
  try {
    const { playerId, amount } = req.body || {};

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: "playerId es requerido",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "amount es requerido y debe ser mayor a 0",
      });
    }

    const result = placeBet(req.params.id, playerId, amount);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Apuesta mínima: 200 créditos, máxima: 5,000 créditos",
    });
  }
};

/* Ver apuestas de todos los jugadores */
export const getBetsController = (req, res) => {
  try {
    const result = getBets(req.params.id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/* Casa pide carta */
export const houseHitController = (req, res) => {
  try {
    const result = houseHit(req.params.id);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Solo puede usarse cuando es turno de la Casa (estado HOUSE_TURN)",
    });
  }
};

/* Casa se planta */
export const houseStandController = (req, res) => {
  try {
    const result = houseStand(req.params.id);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Solo puede usarse cuando es turno de la Casa (estado HOUSE_TURN)",
    });
  }
};

/* Casa elige valor del AS */
export const houseChooseAceController = (req, res) => {
  try {
    const { aceIndex, value } = req.body || {};

    if (aceIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: "aceIndex es requerido",
      });
    }

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: "value es requerido (1 u 11)",
      });
    }

    const result = houseChooseAce(req.params.id, aceIndex, value);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "El AS solo puede valer 1 u 11",
    });
  }
};

/* Resolver ganadores manualmente */
export const resolveWinnersController = (req, res) => {
  try {
    const result = resolveWinners(req.params.id);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      hint: "Solo se pueden resolver ganadores cuando la partida está FINISHED",
    });
  }
};
/* Desconectar jugador */
export const disconnectPlayerController = (req, res) => {
  try {
    const { playerId } = req.body || {};
    
    if (!playerId) {
      return res.status(400).json({ 
        success: false,
        error: "playerId es requerido" 
      });
    }
    
    const result = disconnectPlayer(req.params.id, playerId);
    return res.json(result);
    
  } catch (err) {
    return res.status(400).json({ 
      success: false,
      error: err.message
    });
  }
};