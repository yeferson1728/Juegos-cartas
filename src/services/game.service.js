import { Game, Player } from "../models/game.model.js";
import { randomUUID } from "crypto";
import { createDeck, drawCard } from "./deck.service.js";
import {
  analyzeHand,
  canHit,
  calculateTotalMultiplier,
} from "./rules.service.js";

const games = new Map(); // almacén en memoria de partidas

/* ========================================
   FUNCIONES AUXILIARES
======================================== */

/**
 * Función auxiliar para barajar un array (Fisher-Yates)
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Revuelve las cartas descartadas y las agrega al deck
 */
const reshuffleDiscardedCards = (game) => {
  if (!game.discardPile || game.discardPile.length === 0) {
    console.log("⚠️ No hay cartas descartadas para revolver");
    return;
  }

  console.log(
    `🔄 Revolviendo ${game.discardPile.length} cartas descartadas...`
  );

  // Barajar las cartas descartadas
  const shuffled = shuffleArray([...game.discardPile]);

  // Agregar al deck
  game.deck.push(...shuffled);

  // Incrementar contador
  game.deckReshuffles = (game.deckReshuffles || 0) + 1;

  // Limpiar pila de descarte
  game.discardPile = [];

  console.log(
    `✅ Deck recargado. Ahora hay ${game.deck.length} cartas disponibles (Reshuffle #${game.deckReshuffles})`
  );
};

/**
 * Saca una carta del deck con manejo de deck vacío
 */
const drawCardSafe = (game) => {
  // Si el deck está vacío, revolver las descartadas
  if (game.deck.length === 0) {
    console.log("🃏 Deck vacío! Revolviendo cartas descartadas...");
    reshuffleDiscardedCards(game);
  }

  // Si aún está vacío después de revolver, no hay más cartas
  if (game.deck.length === 0) {
    throw new Error("No quedan cartas disponibles en el juego");
  }

  return drawCard(game);
};

/**
 * Valida que sea el turno del jugador
 */
const validatePlayerTurn = (game, playerId) => {
  if (game.state !== "PLAYING") {
    throw new Error("La partida no está en curso");
  }

  const currentPlayerId = game.playOrder[game.turnIndex];
  const currentPlayer = game.players.find((p) => p.id === currentPlayerId);

  if (!currentPlayer) {
    throw new Error("No hay jugador en turno");
  }

  if (currentPlayer.id !== playerId) {
    throw new Error(`No es tu turno. Turno actual: ${currentPlayer.name}`);
  }

  // VALIDACIÓN: Si ya se pasó (BUST), no puede jugar
  if (currentPlayer.status === "BUST") {
    throw new Error("Ya te pasaste de 21. Has perdido contra la Casa.");
  }

  if (currentPlayer.status === "STAND") {
    throw new Error("Ya te plantaste. Espera a que terminen los demás.");
  }

  return currentPlayer;
};

/**
 * Verifica si todos los jugadores (excepto la Casa) terminaron
 */
const allPlayersDone = (game) => {
  return game.playOrder.every((playerId) => {
    const player = game.players.find((p) => p.id === playerId);
    return player.status === "STAND" || player.status === "BUST";
  });
};

/**
 * Avanza al siguiente turno siguiendo el playOrder
 */
const advanceTurn = (game) => {
  if (!game || game.state !== "PLAYING") return;

  // Avanzar al siguiente índice en playOrder
  game.turnIndex++;

  // Buscar el siguiente jugador activo (skip desconectados)
  while (game.turnIndex < game.playOrder.length) {
    const nextPlayerId = game.playOrder[game.turnIndex];
    const nextPlayer = game.players.find((p) => p.id === nextPlayerId);

    // Si el jugador está activo y conectado, es su turno
    if (
      nextPlayer &&
      nextPlayer.status === "ACTIVE" &&
      nextPlayer.isConnected
    ) {
      console.log(
        `➡️  Turno avanzado a: ${nextPlayer.name} (${game.turnIndex + 1}/${
          game.playOrder.length
        })`
      );
      return;
    }

    // Si está desconectado o no activo, saltar al siguiente
    game.turnIndex++;
  }

  // Si llegamos al final del playOrder, todos terminaron
  if (game.turnIndex >= game.playOrder.length) {
    // Descartar todas las cartas de los jugadores
    game.players.forEach((player) => {
      if (player.hand.length > 0) {
        game.discardPile.push(...player.hand);
      }
    });

    console.log(
      `♻️ Fin de ronda. ${game.discardPile.length} cartas descartadas en total.`
    );

    // Verificar si hay suficientes jugadores
    if (!checkMinimumPlayers(game)) {
      return;
    }

    // Cambiar a turno de la Casa
    game.state = "HOUSE_TURN";
    console.log("🏠 Todos los jugadores terminaron. Turno de la Casa.");
    return;
  }
};

/* ========================================
   FUNCIONES PÚBLICAS EXPORTADAS
======================================== */

/**
 * Crea un juego con validación de jugadores (3-5)
 */
