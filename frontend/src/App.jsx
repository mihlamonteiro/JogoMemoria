import { useEffect, useState } from 'react';
import { socket } from './socket';

const THEMES = [
  { key: 'animals', label: 'Animais' },
  { key: 'fruits', label: 'Frutas' },
  { key: 'shapes', label: 'Formas Geométricas' },
  { key: 'emojis', label: 'Emojis Diversos' },
];

function HomeScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [themeKey, setThemeKey] = useState('animals');
  const [error, setError] = useState('');

  function handleJoin() {
    if (!name.trim()) {
      setError('Informe um nome');
      setTimeout(() => setError(''), 2000);
      return;
    }
    onJoin(name.trim(), themeKey);
  }

  return (
    <div className="home">
      <div className="home-card">
        <h1>Jogo da Memória Multiplayer</h1>
        <p className="subtitle">
          Escolha um tema para o baralho e entre na partida.
        </p>

        <label htmlFor="name">Seu nome:</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Digite seu nome"
        />

        <label htmlFor="theme">Tema do baralho:</label>
        <select
          id="theme"
          value={themeKey}
          onChange={(e) => setThemeKey(e.target.value)}
        >
          {THEMES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>

        <button onClick={handleJoin}>Entrar / Criar partida</button>
        {error && <p className="error">{error}</p>}
        <p className="hint">
          O primeiro jogador escolhe o tema. Os próximos entram na mesma partida e
          jogam com o mesmo baralho.
        </p>
      </div>
    </div>
  );
}

function GameScreen({ myId }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const [changingTheme, setChangingTheme] = useState(false);
  const [newTheme, setNewTheme] = useState('animals');

  useEffect(() => {
    function handleState(newState) {
      try {
        setGame(JSON.parse(JSON.stringify(newState)));
      } catch {
        setGame(newState);
      }
    }

    function handleErrorMessage(msg) {
      setError(msg);
      setTimeout(() => setError(''), 2500);
    }

    socket.on('state', handleState);
    socket.on('errorMessage', handleErrorMessage);

    return () => {
      socket.off('state', handleState);
      socket.off('errorMessage', handleErrorMessage);
    };
  }, []);

  function handleFlip(index) {
    socket.emit('flipCard', index);
  }

  function handleResetGame() {
    socket.emit('resetGame');
  }

  function handleChangeTheme() {
    socket.emit('changeTheme', newTheme);
    setChangingTheme(false);
  }

  if (!game) {
    return (
      <div className="container">
        <h1>Carregando jogo...</h1>
      </div>
    );
  }

  const isMyTurn =
    game.players &&
    game.players.length > 0 &&
    game.players[game.turn] &&
    game.players[game.turn].id === myId;

  return (
    <div className="container">
      <h1>Jogo da Memória Multiplayer</h1>

      <section className="layout">
        <div className="card">
          <h2>Placar</h2>
          <p className="theme-badge">
            Tema atual: <strong>{game.themeLabel}</strong>
          </p>
          {game.players.length === 0 && <p>Nenhum jogador conectado.</p>}
          <table className="score-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Pares</th>
                <th>Vez</th>
              </tr>
            </thead>
            <tbody>
              {game.players.map((p, index) => (
                <tr
                  key={p.id}
                  className={index === game.turn ? 'current-player' : ''}
                >
                  <td>{p.name}</td>
                  <td>{p.score}</td>
                  <td>{index === game.turn ? '▶' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="turn-indicator">
            {isMyTurn ? 'É a SUA vez.' : 'Aguardando jogada de outro jogador...'}
          </p>
          <button onClick={handleResetGame}>Reiniciar partida (jogador da vez)</button>

          <div className="theme-change">
            <button onClick={() => setChangingTheme((v) => !v)}>
              {changingTheme ? 'Cancelar troca de tema' : 'Trocar tema (jogador da vez)'}
            </button>
            {changingTheme && (
              <div className="theme-form">
                <select
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                >
                  {THEMES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button onClick={handleChangeTheme}>Aplicar novo tema</button>
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </div>

        <div className="card">
          <h2>Tabuleiro ({game.themeLabel})</h2>
          <p className="instructions">
            Clique em duas cartas no seu turno. Se formar um par, você ganha 1 ponto
            e joga novamente. Se errar, as cartas desviram e a vez passa para o próximo
            jogador.
          </p>
          <div className="board">
            {game.cards.map((card, index) => {
              const isFaceUp = card.isRevealed || card.isMatched;
              const isBlocked =
                !isFaceUp &&
                (!isMyTurn || game.revealedIndices.length >= 2 || game.isFinished);

              return (
                <button
                  key={card.id}
                  className={
                    'card-btn ' +
                    (isFaceUp ? 'card-faceup ' : 'card-facedown ') +
                    (card.isMatched ? 'card-matched ' : '')
                  }
                  onClick={() => handleFlip(index)}
                  disabled={isBlocked}
                >
                  <span className="card-inner">
                    {isFaceUp ? card.value : '❓'}
                  </span>
                </button>
              );
            })}
          </div>
          {game.isFinished && (
            <p className="finished">
              Fim de jogo! Todos os pares foram encontrados.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Histórico de jogadas</h2>
          {(!game.moveHistory || game.moveHistory.length === 0) && (
            <p>Nenhuma jogada registrada ainda.</p>
          )}
          <ul className="moves-list">
            {game.moveHistory &&
              game.moveHistory
                .slice()
                .reverse()
                .map((m, idx) => (
                  <li
                    key={idx}
                    className={m.success ? 'move-success' : 'move-fail'}
                  >
                    <strong>{m.playerName}</strong>: {m.description}{' '}
                    {m.success ? '✅' : '❌'}
                  </li>
                ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function App() {
  const [joined, setJoined] = useState(false);
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    function handleConnect() {
      setMyId(socket.id);
    }
    handleConnect();
    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, []);

  function handleJoin(name, themeKey) {
    socket.emit('joinGame', { name, themeKey });
    setJoined(true);
  }

  if (!joined) {
    return <HomeScreen onJoin={handleJoin} />;
  }

  return <GameScreen myId={myId} />;
}

export default App;
