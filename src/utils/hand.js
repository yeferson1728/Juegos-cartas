export const evaluateHand = (hand) => {
  let total = 0;
  let aces = 0;
  let jokers = 0;

  for (const card of hand) {
    if (card.type === "JOKER") {
      jokers++;
      total -= 5;
      continue;
    }

    if (card.value === "A") {
      aces++;
      total += 11;
      continue;
    }

    if (["K", "Q", "J"].includes(card.value)) {
      total += 10;
      continue;
    }

    total += Number(card.value);
  }

  // Ajustar Ases si se pasa
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return {
    total,
    aces,
    jokers,
  };
};