export const createGame = ({ players = [] } = {}) => {
  // VALIDACIÓN: Mínimo 3, máximo 5 jugadores
  if (players.length < 3) {
    throw new Error("Se requieren mínimo 3 jugadores para crear una partida");
  }

  if (players.length > 5) {
    throw new Error("Máximo 5 jugadores permitidos por partida");
  }

  const id = randomUUID();
  const deck = createDeck();
  const playersState = players.map((p, idx) => ({
    id: p?.id ?? randomUUID(),
    name: p?.name ?? `Player-${idx + 1}`,
    credits: p?.credits ?? 10000,
    hand: p?.hand ?? [],
    bet: p?.bet ?? 0,
    isHouse: p?.isHouse ?? false,
    status: p?.status ?? "ACTIVE",
    handAnalysis: null,
    hasChangedHand: false,
    aceChoices: {}, // Decisiones del jugador sobre el valor de los Ases
    isConnected: true, // Estado de conexión
  }));

  const game = {
    id,
    players: playersState,
    houseId: null,
    state: "WAITING",
    deck,
    discardPile: [], // Pila de cartas descartadas
    turnIndex: 0,
    playOrder: [], // Orden de juego (IDs de jugadores, sin la Casa)
    createdAt: new Date(),
    deckReshuffles: 0, // Contador de veces que se ha revuelto el deck
  };

  games.set(id, game);
  return game;
};

export const getGameById = (id) => games.get(id);

export const listGames = () => Array.from(games.values());

/**
 * Inicia la partida: asigna Casa, establece orden de turnos y reparte cartas
 */
export const startGame = (gameId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  // Permitir reiniciar si está FINISHED
  if (game.state !== "WAITING" && game.state !== "FINISHED") {
    throw new Error("La partida ya está en curso");
  }

  // VALIDAR QUE TODOS LOS JUGADORES (excepto Casa) HAYAN APOSTADO
  if (game.state === "WAITING") {
    const playersWithoutBets = game.players.filter(
      (p) => !p.isHouse && p.bet === 0
    );
    if (playersWithoutBets.length > 0) {
      const names = playersWithoutBets.map((p) => p.name).join(", ");
      throw new Error(
        `Todos los jugadores deben apostar antes de iniciar. Falta: ${names}`
      );
    }
  }

  // Si no hay Casa asignada, asignar al primer jugador
  if (!game.houseId && game.players.length > 0) {
    game.houseId = game.players[0].id;
    const house = game.players.find((p) => p.id === game.houseId);
    if (house) house.isHouse = true;
  }

  // Reset manos y estado (mantener isHouse y créditos, pero NO las apuestas)
  game.players.forEach((p) => {
    p.hand = [];
    p.status = "ACTIVE";
    // NO resetear bet aquí - ya fue deducida al apostar
    p.handAnalysis = null;
    p.hasChangedHand = false;
    p.aceChoices = {}; // Reset decisiones de Ases
  });

  // ESTABLECER ORDEN DE JUEGO (todos excepto la Casa)
  game.playOrder = game.players.filter((p) => !p.isHouse).map((p) => p.id);

  console.log("🏠 Casa:", game.players.find((p) => p.isHouse)?.name);
  console.log(
    "📋 Orden de juego:",
    game.playOrder.map((id) => game.players.find((p) => p.id === id)?.name)
  );

  // Repartir 2 cartas a cada jugador
  for (let i = 0; i < 2; i++) {
    for (const player of game.players) {
      const card = drawCardSafe(game);
      if (card) player.hand.push(card);
    }
  }

  console.log(`📦 Cartas restantes en el deck: ${game.deck.length}`);

  // Variable para detectar nuevo cambio de Casa
  let newHouseId = null;

  // Analizar manos iniciales y detectar reglas especiales
  game.players.forEach((p) => {
    const analysis = analyzeHand(p.hand, p.aceChoices);
    p.handAnalysis = analysis;

    // Si tiene Doble 2 o Doble As, se planta automáticamente
    if (analysis.isDouble2 || analysis.isDoubleA) {
      p.status = "STAND";
      console.log(
        `${p.name} tiene ${analysis.special} - Se planta automáticamente`
      );
    }

    // 🏆 REGLA: Si saca 21 con las 2 primeras cartas (21 natural)
    // Los Ases valen 11 automáticamente (no hay decisión)
    if (analysis.is21 && !p.isHouse && !newHouseId) {
      newHouseId = p.id;
      console.log(`🏆 ${p.name} sacó 21 natural con las primeras 2 cartas!`);
    }
  });

  // Si hay nuevo candidato a Casa
  if (newHouseId) {
    // Quitar Casa del jugador anterior
    const oldHouse = game.players.find((p) => p.id === game.houseId);
    if (oldHouse) {
      oldHouse.isHouse = false;
    }

    // Asignar nueva Casa
    const newHouse = game.players.find((p) => p.id === newHouseId);
    if (newHouse) {
      newHouse.isHouse = true;
      game.houseId = newHouseId;
      console.log(`🔄 Cambio de Casa: ${newHouse.name} es la nueva Casa`);

      // Recalcular playOrder sin la nueva Casa
      game.playOrder = game.players.filter((p) => !p.isHouse).map((p) => p.id);
    }
  }

  game.state = "PLAYING";
  game.turnIndex = 0;

  return game;
};

/**
 * Obtiene información del turno actual
 */
