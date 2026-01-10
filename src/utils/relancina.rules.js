import { evaluateHand } from "./hand.js";

export const analyzeHand = (hand) => {
  const isInitialHand = hand.length === 2;
  const values = hand.map((c) => c.value);

  const { total } = evaluateHand(hand);

  const result = {
    total,
    isBust: total > 21,
    is21: total === 21,
    is20_5: false,
    bonusMultiplier: 1,
    special: null,
  };

  if (!isInitialHand) return result;

  // Doble 2
  if (values[0] === "2" && values[1] === "2") {
    result.special = "DOUBLE_2";
    result.bonusMultiplier = 4;
    return result;
  }

  // Doble As
  if (values[0] === "A" && values[1] === "A") {
    result.special = "DOUBLE_A";
    result.bonusMultiplier = 5;
    return result;
  }

  // 20.5 → suma 14 exacta
  if (total === 14) {
    result.is20_5 = true;
    result.special = "TWENTY_POINT_FIVE";
    result.total = 20.5;
  }

  return result;
};
