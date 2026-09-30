'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Header } from '@/components/Header';
import { useSocket, BuzzEntry } from '@/hooks/useSocket';
import { sound } from '@/lib/sound';
import { Shield, Zap, Lock, RefreshCw, Trophy, Users, Clock, Radio, Activity, CheckCircle2, Key, LogOut, User } from 'lucide-react';

export default function AdminPage() {
  const { socket, connectionStatus, pingMs, joinRoom, armBuzzer, lockBuzzer, resetBuzzer } = useSocket();

  // Admin Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Room & State
  const [roomId, setRoomId] = useState('ROOM-1');
  const [buzzerState, setBuzzerState] = useState<'active' | 'locked'>('locked');
  const [buzzes, setBuzzes] = useState<BuzzEntry[]>([]);
  const [winner, setWinner] = useState<BuzzEntry | null>(null);

  // Live Participant Monitoring
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [connectedSockets, setConnectedSockets] = useState<number>(0);
  const [participantsList, setParticipantsList] = useState<string[]>([]);

  // Check persistent login session on load
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('admin_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Admin Login Handler
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const validUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'admin';
    const validPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'quizadmin123';

    if (adminUsername.trim() === validUsername && adminPassword.trim() === validPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      setAuthError(null);
    } else {
      setAuthError('Invalid Admin Username or Password.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
  };

  // Join Room as Admin when authenticated
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    joinRoom(roomId, 'admin').then((res) => {
      if (res.success && res.roomState) {
        setBuzzerState(res.roomState.state);
        setBuzzes(res.roomState.buzzes || []);
        const w = res.roomState.buzzes.find((b) => b.isWinner);
        if (w) setWinner(w);
      }
    });

    // Socket Event Handlers
    const handleBuzzerStateChanged = (data: { state: 'active' | 'locked'; buzzes?: BuzzEntry[] }) => {
      setBuzzerState(data.state);
      if (data.state === 'active') {
        setBuzzes([]);
        setWinner(null);
        sound.playArm();
      } else {
        sound.playLock();
      }
    };

    const handleBuzzOccurred = (data: { buzzEntry: BuzzEntry }) => {
      const entry = data.buzzEntry;
      setBuzzes((prev) => {
        if (prev.some((b) => b.teamName === entry.teamName)) return prev;
        return [...prev, entry].sort((a, b) => a.serverTimestamp - b.serverTimestamp);
      });

      if (entry.isWinner) {
        setWinner(entry);
        sound.playWinner();
        confetti({
          particleCount: 140,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#eab308', '#ef4444', '#3b82f6', '#10b981'],
        });
      } else {
        sound.playBuzz();
      }
    };

    const handleBuzzerReset = () => {
      setBuzzerState('locked');
      setBuzzes([]);
      setWinner(null);
      sound.playLock();
    };

    const handleRoomStats = (stats: { connectedSockets: number; participantCount: number; participants: string[] }) => {
      setConnectedSockets(stats.connectedSockets);
      setParticipantCount(stats.participantCount);
      setParticipantsList(stats.participants || []);
    };

    socket.on('buzzer_state_changed', handleBuzzerStateChanged);
    socket.on('buzz_occurred', handleBuzzOccurred);
    socket.on('buzzer_reset', handleBuzzerReset);
    socket.on('room_stats', handleRoomStats);

    return () => {
      socket.off('buzzer_state_changed', handleBuzzerStateChanged);
      socket.off('buzz_occurred', handleBuzzOccurred);
      socket.off('buzzer_reset', handleBuzzerReset);
      socket.off('room_stats', handleRoomStats);
    };
  }, [socket, roomId, joinRoom, isAuthenticated]);

  // Action Button Handlers
  const handleActivate = () => armBuzzer(roomId);
  const handleLock = () => lockBuzzer(roomId);
  const handleReset = () => resetBuzzer(roomId);

  // If NOT authenticated, render Admin Login Modal
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <Header connectionStatus={connectionStatus} pingMs={pingMs} role="admin" />

        <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
          <div className="glass-panel p-8 rounded-3xl border border-slate-700/60 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-xl"></div>

            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
                <Shield className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Admin Portal Access</h2>
              <p className="text-xs text-slate-400 mt-1">Enter your admin credentials to unlock host controls</p>
            </div>

            {authError && (
              <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <Key className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  Admin Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Admin Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase"
              >
                UNLOCK ADMIN DASHBOARD →
              </button>
            </form>

            <div className="mt-6 text-center text-[11px] text-slate-500 border-t border-slate-800 pt-4">
              Default Credentials: <span className="font-mono text-amber-400/80">admin</span> / <span className="font-mono text-amber-400/80">quizadmin123</span>
            </div>
          </div>
        </main>

        <footer className="text-center py-6 text-xs text-slate-500">
          Quiz Buzzer Admin Security Portal
        </footer>
      </div>
    );
  }

  // Authenticated Admin Control Center Screen
  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-amber-500 selection:text-white">
      <Header connectionStatus={connectionStatus} pingMs={pingMs} roomId={roomId} role="admin" />

      {/* Main Admin Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Control Header & Room Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 glass-panel p-6 rounded-3xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">Admin Control Center</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  HOST PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                You announce who clicked! Participants only see locked/buzzed status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Room Selector Input */}
            <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-700">
              <span className="text-xs font-semibold text-slate-400">ROOM ID:</span>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-28 bg-transparent text-amber-400 font-mono font-bold text-sm focus:outline-none tracking-wider uppercase"
              />
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-2xl glass-button text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Logout Admin"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* 3 Prominent Admin Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Activate Buzzer */}
          <button
            onClick={handleActivate}
            className={`
              p-6 rounded-2xl font-extrabold text-base uppercase tracking-wider transition-all duration-200 shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] border
              ${
                buzzerState === 'active'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-emerald-400/50 shadow-emerald-600/30 ring-4 ring-emerald-500/20 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white border-emerald-500/40 hover:from-emerald-600 hover:to-teal-500 shadow-emerald-900/40'
              }
            `}
          >
            <Zap className="w-6 h-6 fill-white" />
            <span>ACTIVATE BUZZER</span>
          </button>

          {/* Lock Buzzer */}
          <button
            onClick={handleLock}
            className="p-6 rounded-2xl font-extrabold text-base uppercase tracking-wider transition-all duration-200 shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white border border-amber-500/40 shadow-amber-900/40"
          >
            <Lock className="w-6 h-6" />
            <span>LOCK BUZZER</span>
          </button>

          {/* Reset Dashboard */}
          <button
            onClick={handleReset}
            className="p-6 rounded-2xl font-extrabold text-base uppercase tracking-wider transition-all duration-200 shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-200 border border-slate-700 shadow-slate-950/50"
          >
            <RefreshCw className="w-6 h-6 text-slate-400" />
            <span>RESET DASHBOARD</span>
          </button>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column (2 Cols): Real-Time Leaderboard & Winner Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* PROMINENT WINNER SPOTLIGHT CARD */}
            {winner ? (
              <div className="p-8 rounded-3xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-900/20 border-2 border-amber-500/60 shadow-2xl shadow-amber-500/20 animate-winner-glow relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl"></div>

                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-500/30">
                    <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ABSOLUTE FIRST HIT (WINNER)
                  </div>
                  <span className="font-mono text-xs text-amber-300">
                    {new Date(winner.serverTimestamp).toISOString().slice(11, 23)}
                  </span>
                </div>

                <div className="flex items-baseline gap-4 mt-2">
                  <span className="text-4xl sm:text-6xl font-black text-amber-300 tracking-tight">
                    {winner.teamName}
                  </span>
                  <span className="text-sm font-bold text-amber-400/90 font-mono bg-amber-950/60 px-3 py-1 rounded-lg border border-amber-500/30">
                    WINNER (0.00 ms)
                  </span>
                </div>

                <p className="text-xs text-amber-200/80 mt-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  Announce <strong className="text-amber-300 underline">{winner.teamName}</strong> to the room! Atomic Redis lock verified this hit first.
                </p>
              </div>
            ) : (
              <div className="p-8 rounded-3xl glass-panel border border-slate-800 text-center py-12">
                <Radio className="w-10 h-10 text-slate-600 mx-auto mb-3 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-300">Awaiting Buzz Inputs</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Click <span className="text-emerald-400 font-semibold">"ACTIVATE BUZZER"</span> above to open the round for participants.
                </p>
              </div>
            )}

            {/* CHRONOLOGICAL LEADERBOARD FEED TABLE */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Chronological Buzz Feed (Admin View Only)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Subsequent teams ranked by exact millisecond relative delta
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-900 text-slate-400 border border-slate-800">
                  {buzzes.length} HITS RECORDED
                </span>
              </div>

              {buzzes.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  No hits recorded in this round yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {buzzes.map((buzz, idx) => (
                    <div
                      key={buzz.teamName + idx}
                      className={`
                        p-4 rounded-2xl flex items-center justify-between transition-all border
                        ${
                          buzz.isWinner
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                            : 'glass-card border-slate-800/80 text-slate-200 hover:border-slate-700'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`
                            w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs
                            ${
                              buzz.isWinner
                                ? 'bg-amber-500 text-slate-950 font-black'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }
                          `}
                        >
                          #{buzz.rank}
                        </span>
                        <div>
                          <span className="font-bold text-base block text-white">{buzz.teamName}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(buzz.serverTimestamp).toISOString().slice(11, 23)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        {buzz.isWinner ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            WINNER
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-rose-400 border border-slate-800">
                            +{buzz.deltaMs.toFixed(2)} ms
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (1 Col): Live Room Participant Monitoring */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800">
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Live Arena Monitor
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="glass-card p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">TEAMS JOINED</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{participantCount}</span>
                </div>
                <div className="glass-card p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">ACTIVE SOCKETS</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">{connectedSockets}</span>
                </div>
              </div>

              {/* Connected Teams List */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">
                  Registered Participants ({participantsList.length})
                </h4>

                {participantsList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No participants joined room {roomId} yet.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {participantsList.map((team, idx) => (
                      <div
                        key={team + idx}
                        className="p-2.5 rounded-xl glass-card border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-slate-200">{team}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Architecture Metrics Card */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 text-xs text-slate-400 space-y-3">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Backend Metrics</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span>State Engine:</span>
                  <span className="text-emerald-400">Redis Lua / Atomic</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span>Transport:</span>
                  <span className="text-slate-200">WebSocket / Socket.io</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Latency Check:</span>
                  <span className="text-amber-400">{pingMs !== null ? `${pingMs}ms` : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-slate-500">
        Admin Control Dashboard • Room {roomId}
      </footer>
    </div>
  );
}