export const getCurrentTurn = (gameId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  if (game.state === "FINISHED") {
    return {
      gameId: game.id,
      state: game.state,
      message: "La partida ha terminado",
      currentPlayer: null,
    };
  }

  if (game.state === "HOUSE_TURN") {
    const house = game.players.find((p) => p.isHouse);
    return {
      gameId: game.id,
      state: game.state,
      currentPlayer: {
        id: house.id,
        name: house.name,
        isHouse: true,
        handCount: house.hand.length,
        handTotal: house.handAnalysis?.total,
      },
      message: "🏠 Turno de la Casa",
    };
  }

  const currentPlayerId = game.playOrder[game.turnIndex];
  const currentPlayer = game.players.find((p) => p.id === currentPlayerId);

  return {
    gameId: game.id,
    state: game.state,
    turnIndex: game.turnIndex,
    playOrderPosition: `${game.turnIndex + 1}/${game.playOrder.length}`,
    currentPlayer: currentPlayer
      ? {
          id: currentPlayer.id,
          name: currentPlayer.name,
          status: currentPlayer.status,
          isHouse: currentPlayer.isHouse,
          handCount: currentPlayer.hand.length,
          handTotal: currentPlayer.handAnalysis?.total,
        }
      : null,
    message: currentPlayer
      ? `Turno de ${currentPlayer.name} (${game.turnIndex + 1}/${
          game.playOrder.length
        })`
      : "No hay jugador en turno",
  };
};

/**
 * Pedir carta (hit) - CON TODAS LAS VALIDACIONES
 */
export const hit = (gameId, playerId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  // VALIDAR QUE SEA SU TURNO
  const player = validatePlayerTurn(game, playerId);

  // Analizar mano actual
  const currentAnalysis = analyzeHand(player.hand);

  // Verificar si puede pedir carta
  if (!canHit(player, currentAnalysis)) {
    throw new Error("No puedes pedir más cartas en esta situación");
  }

  // Si tiene mano especial que no permite más cartas
  if (currentAnalysis.isDouble2 || currentAnalysis.isDoubleA) {
    throw new Error(
      `Tienes ${currentAnalysis.special} - No puedes pedir más cartas`
    );
  }

  const card = drawCardSafe(game);
  if (card) player.hand.push(card);

  const analysis = analyzeHand(player.hand);
  player.handAnalysis = analysis;

  // Si se pasa, marcarlo como BUST y AVANZAR TURNO AUTOMÁTICAMENTE
  if (analysis.isBust) {
    player.status = "BUST";
    console.log(`💥 ${player.name} se pasó de 21 con ${analysis.total}. BUST!`);
    advanceTurn(game);
  }

  // Calcular multiplicador total
  const totalMultiplier = calculateTotalMultiplier(analysis);

  console.log(
    `📦 Cartas restantes: ${game.deck.length} | Descartadas: ${game.discardPile.length}`
  );

  return {
    success: true,
    player: {
      id: player.id,
      name: player.name,
      hand: player.hand,
      handTotal: analysis.total,
      status: player.status,
      analysis: {
        isBust: analysis.isBust,
        is21: analysis.is21,
        is20_5: analysis.is20_5,
        special: analysis.special,
        bonusMultiplier: analysis.bonusMultiplier,
        cardCountMultiplier: analysis.cardCountMultiplier,
        totalMultiplier: totalMultiplier,
        hasAces: analysis.hasAces,
        aceCount: analysis.aceCount,
        aceIndices: analysis.aceIndices,
      },
    },
    card: card,
    game: {
      id: game.id,
      state: game.state,
      turnIndex: game.turnIndex,
      currentPlayer:
        game.state === "PLAYING" && game.turnIndex < game.playOrder.length
          ? game.players.find((p) => p.id === game.playOrder[game.turnIndex])
              ?.name
          : null,
      deckInfo: {
        cardsRemaining: game.deck.length,
        discardedCards: game.discardPile.length,
        totalReshuffles: game.deckReshuffles,
      },
    },
    message: analysis.isBust
      ? `💥 ${player.name} se pasó de 21 con ${
          analysis.total
        }. Has perdido contra la Casa. Turno de ${
          game.state === "PLAYING" && game.turnIndex < game.playOrder.length
            ? game.players.find((p) => p.id === game.playOrder[game.turnIndex])
                ?.name
            : "nadie"
        }`
      : analysis.special
      ? `${player.name} sacó ${card.value}${card.suit || ""}. Total: ${
          analysis.total
        } - ${analysis.special}`
      : `${player.name} sacó ${card.value}${card.suit || ""}. Total: ${
          analysis.total
        }`,
  };
};

/**
 * El jugador decide plantarse (stand)
 */
