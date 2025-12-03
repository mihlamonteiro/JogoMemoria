const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// --------- TEMAS DO JOGO ---------

const THEMES = {
  animals: {
    key: 'animals',
    label: 'Animais',
    values: ['🐶', '🐱', '🐭', '🦊', '🐻', '🐼', '🐸', '🐵']
  },
  fruits: {
    key: 'fruits',
    label: 'Frutas',
    values: ['🍎', '🍌', '🍇', '🍉', '🍓', '🍑', '🍒', '🍍']
  },
  shapes: {
    key: 'shapes',
    label: 'Formas Geométricas',
    values: ['🔺', '🔻', '🔵', '🟢', '🟥', '🟨', '⬛', '⬜']
  },
  emojis: {
    key: 'emojis',
    label: 'Emojis Diversos',
    values: ['⭐', '🔥', '💧', '⚡', '🌙', '🌈', '❄️', '☀️']
  }
};

function getTheme(themeKey) {
  if (themeKey && THEMES[themeKey]) return THEMES[themeKey];
  return THEMES.animals;
}

function createShuffledDeck(themeKey) {
  const theme = getTheme(themeKey);
  const base = theme.values;
  const values = [...base, ...base]; // pares
  // Fisher–Yates
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values.map((value, index) => ({
    id: index,
    value,
    isRevealed: false,
    isMatched: false,
  }));
}

const state = {
  players: [], // { id, name, score }
  turn: 0,
  cards: [],
  revealedIndices: [],
  moveHistory: [],
  isFinished: false,
  themeKey: 'animals',
};

function resetGame(newThemeKey) {
  const theme = getTheme(newThemeKey || state.themeKey);
  state.themeKey = theme.key;
  state.cards = createShuffledDeck(theme.key);
  state.revealedIndices = [];
  state.moveHistory = [];
  state.isFinished = false;
  state.players.forEach(p => { p.score = 0; });
  state.turn = state.players.length > 0 ? 0 : 0;
}

function getThemeLabel() {
  return getTheme(state.themeKey).label;
}

function allMatched() {
  return state.cards.length > 0 && state.cards.every(c => c.isMatched);
}

function publicState() {
  return {
    players: state.players,
    turn: state.turn,
    cards: state.cards,
    revealedIndices: state.revealedIndices,
    moveHistory: state.moveHistory.slice(-20),
    isFinished: state.isFinished,
    themeKey: state.themeKey,
    themeLabel: getThemeLabel(),
  };
}

function broadcastState() {
  io.emit('state', publicState());
}

// Inicializa um baralho padrão
resetGame('animals');

// --------- SOCKET.IO ---------

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.on('joinGame', ({ name, themeKey }) => {
    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;

    let existing = state.players.find(p => p.id === socket.id);
    if (!existing) {
      state.players.push({ id: socket.id, name: trimmed, score: 0 });
      console.log('Jogador entrou:', trimmed);
    }

    if (state.players.length === 1) {
      // Primeiro jogador define o tema e reseta o jogo
      resetGame(themeKey);
    }

    broadcastState();
  });

  socket.on('flipCard', (index) => {
    if (state.isFinished) return;
    if (typeof index !== 'number') return;
    if (index < 0 || index >= state.cards.length) return;
    if (state.revealedIndices.length >= 2) return;

    const current = state.players[state.turn];
    if (!current || current.id !== socket.id) {
      socket.emit('errorMessage', 'Não é sua vez!');
      return;
    }

    const card = state.cards[index];
    if (card.isMatched || card.isRevealed) {
      return;
    }

    card.isRevealed = true;
    state.revealedIndices.push(index);
    broadcastState();

    if (state.revealedIndices.length === 2) {
      const [i1, i2] = state.revealedIndices;
      const c1 = state.cards[i1];
      const c2 = state.cards[i2];
      const isMatch = c1.value === c2.value;

      state.moveHistory.push({
        playerName: current.name,
        description: `Virou cartas ${i1 + 1} e ${i2 + 1} (${c1.value} / ${c2.value})`,
        success: isMatch,
        timestamp: new Date().toISOString(),
      });

      if (isMatch) {
        c1.isMatched = true;
        c2.isMatched = true;
        current.score += 1;
        state.revealedIndices = [];

        if (allMatched()) {
          state.isFinished = true;
        }

        broadcastState();
      } else {
        setTimeout(() => {
          const [j1, j2] = state.revealedIndices;
          if (
            typeof j1 === 'number' &&
            typeof j2 === 'number' &&
            !state.cards[j1].isMatched &&
            !state.cards[j2].isMatched
          ) {
            state.cards[j1].isRevealed = false;
            state.cards[j2].isRevealed = false;
          }
          state.revealedIndices = [];
          if (state.players.length > 0) {
            state.turn = (state.turn + 1) % state.players.length;
          }
          broadcastState();
        }, 900);
      }
    }
  });

  socket.on('resetGame', () => {
    const current = state.players[state.turn];
    if (!current || current.id !== socket.id) {
      socket.emit('errorMessage', 'Somente o jogador da vez pode reiniciar a partida.');
      return;
    }
    resetGame();
    broadcastState();
  });

  socket.on('changeTheme', (newThemeKey) => {
    const current = state.players[state.turn];
    if (!current || current.id !== socket.id) {
      socket.emit('errorMessage', 'Somente o jogador da vez pode alterar o tema.');
      return;
    }
    if (!THEMES[newThemeKey]) {
      socket.emit('errorMessage', 'Tema inválido.');
      return;
    }
    resetGame(newThemeKey);
    broadcastState();
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    const idx = state.players.findIndex(p => p.id === socket.id);
    if (idx !== -1) {
      state.players.splice(idx, 1);
      if (state.players.length === 0) {
        resetGame('animals');
      } else {
        state.turn = state.turn % state.players.length;
      }
      broadcastState();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Backend (jogo da memória com temas) ouvindo na porta', PORT);
});
