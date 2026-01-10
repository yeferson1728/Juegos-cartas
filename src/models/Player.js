export class Player {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
    this.credits = 10000;
    this.hand = [];
    this.bet = 0;
    this.isHouse = false;
    this.status = "ACTIVE"; // ACTIVE | STAND | BUST | SPECTATOR
  }
}