export const stand = (gameId, playerId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  // Permitir stand incluso si está BUST (para avanzar turno)
  const currentPlayerId = game.playOrder[game.turnIndex];
  const player = game.players.find((p) => p.id === currentPlayerId);

  if (!player) {
    throw new Error("No hay jugador en turno");
  }

  if (player.id !== playerId) {
    throw new Error(`No es tu turno. Turno actual: ${player.name}`);
  }

  const analysis = analyzeHand(player.hand, player.aceChoices);
  player.handAnalysis = analysis;

  // Cambiar status a STAND (incluso si está BUST)
  if (player.status !== "BUST") {
    player.status = "STAND";
  }

  // AVANZAR TURNO
  advanceTurn(game);

  // Verificar si hay suficientes jugadores
  if (!checkMinimumPlayers(game)) {
    return {
      success: true,
      player: {
        id: player.id,
        name: player.name,
        hand: player.hand,
        handTotal: analysis.total,
        status: player.status,
      },
      game: {
        id: game.id,
        state: game.state,
      },
      message: `${player.name} se plantó. Quedan menos de 2 jugadores. Partida terminada.`,
      gameEnded: true,
    };
  }

  const totalMultiplier = calculateTotalMultiplier(analysis);

  return {
    success: true,
    player: {
      id: player.id,
      name: player.name,
      hand: player.hand,
      handTotal: analysis.total,
      status: player.status,
      analysis: {
        is21: analysis.is21,
        is20_5: analysis.is20_5,
        isBust: analysis.isBust,
        special: analysis.special,
        bonusMultiplier: analysis.bonusMultiplier,
        cardCountMultiplier: analysis.cardCountMultiplier,
        totalMultiplier: totalMultiplier,
      },
    },
    game: {
      id: game.id,
      state: game.state,
      turnIndex: game.turnIndex,
      currentPlayer:
        game.state === "PLAYING"
          ? game.players.find((p) => p.id === game.playOrder[game.turnIndex])
              ?.name
          : null,
    },
    message:
      player.status === "BUST"
        ? `${player.name} perdió con ${analysis.total}. Turno terminado.`
        : analysis.special
        ? `${player.name} se plantó con ${analysis.total} - ${analysis.special} (x${totalMultiplier})`
        : `${player.name} se plantó con ${analysis.total}`,
  };
};

/**
 * Cambiar mano completa (solo si suma 12 con las 2 primeras cartas)
 */
export const changeHand = (gameId, playerId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  const player = validatePlayerTurn(game, playerId);

  if (player.hand.length !== 2) {
    throw new Error("Solo puedes cambiar la mano inicial (2 cartas)");
  }

  const analysis = analyzeHand(player.hand, player.aceChoices);
  if (!analysis.canChangeHand) {
    throw new Error("Solo puedes cambiar la mano si sumas 12");
  }

  if (player.hasChangedHand) {
    throw new Error("Ya cambiaste tu mano una vez");
  }

  // Descartar mano actual
  const oldHand = [...player.hand];
  game.discardPile.push(...oldHand);
  player.hand = [];
  player.aceChoices = {}; // Reset decisiones de Ases

  console.log(
    `♻️ ${player.name} descartó 2 cartas. Total descartadas: ${game.discardPile.length}`
  );

  // Dar 2 cartas nuevas
  for (let i = 0; i < 2; i++) {
    const card = drawCardSafe(game);
    if (card) player.hand.push(card);
  }

  player.hasChangedHand = true;

  const newAnalysis = analyzeHand(player.hand, player.aceChoices);
  player.handAnalysis = newAnalysis;

  return {
    success: true,
    player: {
      id: player.id,
      name: player.name,
      oldHand: oldHand,
      newHand: player.hand,
      handTotal: newAnalysis.total,
      status: player.status,
      hasChangedHand: true,
      hasAces: newAnalysis.hasAces,
      aceCount: newAnalysis.aceCount,
      analysis: {
        total: newAnalysis.total,
        canChangeHand: false,
        special: null,
      },
    },
    game: {
      id: game.id,
      state: game.state,
      turnIndex: game.turnIndex,
      currentPlayer: game.players.find(
        (p) => p.id === game.playOrder[game.turnIndex]
      )?.name,
      deckInfo: {
        cardsRemaining: game.deck.length,
        discardedCards: game.discardPile.length,
      },
    },
    message: `${player.name} cambió su mano. Nueva suma: ${newAnalysis.total}`,
  };
};

/**
 * Permite al jugador colocar su apuesta antes de iniciar la ronda
 */
export const placeBet = (gameId, playerId, betAmount) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  // Solo se puede apostar cuando el juego está en WAITING
  if (game.state !== "WAITING") {
    throw new Error("Solo puedes apostar antes de iniciar la ronda");
  }

  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Player not found");

  // Validar apuesta mínima
  const MIN_BET = 200;
  if (betAmount < MIN_BET) {
    throw new Error(`La apuesta mínima es ${MIN_BET} créditos`);
  }

  // Validar apuesta máxima
  const MAX_BET = 5000;
  if (betAmount > MAX_BET) {
    throw new Error(`La apuesta máxima es ${MAX_BET} créditos`);
  }

  // Validar que tenga créditos suficientes
  if (player.credits < betAmount) {
    throw new Error(
      `No tienes suficientes créditos. Tienes: ${player.credits}, necesitas: ${betAmount}`
    );
  }

  // Deducir la apuesta de los créditos
  player.credits -= betAmount;
  player.bet = betAmount;

  console.log(
    `💰 ${player.name} apostó ${betAmount} créditos. Créditos restantes: ${player.credits}`
  );

  return {
    success: true,
    player: {
      id: player.id,
      name: player.name,
      bet: player.bet,
      credits: player.credits,
    },
    message: `${player.name} apostó ${betAmount} créditos`,
  };
};

/**
 * Obtiene información de las apuestas de todos los jugadores
 */
