# 🃏 RELANCINA - Backend API

> Backend completo para el juego de cartas Relancina - Inspirado en el 21 con reglas especiales y multiplicadores.

---

## 🚀 Instalación Rápida

```bash
npm install
npm start
# Servidor en http://localhost:3000
```

---

## 🎮 ¿Qué es Relancina?

Juego de cartas para **3-5 jugadores** que compiten contra **la Casa**. Objetivo: llegar a **21 puntos** sin pasarse.

### Características

- 🃏 56 cartas (52 normales + 4 Jokers)
- 💰 Apuestas: 200 - 5,000 créditos
- ⭐ Manos especiales con multiplicadores
- 🏠 La Casa juega al final

---

## 📜 Reglas Básicas

### Valores de Cartas

| Carta   | Valor                     |
| ------- | ------------------------- |
| A       | 1 o 11 (elige el jugador) |
| 2-10    | Valor numérico            |
| J, Q, K | 10                        |
| Joker   | -5                        |

### Manos Especiales (solo 2 primeras cartas)

- **Doble 2:** x4 multiplicador
- **Doble As:** x5 multiplicador
- **20.5:** Suma de 14 = 20.5 (x2)
- **Suma 12:** Puede cambiar mano completa

### Multiplicadores

- Por mano especial: x2, x4, x5
- Por cantidad cartas: 5 cartas = x5, 6 = x6, etc.
- **Total = Especial × Cartas**

### La Casa

- Juega después de todos
- Sin mínimo de 17 (se planta cuando quiera)
- 21 Casa solo pierde vs Doble 2 o Doble As
- Si alguien saca 21 inicial → Nueva Casa

### Desconexión

- Jugador desconectado → Pierde apuesta
- Casa desconectada → Todos recuperan apuestas
- < 2 jugadores → Partida termina

---

## 📡 API Endpoints

**Base URL:** `http://localhost:3000/api/game`

### Gestión

```bash
POST   /create              # Crear partida (3-5 jugadores)
GET    /{id}                # Ver partida
GET    /{id}/turn           # Ver turno actual
POST   /{id}/start          # Iniciar
POST   /{id}/restart        # Nueva ronda
```

### Apuestas

```bash
POST   /{id}/bet            # Apostar (200-5,000)
GET    /{id}/bets           # Ver apuestas
```

### Jugadores

```bash
POST   /{id}/hit            # Pedir carta
POST   /{id}/stand          # Plantarse
POST   /{id}/choose-ace     # Cambiar AS (1 u 11)
POST   /{id}/change-hand    # Cambiar mano (suma 12)
POST   /{id}/disconnect     # Desconectar
```

### Casa

```bash
POST   /{id}/house/hit      # Casa pide carta
POST   /{id}/house/stand    # Casa se planta
```

---

## 🎯 Flujo de Juego

```
1. POST /create → Crear partida
2. POST /bet (todos) → Apostar 200-5,000
3. POST /start → Iniciar (reparte cartas)
4. Loop: POST /hit o /stand → Jugadores juegan
5. Estado HOUSE_TURN → Casa juega
6. POST /house/stand → Resuelve ganadores
7. POST /restart → Nueva ronda
```

---

## 💡 Ejemplo de Uso

```javascript
// 1. Crear
const res = await fetch("/api/game/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    players: [{ name: "Casa" }, { name: "Alice" }, { name: "Bob" }],
  }),
});
const { game } = await res.json();

// 2. Apostar
await fetch(`/api/game/${game.id}/bet`, {
  method: "POST",
  body: JSON.stringify({ playerId: aliceId, amount: 500 }),
});

// 3. Iniciar
await fetch(`/api/game/${game.id}/start`, { method: "POST" });

// 4. Jugar
await fetch(`/api/game/${game.id}/hit`, {
  method: "POST",
  body: JSON.stringify({ playerId: aliceId }),
});
```

---

## 📊 Estados del Juego

| Estado     | Descripción        | Acciones                     |
| ---------- | ------------------ | ---------------------------- |
| WAITING    | Esperando apuestas | `/bet`                       |
| PLAYING    | Turnos jugadores   | `/hit`, `/stand`             |
| HOUSE_TURN | Turno Casa         | `/house/hit`, `/house/stand` |
| FINISHED   | Terminada          | `/restart`                   |

---

## 📁 Estructura

```
src/
├── controllers/    # Endpoints
├── services/       # Lógica del juego
├── routes/         # Rutas API
├── models/         # Modelos de datos
└── server.js       # Entrada
```

---

## ✅ Features Completas

- ✅ 3-5 jugadores con Casa
- ✅ Apuestas (200-5,000)
- ✅ Manos especiales (Doble 2, As, 20.5)
- ✅ Multiplicadores por cartas
- ✅ AS ajustable (1 u 11)
- ✅ Cambio de mano (suma 12)
- ✅ Casa sin mínimo
- ✅ Resolución automática
- ✅ Sistema desconexión
- ✅ Reciclaje de cartas

---

## 🎉 ¡Listo para Usar!

Backend 100% funcional. Conecta tu frontend y a jugar. 🃏💰

---

**Documentación completa:** Ver código fuente para detalles de cada endpoint.
