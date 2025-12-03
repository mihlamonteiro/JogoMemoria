import { io } from 'socket.io-client';

// Ajuste a URL se o backend estiver em outro host
export const socket = io('http://localhost:3000');
