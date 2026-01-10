export class Game {
  constructor({ id, players, houseId }) {
    this.id = id;
    this.players = players;
    this.houseId = houseId;
    this.state = "WAITING"; // WAITING | PLAYING | FINISHED
    this.deck = [];
    this.turnIndex = 0;
    this.createdAt = new Date();
  }
}

export class Player {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
    this.credits = 10000;
    this.hand = [];
    this.bet = 0;
    this.isHouse = false;
    this.status = "ACTIVE"; // ACTIVE | LOST | SPECTATOR
  }
}
