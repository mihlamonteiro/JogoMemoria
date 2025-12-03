# Jogo da Memória Multiplayer com Temas – React + Vite + Socket.IO

- Backend em Node.js/Express/Socket.IO controla:
  - Jogadores
  - Tema do baralho (animais, frutas, formas, emojis)
  - Embaralhamento e pares
  - Turno
  - Pontuação e histórico

- Frontend em React + Vite:
  - Tela inicial com:
    - Campo de nome
    - Seleção de tema
  - Tela de jogo com:
    - Placar em tabela
    - Tabuleiro de cartas
    - Lista de histórico de jogadas
    - Destaque do jogador da vez

## Como rodar

### Backend

```bash
cd backend
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Depois acesse http://localhost:5173 em dois navegadores/abas diferentes para testar o multiplayer.
