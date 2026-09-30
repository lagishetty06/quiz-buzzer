import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RedisBuzzerStore } from './services/redisStore';
import { AdminActionPayload, BuzzPayload, JoinRoomPayload } from './types';

dotenv.config();

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());

// Health check & Metrics endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memoryUsage: process.memoryUsage(),
  });
});

const server = http.createServer(app);

// Socket.io setup tuned for high concurrency & minimal overhead
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e6, // 1MB buffer
});

const store = new RedisBuzzerStore();

// Track sockets per room
const roomSocketsMap: Map<string, Set<string>> = new Map();

function broadcastRoomStats(roomId: string) {
  const socketSet = roomSocketsMap.get(roomId);
  const participants = store.getRoomParticipants(roomId);
  const stats = {
    connectedSockets: socketSet ? socketSet.size : 0,
    participantCount: participants.length,
    participants: participants.map((p) => p.teamName),
  };
  io.to(`admin_${roomId}`).emit('room_stats', stats);
}

io.on('connection', (socket: Socket) => {
  let currentRoomId: string | null = null;
  let currentTeamName: string | null = null;
  let isSocketAdmin = false;

  // 1. Join Room
  socket.on('join_room', async (payload: JoinRoomPayload, ack?: (res: any) => void) => {
    const { roomId, role, teamName } = payload;
    if (!roomId) {
      if (ack) ack({ success: false, error: 'ROOM_ID_REQUIRED' });
      return;
    }

    currentRoomId = roomId;

    if (role === 'admin') {
      isSocketAdmin = true;
      socket.join(`admin_${roomId}`);
      socket.join(roomId);

      const roomState = await store.getRoomState(roomId);
      const participants = store.getRoomParticipants(roomId);

      if (ack) ack({ success: true, roomState, participants: participants.map((p) => p.teamName) });
      broadcastRoomStats(roomId);
      return;
    }

    // Participant Flow
    if (!teamName || teamName.trim() === '') {
      if (ack) ack({ success: false, error: 'TEAM_NAME_REQUIRED' });
      return;
    }

    currentTeamName = teamName.trim();
    socket.join(roomId);

    // Register socket in memory tracker
    if (!roomSocketsMap.has(roomId)) {
      roomSocketsMap.set(roomId, new Set());
    }
    roomSocketsMap.get(roomId)!.add(socket.id);

    store.registerParticipant(socket.id, currentTeamName, roomId);

    const roomState = await store.getRoomState(roomId);

    if (ack) {
      ack({
        success: true,
        roomState,
        teamName: currentTeamName,
      });
    }

    // Notify admins of new participant joining
    broadcastRoomStats(roomId);
    io.to(`admin_${roomId}`).emit('participant_joined', { teamName: currentTeamName, socketId: socket.id });
  });

  // 2. Press Buzzer (Participant) - Microsecond / High-Precision Execution
  socket.on('press_buzzer', async (payload: BuzzPayload, ack?: (res: any) => void) => {
    const roomId = payload.roomId || currentRoomId;
    const teamName = payload.teamName || currentTeamName;

    if (!roomId || !teamName) {
      if (ack) ack({ success: false, error: 'INVALID_SESSION' });
      return;
    }

    const result = await store.registerBuzz(
      roomId,
      teamName,
      socket.id,
      payload.clientTimestamp || Date.now()
    );

    if (!result.success) {
      if (ack) ack({ success: false, error: result.error });
      return;
    }

    const buzzEntry = result.entry!;

    if (ack) {
      ack({ success: true, buzzEntry });
    }

    // Broadcast hit immediately to room participants and admin dashboard
    io.to(roomId).emit('buzz_occurred', {
      buzzEntry,
      roomId,
    });
  });

  // 3. Arm Buzzer (Admin)
  socket.on('arm_buzzer', async (payload: AdminActionPayload, ack?: (res: any) => void) => {
    const roomId = payload.roomId || currentRoomId;
    if (!roomId) return;

    const roomState = await store.armBuzzer(roomId);

    // Broadcast arm state change to all clients in room
    io.to(roomId).emit('buzzer_state_changed', {
      state: 'active',
      armedAt: roomState.armedAt,
      buzzes: [],
      winnerTeam: undefined,
    });

    if (ack) ack({ success: true, roomState });
  });

  // 4. Lock Buzzer (Admin)
  socket.on('lock_buzzer', async (payload: AdminActionPayload, ack?: (res: any) => void) => {
    const roomId = payload.roomId || currentRoomId;
    if (!roomId) return;

    const roomState = await store.lockBuzzer(roomId);

    io.to(roomId).emit('buzzer_state_changed', {
      state: 'locked',
      lockedAt: roomState.lockedAt,
      buzzes: roomState.buzzes,
      winnerTeam: roomState.winnerTeam,
    });

    if (ack) ack({ success: true, roomState });
  });

  // 5. Reset Buzzer (Admin)
  socket.on('reset_buzzer', async (payload: AdminActionPayload, ack?: (res: any) => void) => {
    const roomId = payload.roomId || currentRoomId;
    if (!roomId) return;

    const roomState = await store.resetBuzzer(roomId);

    io.to(roomId).emit('buzzer_reset', {
      state: 'locked',
      buzzes: [],
      winnerTeam: undefined,
    });

    if (ack) ack({ success: true, roomState });
  });

  // 6. Ping / Latency Check
  socket.on('ping_check', (clientTs: number, ack?: (serverTs: number) => void) => {
    if (ack) ack(Date.now());
  });

  // 7. Disconnect Handler
  socket.on('disconnect', () => {
    if (currentRoomId) {
      const set = roomSocketsMap.get(currentRoomId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) roomSocketsMap.delete(currentRoomId);
      }
      const p = store.removeParticipant(socket.id);
      if (p) {
        io.to(`admin_${currentRoomId}`).emit('participant_left', { teamName: p.teamName, socketId: socket.id });
      }
      broadcastRoomStats(currentRoomId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`
🚀 Quiz Buzzer High-Concurrency Server running on http://localhost:${PORT}
⚡ Socket.io listening for events...
  `);
});
