import Redis from 'ioredis';
import { BuzzEntry, BuzzerState, RoomState } from '../types';

export class RedisBuzzerStore {
  private redis: Redis | null = null;
  private isRedisConnected = false;

  // In-memory fallback storage when Redis is absent
  private memoryRooms: Map<string, RoomState> = new Map();
  private memoryParticipants: Map<string, { socketId: string; teamName: string; roomId: string }> = new Map();

  // Redis Lua script for atomic hit registration
  private static PRESS_BUZZER_LUA = `
    local stateKey = KEYS[1]
    local buzzesKey = KEYS[2]
    local winnerKey = KEYS[3]
    
    local teamName = ARGV[1]
    local socketId = ARGV[2]
    local serverTsStr = ARGV[3]
    local clientTsStr = ARGV[4]

    local state = redis.call('GET', stateKey)
    if not state or state ~= 'active' then
      return cjson.encode({ error = 'BUZZER_LOCKED' })
    end

    -- Check if team already buzzed in this round
    local existingRank = redis.call('ZSCORE', buzzesKey, teamName)
    if existingRank then
      return cjson.encode({ error = 'ALREADY_BUZZED' })
    end

    local serverTs = tonumber(serverTsStr)
    local clientTs = tonumber(clientTsStr)

    -- Add to sorted set (score = serverTs)
    redis.call('ZADD', buzzesKey, serverTs, teamName)

    -- Determine winner atomically
    local winner = redis.call('GET', winnerKey)
    local isWinner = false
    if not winner then
      redis.call('SET', winnerKey, teamName)
      winner = teamName
      isWinner = true
    end

    -- Get winner timestamp
    local winnerTs = tonumber(redis.call('ZSCORE', buzzesKey, winner))
    local deltaMs = math.max(0, serverTs - winnerTs)

    -- Get rank (0-indexed rank converted to 1-indexed)
    local rankZero = redis.call('ZRANK', buzzesKey, teamName)
    local rank = rankZero + 1

    local result = {
      teamName = teamName,
      socketId = socketId,
      serverTimestamp = serverTs,
      clientTimestamp = clientTs,
      isWinner = isWinner,
      winner = winner,
      deltaMs = math.floor(deltaMs * 100 + 0.5) / 100,
      rank = rank
    }

    return cjson.encode(result)
  `;

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    try {
      this.redis = new Redis(url, {
        retryStrategy: (times) => {
          if (times > 3) {
            console.log('[Redis] Max reconnection attempts reached. Utilizing optimized in-memory atomic store.');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 2000);
        },
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
        console.log('✅ [Redis] Connected successfully to Redis cluster/instance.');
      });

      this.redis.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn('[Redis] Connection lost. Falling back to in-memory store:', err.message);
        }
        this.isRedisConnected = false;
      });
    } catch (e) {
      console.log('[Redis] Initial connection error. Falling back to in-memory store.');
      this.isRedisConnected = false;
    }
  }

  private getOrCreateMemoryRoom(roomId: string): RoomState {
    if (!this.memoryRooms.has(roomId)) {
      this.memoryRooms.set(roomId, {
        roomId,
        state: 'locked',
        buzzes: [],
      });
    }
    return this.memoryRooms.get(roomId)!;
  }

  public async getRoomState(roomId: string): Promise<RoomState> {
    if (this.isRedisConnected && this.redis) {
      try {
        const stateKey = `room:${roomId}:state`;
        const winnerKey = `room:${roomId}:winner`;
        const buzzesKey = `room:${roomId}:buzzes`;

        const [state, winner, rawBuzzes] = await Promise.all([
          this.redis.get(stateKey),
          this.redis.get(winnerKey),
          this.redis.zrange(buzzesKey, 0, -1, 'WITHSCORES')
        ]);

        const buzzes: BuzzEntry[] = [];
        if (rawBuzzes && rawBuzzes.length > 0) {
          let winnerScore = 0;
          if (winner) {
            const wIdx = rawBuzzes.indexOf(winner);
            if (wIdx !== -1) {
              winnerScore = parseFloat(rawBuzzes[wIdx + 1]);
            }
          } else {
            winnerScore = parseFloat(rawBuzzes[1]);
          }

          for (let i = 0; i < rawBuzzes.length; i += 2) {
            const team = rawBuzzes[i];
            const score = parseFloat(rawBuzzes[i + 1]);
            const isW = winner ? team === winner : i === 0;
            const rank = (i / 2) + 1;
            buzzes.push({
              teamName: team,
              socketId: '',
              serverTimestamp: score,
              isWinner: isW,
              deltaMs: Math.max(0, Math.round((score - winnerScore) * 100) / 100),
              rank
            });
          }
        }

        return {
          roomId,
          state: (state as BuzzerState) || 'locked',
          winnerTeam: winner || undefined,
          buzzes
        };
      } catch (err) {
        console.error('[Redis] Error fetching room state, using memory fallback:', err);
      }
    }

    return this.getOrCreateMemoryRoom(roomId);
  }

  public async armBuzzer(roomId: string): Promise<RoomState> {
    const armedAt = Date.now();
    if (this.isRedisConnected && this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        pipeline.set(`room:${roomId}:state`, 'active');
        pipeline.del(`room:${roomId}:winner`);
        pipeline.del(`room:${roomId}:buzzes`);
        pipeline.set(`room:${roomId}:armedAt`, armedAt.toString());
        await pipeline.exec();

        return {
          roomId,
          state: 'active',
          buzzes: [],
          armedAt
        };
      } catch (err) {
        console.error('[Redis] Error arming buzzer:', err);
      }
    }

    // In-memory atomic fallback
    const room = this.getOrCreateMemoryRoom(roomId);
    room.state = 'active';
    room.winnerTeam = undefined;
    room.buzzes = [];
    room.armedAt = armedAt;
    return room;
  }

  public async lockBuzzer(roomId: string): Promise<RoomState> {
    const lockedAt = Date.now();
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.set(`room:${roomId}:state`, 'locked');
        await this.redis.set(`room:${roomId}:lockedAt`, lockedAt.toString());
      } catch (err) {
        console.error('[Redis] Error locking buzzer:', err);
      }
    }

    const room = this.getOrCreateMemoryRoom(roomId);
    room.state = 'locked';
    room.lockedAt = lockedAt;
    return this.getRoomState(roomId);
  }

  public async resetBuzzer(roomId: string): Promise<RoomState> {
    if (this.isRedisConnected && this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        pipeline.set(`room:${roomId}:state`, 'locked');
        pipeline.del(`room:${roomId}:winner`);
        pipeline.del(`room:${roomId}:buzzes`);
        await pipeline.exec();
      } catch (err) {
        console.error('[Redis] Error resetting buzzer:', err);
      }
    }

    const room = this.getOrCreateMemoryRoom(roomId);
    room.state = 'locked';
    room.winnerTeam = undefined;
    room.buzzes = [];
    return room;
  }

  public async registerBuzz(
    roomId: string,
    teamName: string,
    socketId: string,
    clientTimestamp: number
  ): Promise<{ success: boolean; entry?: BuzzEntry; error?: string }> {
    const now = performance.now() + performance.timeOrigin; // High resolution timestamp in ms

    if (this.isRedisConnected && this.redis) {
      try {
        const stateKey = `room:${roomId}:state`;
        const buzzesKey = `room:${roomId}:buzzes`;
        const winnerKey = `room:${roomId}:winner`;

        const rawRes = await this.redis.eval(
          RedisBuzzerStore.PRESS_BUZZER_LUA,
          3,
          stateKey,
          buzzesKey,
          winnerKey,
          teamName,
          socketId,
          now.toString(),
          clientTimestamp.toString()
        );

        if (typeof rawRes === 'string') {
          const parsed = JSON.parse(rawRes);
          if (parsed.error) {
            return { success: false, error: parsed.error };
          }
          return { success: true, entry: parsed as BuzzEntry };
        }
      } catch (err) {
        console.error('[Redis] Lua eval failed, using memory fallback engine:', err);
      }
    }

    // High-precision synchronous atomic execution for in-memory fallback
    const room = this.getOrCreateMemoryRoom(roomId);

    if (room.state !== 'active') {
      return { success: false, error: 'BUZZER_LOCKED' };
    }

    const alreadyBuzzed = room.buzzes.some((b) => b.teamName === teamName);
    if (alreadyBuzzed) {
      return { success: false, error: 'ALREADY_BUZZED' };
    }

    const isWinner = room.buzzes.length === 0;
    if (isWinner) {
      room.winnerTeam = teamName;
    }

    const winnerScore = room.buzzes[0] ? room.buzzes[0].serverTimestamp : now;
    const deltaMs = Math.max(0, Math.round((now - winnerScore) * 100) / 100);
    const rank = room.buzzes.length + 1;

    const entry: BuzzEntry = {
      teamName,
      socketId,
      serverTimestamp: now,
      clientTimestamp,
      isWinner,
      deltaMs,
      rank
    };

    room.buzzes.push(entry);
    return { success: true, entry };
  }

  public registerParticipant(socketId: string, teamName: string, roomId: string) {
    this.memoryParticipants.set(socketId, { socketId, teamName, roomId });
  }

  public removeParticipant(socketId: string) {
    const p = this.memoryParticipants.get(socketId);
    this.memoryParticipants.delete(socketId);
    return p;
  }

  public getRoomParticipants(roomId: string) {
    return Array.from(this.memoryParticipants.values()).filter((p) => p.roomId === roomId);
  }
}