export const getBets = (gameId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  const betsInfo = game.players.map((p) => ({
    id: p.id,
    name: p.name,
    bet: p.bet,
    credits: p.credits,
    isHouse: p.isHouse,
    hasBet: p.bet > 0,
  }));

  const totalBets = game.players.reduce((sum, p) => sum + p.bet, 0);
  const playersWithBets = game.players.filter(
    (p) => p.bet > 0 && !p.isHouse
  ).length;
  const totalPlayers = game.players.filter((p) => !p.isHouse).length;

  return {
    success: true,
    gameId: game.id,
    state: game.state,
    bets: betsInfo,
    summary: {
      totalBets,
      playersWithBets,
      totalPlayers,
      allPlayersReady: playersWithBets === totalPlayers,
    },
  };
};
export const chooseAceValue = (gameId, playerId, aceIndex, value) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  const player = validatePlayerTurn(game, playerId);

  // Validar que el índice sea válido
  if (aceIndex < 0 || aceIndex >= player.hand.length) {
    throw new Error("Índice de carta inválido");
  }

  // Validar que la carta sea un AS
  if (player.hand[aceIndex].value !== "A") {
    throw new Error("La carta seleccionada no es un AS");
  }

  // Validar que el valor sea 1 u 11
  if (value !== 1 && value !== 11) {
    throw new Error("El AS solo puede valer 1 u 11");
  }

  // REGLA: Si tiene 21 natural (2 cartas iniciales), no puede cambiar el AS
  const isInitialHand = player.hand.length === 2;
  const currentAnalysis = analyzeHand(player.hand, player.aceChoices);

  if (isInitialHand && currentAnalysis.is21) {
    throw new Error(
      "No puedes cambiar el valor del AS cuando tienes 21 natural"
    );
  }

  // Guardar decisión del jugador
  player.aceChoices[aceIndex] = value;

  // Re-analizar la mano con la nueva decisión
  const newAnalysis = analyzeHand(player.hand, player.aceChoices);
  player.handAnalysis = newAnalysis;

  // Si se pasa con la nueva decisión, marcarlo como BUST
  if (newAnalysis.isBust) {
    player.status = "BUST";
    console.log(`💥 ${player.name} se pasó de 21 al cambiar el AS. BUST!`);
    advanceTurn(game);
  }

  const totalMultiplier = calculateTotalMultiplier(newAnalysis);

  return {
    success: true,
    player: {
      id: player.id,
      name: player.name,
      hand: player.hand,
      handTotal: newAnalysis.total,
      status: player.status,
      aceChoices: player.aceChoices,
      analysis: {
        isBust: newAnalysis.isBust,
        is21: newAnalysis.is21,
        is20_5: newAnalysis.is20_5,
        special: newAnalysis.special,
        hasAces: newAnalysis.hasAces,
        aceCount: newAnalysis.aceCount,
        totalMultiplier: totalMultiplier,
      },
    },
    game: {
      id: game.id,
      state: game.state,
      turnIndex: game.turnIndex,
      currentPlayer:
        game.state === "PLAYING" && game.turnIndex < game.playOrder.length
          ? game.players.find((p) => p.id === game.playOrder[game.turnIndex])
              ?.name
          : null,
    },
    message: newAnalysis.isBust
      ? `💥 ${player.name} cambió el AS y se pasó de 21 con ${newAnalysis.total}`
      : `${player.name} cambió el AS a valer ${value}. Nuevo total: ${newAnalysis.total}`,
  };
};

/**
 * La Casa pide una carta
 */
export const houseHit = (gameId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  // Validar que sea turno de la Casa
  if (game.state !== "HOUSE_TURN") {
    throw new Error("No es turno de la Casa");
  }

  const house = game.players.find((p) => p.isHouse);
  if (!house) throw new Error("No hay Casa en esta partida");

  const card = drawCardSafe(game);
  if (card) house.hand.push(card);

  const analysis = analyzeHand(house.hand, house.aceChoices);
  house.handAnalysis = analysis;

  console.log(
    `🏠 Casa pidió carta: ${card.value}${card.suit || ""}. Total: ${
      analysis.total
    }`
  );

  // Si la Casa se pasa, termina automáticamente
  if (analysis.isBust) {
    house.status = "BUST";
    game.state = "FINISHED";
    console.log(
      `💥 Casa se pasó de 21 con ${analysis.total}. ¡Todos los jugadores ganan!`
    );

    // RESOLVER GANADORES AUTOMÁTICAMENTE
    const resolution = resolveWinners(game.id);

    const totalMultiplier = calculateTotalMultiplier(analysis);

    return {
      success: true,
      house: {
        name: house.name,
        hand: house.hand,
        handTotal: analysis.total,
        status: house.status,
        analysis: {
          isBust: analysis.isBust,
          is21: analysis.is21,
          is20_5: analysis.is20_5,
          special: analysis.special,
          totalMultiplier: totalMultiplier,
        },
      },
      card: card,
      game: {
        id: game.id,
        state: game.state,
      },
      resolution: resolution, // Incluir resolución
      message: `💥 Casa se pasó de 21 con ${analysis.total}. ¡Todos ganan!`,
    };
  }

  const totalMultiplier = calculateTotalMultiplier(analysis);

  return {
    success: true,
    house: {
      name: house.name,
      hand: house.hand,
      handTotal: analysis.total,
      status: house.status,
      analysis: {
        isBust: analysis.isBust,
        is21: analysis.is21,
        is20_5: analysis.is20_5,
        special: analysis.special,
        totalMultiplier: totalMultiplier,
      },
    },
    card: card,
    game: {
      id: game.id,
      state: game.state,
    },
    message: analysis.isBust
      ? `💥 Casa se pasó de 21 con ${analysis.total}`
      : `🏠 Casa sacó ${card.value}${card.suit || ""}. Total: ${
          analysis.total
        }`,
  };
};

