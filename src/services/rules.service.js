/**
 * Evalúa el valor total de una mano
 * @param {Array} hand - Array de cartas
 * @param {Object} aceChoices - Objeto con decisiones del jugador {cardIndex: value}
 * @returns {number} - Total de la mano
 */
export const evaluateHand = (hand, aceChoices = {}) => {
  let total = 0;
  let aces = 0;
  let aceIndices = [];

  for (let i = 0; i < hand.length; i++) {
    const card = hand[i];

    if (card.type === "JOKER") {
      total -= 5;
      continue;
    }

    if (card.value === "A") {
      aceIndices.push(i);

      // Si el jugador ya decidió el valor de este AS
      if (aceChoices[i] !== undefined) {
        total += aceChoices[i];
      } else {
        // Por defecto, contar como 11
        aces++;
        total += 11;
      }
      continue;
    }

    if (["K", "Q", "J"].includes(card.value)) {
      total += 10;
      continue;
    }

    total += Number(card.value);
  }

  // Ajustar Ases automáticamente solo si no hay decisión del jugador
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
};

/**
 * Analiza una mano completa incluyendo reglas especiales de Relancina
 * @param {Array} hand - Array de cartas
 * @param {Object} aceChoices - Decisiones del jugador sobre valores de Ases
 * @returns {Object} - Análisis completo de la mano
 */
export const analyzeHand = (hand, aceChoices = {}) => {
  const isInitialHand = hand.length === 2;
  const values = hand.map((c) => c.value);
  const total = evaluateHand(hand, aceChoices);

  // Detectar cuántos Ases hay en la mano
  const aces = hand.filter((c) => c.value === "A");
  const hasAces = aces.length > 0;

  const result = {
    total,
    isBust: total > 21,
    is21: total === 21,
    is20_5: false,
    isDouble2: false,
    isDoubleA: false,
    canChangeHand: false,
    bonusMultiplier: 1,
    special: null,
    cardCountMultiplier: hand.length >= 5 ? hand.length : 1,
    hasAces: hasAces,
    aceCount: aces.length,
    aceIndices: hand
      .map((c, i) => (c.value === "A" ? i : -1))
      .filter((i) => i >= 0),
  };

  // Solo verificar reglas especiales si es la mano inicial (2 cartas)
  if (!isInitialHand) {
    return result;
  }

  // 🔥 DOBLE 2 - Gana x4
  if (values[0] === "2" && values[1] === "2") {
    result.isDouble2 = true;
    result.special = "DOUBLE_2";
    result.bonusMultiplier = 4;
    result.canChangeHand = false;
    return result;
  }

  // 🔥 DOBLE AS - Gana x5
  if (values[0] === "A" && values[1] === "A") {
    result.isDoubleA = true;
    result.special = "DOUBLE_A";
    result.bonusMultiplier = 5;
    result.canChangeHand = false;
    // Para Doble AS, ambos valen 11 automáticamente (suma 22, pero es especial)
    return result;
  }

  // 🔥 20.5 - Suma exacta de 14
  if (total === 14) {
    result.is20_5 = true;
    result.special = "TWENTY_POINT_FIVE";
    result.total = 20.5;
    result.bonusMultiplier = 2;
    return result;
  }

  // 🔁 CAMBIO DE MANO - Suma de 12
  if (total === 12) {
    result.canChangeHand = true;
    result.special = "CAN_CHANGE";
    return result;
  }

  return result;
};

/**
 * Calcula el multiplicador final considerando:
 * - Bonus especial (Doble 2, Doble As, 20.5)
 * - Multiplicador por número de cartas (a partir de 5)
 * @param {Object} analysis - Resultado de analyzeHand
 * @returns {number} - Multiplicador total
 */
export const calculateTotalMultiplier = (analysis) => {
  let multiplier = 1;

  // Multiplicador de bonus especial
  if (analysis.bonusMultiplier > 1) {
    multiplier *= analysis.bonusMultiplier;
  }

  // Multiplicador por cantidad de cartas (5 cartas = x5, 6 = x6, etc.)
  if (analysis.cardCountMultiplier > 1) {
    multiplier *= analysis.cardCountMultiplier;
  }

  return multiplier;
};

/**
 * Verifica si un jugador puede pedir más cartas
 * @param {Object} player - Jugador
 * @param {Object} analysis - Análisis de la mano
 * @returns {boolean}
 */
export const canHit = (player, analysis) => {
  // No puede pedir si ya se pasó
  if (analysis.isBust) return false;

  // No puede pedir si está plantado
  if (player.status === "STAND") return false;

  // No puede pedir si tiene Doble 2 o Doble As
  if (analysis.isDouble2 || analysis.isDoubleA) return false;

  return true;
};

/**
 * Compara dos manos según las reglas de Relancina
 * @param {Object} player1Analysis - Análisis del jugador 1
 * @param {Object} player2Analysis - Análisis del jugador 2
 * @returns {number} - 1 si gana player1, -1 si gana player2, 0 si empate
 */
export const compareHands = (player1Analysis, player2Analysis) => {
  // Si alguno se pasó, pierde automáticamente
  if (player1Analysis.isBust) return -1;
  if (player2Analysis.isBust) return 1;

  // Doble As gana contra todo (excepto otro Doble As)
  if (player1Analysis.isDoubleA && !player2Analysis.isDoubleA) return 1;
  if (player2Analysis.isDoubleA && !player1Analysis.isDoubleA) return -1;

  // Doble 2 gana contra todo (excepto Doble As o Doble 2)
  if (
    player1Analysis.isDouble2 &&
    !player2Analysis.isDouble2 &&
    !player2Analysis.isDoubleA
  )
    return 1;
  if (
    player2Analysis.isDouble2 &&
    !player1Analysis.isDouble2 &&
    !player1Analysis.isDoubleA
  )
    return -1;

  // 20.5 gana contra 20 o menos
  if (player1Analysis.is20_5 && player2Analysis.total <= 20) return 1;
  if (player2Analysis.is20_5 && player1Analysis.total <= 20) return -1;

  // Comparación normal por puntaje
  if (player1Analysis.total > player2Analysis.total) return 1;
  if (player2Analysis.total > player1Analysis.total) return -1;

  // Empate
  return 0;
};
