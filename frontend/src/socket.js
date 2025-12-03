import { io } from 'socket.io-client';

// Em dev: cai no localhost
// Em produção (Render): usa VITE_BACKEND_URL
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export const socket = io(backendUrl);