/**
 * La Casa se planta
 */
export const houseStand = (gameId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  // Validar que sea turno de la Casa
  if (game.state !== "HOUSE_TURN") {
    throw new Error("No es turno de la Casa");
  }

  const house = game.players.find((p) => p.isHouse);
  if (!house) throw new Error("No hay Casa en esta partida");

  const analysis = analyzeHand(house.hand, house.aceChoices);
  house.handAnalysis = analysis;
  house.status = "STAND";

  // Cambiar estado a FINISHED para resolver ganadores
  game.state = "FINISHED";

  console.log(`🏠 Casa se plantó con ${analysis.total}`);

  // RESOLVER GANADORES AUTOMÁTICAMENTE
  const resolution = resolveWinners(game.id);

  const totalMultiplier = calculateTotalMultiplier(analysis);

  return {
    success: true,
    house: {
      name: house.name,
      hand: house.hand,
      handTotal: analysis.total,
      status: house.status,
      analysis: {
        is21: analysis.is21,
        is20_5: analysis.is20_5,
        special: analysis.special,
        totalMultiplier: totalMultiplier,
      },
    },
    game: {
      id: game.id,
      state: game.state,
    },
    resolution: resolution, // Incluir resolución en la respuesta
    message: `🏠 Casa se plantó con ${analysis.total}. Ganadores resueltos.`,
  };
};

/**
 * Marca a un jugador como desconectado y pierde su apuesta
 */
export const disconnectPlayer = (gameId, playerId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Player not found");

  // Marcar como desconectado
  player.status = "DISCONNECTED";
  player.isConnected = false;

  console.log(
    `🔌 ${player.name} se desconectó. Pierde su apuesta de ${player.bet} créditos.`
  );

  // Si es la Casa quien se desconecta, terminar partida inmediatamente
  if (player.isHouse) {
    game.state = "FINISHED";

    // Todos los jugadores recuperan sus apuestas
    game.players.forEach((p) => {
      if (!p.isHouse && p.bet > 0) {
        p.credits += p.bet;
        console.log(
          `💰 ${p.name} recupera su apuesta de ${p.bet} créditos por desconexión de la Casa.`
        );
      }
    });

    return {
      success: true,
      message:
        "La Casa se desconectó. Partida terminada. Todos los jugadores recuperan sus apuestas.",
      player: {
        name: player.name,
        isHouse: true,
      },
      game: {
        id: game.id,
        state: game.state,
      },
      allPlayersRefunded: true,
    };
  }

  // Si es un jugador normal, la apuesta ya se perdió al colocarla
  // Solo verificamos si la partida debe terminar por falta de jugadores

  const activePlayers = game.players.filter(
    (p) => !p.isHouse && p.status !== "DISCONNECTED" && p.status !== "SPECTATOR"
  );

  // Si quedan menos de 2 jugadores activos (sin contar Casa), terminar partida
  if (activePlayers.length < 2) {
    game.state = "FINISHED";

    console.log(`⚠️ Quedan menos de 2 jugadores activos. Partida terminada.`);

    // Devolver apuestas a los jugadores restantes
    activePlayers.forEach((p) => {
      if (p.bet > 0) {
        p.credits += p.bet;
        console.log(`💰 ${p.name} recupera su apuesta de ${p.bet} créditos.`);
      }
    });

    return {
      success: true,
      message: `${player.name} se desconectó. Quedan menos de 2 jugadores. Partida terminada.`,
      player: {
        name: player.name,
        bet: player.bet,
        isHouse: false,
      },
      game: {
        id: game.id,
        state: game.state,
      },
      remainingPlayers: activePlayers.length,
      gameEnded: true,
    };
  }

  // Si la partida sigue, avanzar turno si es necesario
  if (game.state === "PLAYING") {
    const currentPlayerId = game.playOrder[game.turnIndex];
    if (currentPlayerId === playerId) {
      console.log(`➡️ Jugador desconectado estaba en turno. Avanzando...`);
      advanceTurn(game);
    }
  }

  return {
    success: true,
    message: `${player.name} se desconectó y perdió su apuesta de ${player.bet} créditos.`,
    player: {
      name: player.name,
      bet: player.bet,
      isHouse: false,
    },
    game: {
      id: game.id,
      state: game.state,
      remainingPlayers: activePlayers.length,
    },
    gameEnded: false,
  };
};

/**
 * Verifica si hay suficientes jugadores para continuar
 */
