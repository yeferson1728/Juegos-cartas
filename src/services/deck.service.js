const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

export const createDeck = () => {
  const deck = [];

  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ value, suit, type: "NORMAL" });
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ value: "JOKER", suit: null, type: "JOKER" });
  }

  return shuffle(deck);
};

export const drawCard = (game) => {
  if (!game.deck.length) {
    throw new Error("No hay más cartas");
  }

  return {
    ...game.deck.pop(),
    faceUp: true,
  };
};

const shuffle = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};
