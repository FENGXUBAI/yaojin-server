import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { GameState, initGame, playTurn, Action } from './engine/game';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

interface Room {
  id: string;
  players: { id: string; name: string; ready: boolean }[];
  gameState: GameState | null;
  lastRoundResult?: { finishedOrder: number[]; revolution: boolean };
}

const rooms = new Map<string, Room>();

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', ({ room, name }: { room: string; name: string }) => {
    socket.join(room);
    let r = rooms.get(room);
    if (!r) {
      r = { id: room, players: [], gameState: null };
      rooms.set(room, r);
    }
    
    // Check if player already in (reconnect?) - simple version: just add
    const existing = r.players.find(p => p.name === name); // simple auth by name
    if (!existing) {
      if (r.players.length >= 4) {
        socket.emit('error', 'Room full');
        return;
      }
      r.players.push({ id: socket.id, name, ready: false });
    } else {
      // update socket id
      existing.id = socket.id;
    }

    io.to(room).emit('roomUpdate', {
      players: r.players,
      gameState: r.gameState
    });
  });

  socket.on('start', ({ room }: { room: string }) => {
    const r = rooms.get(room);
    if (!r) return;
    // if (r.players.length < 3) return; // Allow testing with fewer? No, game logic needs 3/4
    
    try {
      const state = initGame({ 
        playerCount: r.players.length,
        lastRoundResult: r.lastRoundResult
      });
      r.gameState = state;
      io.to(room).emit('gameStart', state);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('action', ({ room, action }: { room: string; action: Action }) => {
    const r = rooms.get(room);
    if (!r || !r.gameState) return;

    try {
      // Map socket to player index
      const pIdx = r.players.findIndex(p => p.id === socket.id);
      if (pIdx === -1) return;
      
      if (r.gameState.currentPlayer !== pIdx) {
        socket.emit('error', 'Not your turn');
        return;
      }

      const nextState = playTurn(r.gameState, action);
      r.gameState = nextState;
      
      io.to(room).emit('gameState', nextState);

      // Check game over
      if (nextState.finishedOrder.length >= nextState.playerCount - 1) {
         // Game Over logic
         // Store result for next round
         // r.lastRoundResult = ...
      }

    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Handle player leaving...
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
