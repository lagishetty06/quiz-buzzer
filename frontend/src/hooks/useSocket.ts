import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface BuzzEntry {
  teamName: string;
  socketId: string;
  serverTimestamp: number;
  clientTimestamp?: number;
  isWinner: boolean;
  deltaMs: number;
  rank: number;
}

export interface RoomState {
  roomId: string;
  state: 'active' | 'locked';
  winnerTeam?: string;
  buzzes: BuzzEntry[];
  armedAt?: number;
  lockedAt?: number;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('⚡ [Socket] Connected to server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnectionStatus('disconnected');
      console.warn('⚠️ [Socket] Disconnected:', reason);
    });

    socket.on('reconnect_attempt', (attempt) => {
      setConnectionStatus('reconnecting');
      console.log(`🔄 [Socket] Reconnect attempt #${attempt}`);
    });

    socket.on('reconnect', () => {
      setConnectionStatus('connected');
      console.log('✅ [Socket] Reconnected successfully');
    });

    // Ping / Latency check loop
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = performance.now();
        socket.emit('ping_check', Date.now(), () => {
          const latency = Math.round(performance.now() - start);
          setPingMs(latency);
        });
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, []);

  // API Callbacks
  const joinRoom = useCallback(
    (
      roomId: string,
      role: 'admin' | 'participant',
      teamName?: string
    ): Promise<{ success: boolean; roomState?: RoomState; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) return resolve({ success: false, error: 'NO_SOCKET' });
        socketRef.current.emit('join_room', { roomId, role, teamName }, (res: any) => {
          resolve(res);
        });
      });
    },
    []
  );

  const pressBuzzer = useCallback(
    (roomId: string, teamName: string): Promise<{ success: boolean; buzzEntry?: BuzzEntry; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) return resolve({ success: false, error: 'NO_SOCKET' });
        const clientTimestamp = performance.now() + performance.timeOrigin;
        socketRef.current.emit('press_buzzer', { roomId, teamName, clientTimestamp }, (res: any) => {
          resolve(res);
        });
      });
    },
    []
  );

  const armBuzzer = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('arm_buzzer', { roomId });
    }
  }, []);

  const lockBuzzer = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('lock_buzzer', { roomId });
    }
  }, []);

  const resetBuzzer = useCallback((roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('reset_buzzer', { roomId });
    }
  }, []);

  return {
    socket: socketRef.current,
    connectionStatus,
    pingMs,
    joinRoom,
    pressBuzzer,
    armBuzzer,
    lockBuzzer,
    resetBuzzer,
  };
}