const checkMinimumPlayers = (game) => {
  const activePlayers = game.players.filter(
    (p) => !p.isHouse && p.status !== "DISCONNECTED" && p.status !== "SPECTATOR"
  );

  if (activePlayers.length < 2) {
    game.state = "FINISHED";
    console.log(
      `⚠️ Quedan solo ${activePlayers.length} jugador(es). Partida terminada automáticamente.`
    );

    // Devolver apuestas a jugadores restantes
    activePlayers.forEach((p) => {
      if (p.bet > 0 && p.status !== "BUST") {
        p.credits += p.bet;
        console.log(`💰 ${p.name} recupera su apuesta de ${p.bet} créditos.`);
      }
    });

    return false; // No hay suficientes jugadores
  }

  return true; // Hay suficientes jugadores
};
export const resolveWinners = (gameId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  // Solo se puede resolver cuando está FINISHED
  if (game.state !== "FINISHED") {
    throw new Error(
      "Solo se pueden resolver ganadores cuando la partida está FINISHED"
    );
  }

  const house = game.players.find((p) => p.isHouse);
  if (!house) throw new Error("No hay Casa en esta partida");

  const houseAnalysis =
    house.handAnalysis || analyzeHand(house.hand, house.aceChoices);

  const results = [];
  let houseTotalWinnings = 0;

  // Procesar cada jugador (excepto la Casa)
  game.players.forEach((player) => {
    if (player.isHouse) return; // Skip Casa

    const playerAnalysis =
      player.handAnalysis || analyzeHand(player.hand, player.aceChoices);

    let result = {
      playerId: player.id,
      playerName: player.name,
      bet: player.bet,
      playerTotal: playerAnalysis.total,
      houseTotal: houseAnalysis.total,
      playerStatus: player.status,
      houseStatus: house.status,
      outcome: null, // WIN, LOSE, TIE
      multiplier: 1,
      winnings: 0,
      creditsChange: 0,
      previousCredits: player.credits,
      newCredits: player.credits,
    };

    // Si el jugador se pasó, pierde automáticamente
    if (player.status === "BUST") {
      result.outcome = "LOSE";
      result.creditsChange = 0; // Ya perdió la apuesta al colocarla
      result.newCredits = player.credits;
      houseTotalWinnings += player.bet;
      results.push(result);
      return;
    }

    // Si la Casa se pasó, todos los que no se pasaron ganan
    if (house.status === "BUST") {
      result.outcome = "WIN";
      result.multiplier = calculateTotalMultiplier(playerAnalysis);
      result.winnings = player.bet * result.multiplier;
      result.creditsChange = result.winnings;
      result.newCredits = player.credits + result.winnings;
      player.credits = result.newCredits;
      houseTotalWinnings -= result.winnings;
      results.push(result);
      return;
    }

    // Reglas especiales de manos
    // Doble As (x5) o Doble 2 (x4) siempre ganan (excepto vs otra mano especial igual o mejor)
    if (playerAnalysis.isDoubleA) {
      if (houseAnalysis.isDoubleA) {
        // Empate entre Doble As
        result.outcome = "TIE";
        result.creditsChange = player.bet; // Recupera su apuesta
        result.newCredits = player.credits + player.bet;
        player.credits = result.newCredits;
      } else {
        // Jugador gana con Doble As
        result.outcome = "WIN";
        result.multiplier = 5;
        result.winnings = player.bet * result.multiplier;
        result.creditsChange = result.winnings;
        result.newCredits = player.credits + result.winnings;
        player.credits = result.newCredits;
        houseTotalWinnings -= result.winnings;
      }
      results.push(result);
      return;
    }

    if (playerAnalysis.isDouble2) {
      if (houseAnalysis.isDoubleA) {
        // Casa con Doble As gana vs Doble 2
        result.outcome = "LOSE";
        result.creditsChange = 0;
        result.newCredits = player.credits;
        houseTotalWinnings += player.bet;
      } else if (houseAnalysis.isDouble2) {
        // Empate
        result.outcome = "TIE";
        result.creditsChange = player.bet;
        result.newCredits = player.credits + player.bet;
        player.credits = result.newCredits;
      } else {
        // Jugador gana con Doble 2
        result.outcome = "WIN";
        result.multiplier = 4;
        result.winnings = player.bet * result.multiplier;
        result.creditsChange = result.winnings;
        result.newCredits = player.credits + result.winnings;
        player.credits = result.newCredits;
        houseTotalWinnings -= result.winnings;
      }
      results.push(result);
      return;
    }

    // Si Casa tiene Doble As o Doble 2, solo pierde vs igual o mejor
    if (houseAnalysis.isDoubleA) {
      result.outcome = "LOSE";
      result.creditsChange = 0;
      result.newCredits = player.credits;
      houseTotalWinnings += player.bet;
      results.push(result);
      return;
    }

    if (houseAnalysis.isDouble2) {
      result.outcome = "LOSE";
      result.creditsChange = 0;
      result.newCredits = player.credits;
      houseTotalWinnings += player.bet;
      results.push(result);
      return;
    }

    // 20.5 gana contra cualquier 20 o menos
    if (playerAnalysis.is20_5) {
      if (houseAnalysis.is20_5) {
        // Empate
        result.outcome = "TIE";
        result.creditsChange = player.bet;
        result.newCredits = player.credits + player.bet;
        player.credits = result.newCredits;
      } else if (houseAnalysis.total <= 20) {
        // Jugador gana
        result.outcome = "WIN";
        result.multiplier = calculateTotalMultiplier(playerAnalysis);
        result.winnings = player.bet * result.multiplier;
        result.creditsChange = result.winnings;
        result.newCredits = player.credits + result.winnings;
        player.credits = result.newCredits;
        houseTotalWinnings -= result.winnings;
      } else {
        // Casa tiene 21
        result.outcome = "LOSE";
        result.creditsChange = 0;
        result.newCredits = player.credits;
        houseTotalWinnings += player.bet;
      }
      results.push(result);
      return;
    }

    if (houseAnalysis.is20_5 && playerAnalysis.total <= 20) {
      result.outcome = "LOSE";
      result.creditsChange = 0;
      result.newCredits = player.credits;
      houseTotalWinnings += player.bet;
      results.push(result);
      return;
    }

    // Comparación normal de puntajes
    if (playerAnalysis.total > houseAnalysis.total) {
      // Jugador gana
      result.outcome = "WIN";
      result.multiplier = calculateTotalMultiplier(playerAnalysis);
      result.winnings = player.bet * result.multiplier;
      result.creditsChange = result.winnings;
      result.newCredits = player.credits + result.winnings;
      player.credits = result.newCredits;
      houseTotalWinnings -= result.winnings;
    } else if (playerAnalysis.total < houseAnalysis.total) {
      // Casa gana
      result.outcome = "LOSE";
      result.creditsChange = 0;
      result.newCredits = player.credits;
      houseTotalWinnings += player.bet;
    } else {
      // Empate - Devolver apuesta
      result.outcome = "TIE";
      result.creditsChange = player.bet;
      result.newCredits = player.credits + player.bet;
      player.credits = result.newCredits;
    }

    results.push(result);
  });

  // Actualizar créditos de la Casa
  const housePreviousCredits = house.credits;
  house.credits += houseTotalWinnings;

  console.log(
    `💰 Resolución completada. Casa ${
      houseTotalWinnings >= 0 ? "ganó" : "perdió"
    } ${Math.abs(houseTotalWinnings)} créditos`
  );

  // Eliminar jugadores sin créditos
  const eliminatedPlayers = [];
  game.players.forEach((player) => {
    if (!player.isHouse && player.credits <= 0) {
      player.status = "SPECTATOR";
      eliminatedPlayers.push({
        id: player.id,
        name: player.name,
      });
      console.log(`⛔ ${player.name} eliminado (sin créditos)`);
    }
  });

  return {
    success: true,
    gameId: game.id,
    house: {
      name: house.name,
      hand: house.hand,
      total: houseAnalysis.total,
      status: house.status,
      special: houseAnalysis.special,
      previousCredits: housePreviousCredits,
      newCredits: house.credits,
      totalWinnings: houseTotalWinnings,
    },
    results: results,
    summary: {
      totalPlayers: results.length,
      winners: results.filter((r) => r.outcome === "WIN").length,
      losers: results.filter((r) => r.outcome === "LOSE").length,
      ties: results.filter((r) => r.outcome === "TIE").length,
      houseNetWinnings: houseTotalWinnings,
    },
    eliminatedPlayers: eliminatedPlayers,
    message:
      eliminatedPlayers.length > 0
        ? `Partida resuelta. ${eliminatedPlayers.length} jugador(es) eliminado(s)`
        : "Partida resuelta exitosamente",
  };
};
export const houseChooseAce = (gameId, aceIndex, value) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  if (game.state !== "HOUSE_TURN") {
    throw new Error("No es turno de la Casa");
  }

  const house = game.players.find((p) => p.isHouse);
  if (!house) throw new Error("No hay Casa en esta partida");

  // Validar que el índice sea válido
  if (aceIndex < 0 || aceIndex >= house.hand.length) {
    throw new Error("Índice de carta inválido");
  }

  // Validar que la carta sea un AS
  if (house.hand[aceIndex].value !== "A") {
    throw new Error("La carta seleccionada no es un AS");
  }

  // Validar que el valor sea 1 u 11
  if (value !== 1 && value !== 11) {
    throw new Error("El AS solo puede valer 1 u 11");
  }

  // Guardar decisión
  house.aceChoices[aceIndex] = value;

  // Re-analizar la mano
  const newAnalysis = analyzeHand(house.hand, house.aceChoices);
  house.handAnalysis = newAnalysis;

  // Si se pasa, terminar
  if (newAnalysis.isBust) {
    house.status = "BUST";
    game.state = "FINISHED";
    console.log(`💥 Casa se pasó de 21 al cambiar el AS. BUST!`);
  }

  return {
    success: true,
    house: {
      name: house.name,
      hand: house.hand,
      handTotal: newAnalysis.total,
      status: house.status,
      aceChoices: house.aceChoices,
    },
    game: {
      state: game.state,
    },
    message: newAnalysis.isBust
      ? `💥 Casa cambió el AS y se pasó de 21 con ${newAnalysis.total}`
      : `🏠 Casa cambió el AS a valer ${value}. Nuevo total: ${newAnalysis.total}`,
  };
};
export const restartGame = (gameId) => {
  const game = games.get(gameId);
  if (!game) throw new Error("Game not found");

  if (game.state !== "FINISHED") {
    throw new Error("Solo puedes reiniciar una partida terminada");
  }

  // Si quedan pocas cartas, crear nuevo deck completo
  if (game.deck.length + game.discardPile.length < 30) {
    console.log("🔄 Pocas cartas disponibles. Creando nuevo deck completo...");
    game.deck = createDeck();
    game.discardPile = [];
    game.deckReshuffles = 0;
  } else {
    // Si hay suficientes, revolver las descartadas
    if (game.discardPile.length > 0) {
      reshuffleDiscardedCards(game);
    }
  }

  // RESETEAR APUESTAS - Todos vuelven a 0 para la nueva ronda
  game.players.forEach((p) => {
    p.bet = 0;
  });

  console.log("💰 Apuestas reseteadas. Los jugadores deben apostar de nuevo.");

  game.state = "WAITING";
  return startGame(gameId);
};

export default {
  createGame,
  getGameById,
  listGames,
  startGame,
  hit,
  stand,
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
};
