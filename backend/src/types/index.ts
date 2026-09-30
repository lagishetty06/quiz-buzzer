export type BuzzerState = 'active' | 'locked';

export interface Participant {
  socketId: string;
  teamName: string;
  roomId: string;
  joinedAt: number;
}

export interface BuzzEntry {
  teamName: string;
  socketId: string;
  serverTimestamp: number;
  clientTimestamp?: number;
  isWinner: boolean;
  deltaMs: number; // millisecond difference relative to winner
  rank: number;
}

export interface RoomState {
  roomId: string;
  state: BuzzerState;
  winnerTeam?: string;
  buzzes: BuzzEntry[];
  armedAt?: number;
  lockedAt?: number;
}

export interface JoinRoomPayload {
  roomId: string;
  role: 'admin' | 'participant';
  teamName?: string;
}

export interface BuzzPayload {
  roomId: string;
  teamName: string;
  clientTimestamp: number;
}

export interface AdminActionPayload {
  roomId: string;
}
