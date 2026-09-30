'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Header } from '@/components/Header';
import { useSocket, BuzzEntry } from '@/hooks/useSocket';
import { sound } from '@/lib/sound';
import { Radio, Lock, Zap, CheckCircle2, AlertTriangle, ArrowLeft, Keyboard } from 'lucide-react';

export default function ParticipantPage() {
  const { socket, connectionStatus, pingMs, joinRoom, pressBuzzer } = useSocket();

  // Navigation / Session state
  const [hasJoined, setHasJoined] = useState(false);
  const [roomId, setRoomId] = useState('ROOM-1');
  const [teamName, setTeamName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Buzzer & Room State
  const [buzzerState, setBuzzerState] = useState<'active' | 'locked'>('locked');
  const [myBuzz, setMyBuzz] = useState<BuzzEntry | null>(null);
  const [hasSomeoneBuzzed, setHasSomeoneBuzzed] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-focus room & team input on load
  const teamInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (teamInputRef.current) {
      teamInputRef.current.focus();
    }
  }, []);

  // Handle Socket Events when joined
  useEffect(() => {
    if (!socket || !hasJoined) return;

    const handleBuzzerStateChanged = (data: { state: 'active' | 'locked'; buzzes?: BuzzEntry[] }) => {
      setBuzzerState(data.state);
      if (data.state === 'active') {
        setMyBuzz(null);
        setHasSomeoneBuzzed(false);
        sound.playArm();
      } else {
        sound.playLock();
      }
    };

    const handleBuzzOccurred = (data: { buzzEntry: BuzzEntry }) => {
      const entry = data.buzzEntry;
      setHasSomeoneBuzzed(true);

      if (entry.teamName === teamName) {
        setMyBuzz(entry);
        if (entry.isWinner) {
          sound.playWinner();
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#ef4444', '#eab308', '#3b82f6', '#10b981'],
          });
        } else {
          sound.playBuzz();
        }
      }
    };

    const handleBuzzerReset = () => {
      setBuzzerState('locked');
      setMyBuzz(null);
      setHasSomeoneBuzzed(false);
    };

    socket.on('buzzer_state_changed', handleBuzzerStateChanged);
    socket.on('buzz_occurred', handleBuzzOccurred);
    socket.on('buzzer_reset', handleBuzzerReset);

    return () => {
      socket.off('buzzer_state_changed', handleBuzzerStateChanged);
      socket.off('buzz_occurred', handleBuzzOccurred);
      socket.off('buzzer_reset', handleBuzzerReset);
    };
  }, [socket, hasJoined, teamName]);

  // Join Form Submit
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setJoinError('Please enter a Team Name');
      return;
    }
    if (!roomId.trim()) {
      setJoinError('Please enter a Room ID');
      return;
    }

    setJoinError(null);
    setIsSubmitting(true);

    const res = await joinRoom(roomId.trim().toUpperCase(), 'participant', teamName.trim());
    setIsSubmitting(false);

    if (res.success && res.roomState) {
      setHasJoined(true);
      setBuzzerState(res.roomState.state);
      setHasSomeoneBuzzed((res.roomState.buzzes && res.roomState.buzzes.length > 0) || false);

      const existing = res.roomState.buzzes.find((b) => b.teamName === teamName.trim());
      if (existing) {
        setMyBuzz(existing);
      }
    } else {
      setJoinError(res.error || 'Failed to join room. Please check socket connection.');
    }
  };

  // Buzzer Press Execution
  const triggerBuzz = useCallback(async () => {
    if (buzzerState !== 'active' || myBuzz || isPressing) return;

    setIsPressing(true);
    sound.playBuzz();

    const res = await pressBuzzer(roomId, teamName);
    setIsPressing(false);

    if (res.success && res.buzzEntry) {
      setMyBuzz(res.buzzEntry);
      if (res.buzzEntry.isWinner) {
        sound.playWinner();
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.6 },
        });
      }
    }
  }, [buzzerState, myBuzz, isPressing, pressBuzzer, roomId, teamName]);

  // Spacebar Keyboard Listener
  useEffect(() => {
    if (!hasJoined) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerBuzz();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasJoined, triggerBuzz]);

  // Step 1: Join Screen
  if (!hasJoined) {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <Header connectionStatus={connectionStatus} pingMs={pingMs} role="participant" />

        <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
          <div className="glass-panel p-8 rounded-3xl border border-slate-700/60 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-xl"></div>

            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-3">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Join Quiz Arena</h2>
              <p className="text-xs text-slate-400 mt-1">Enter your team details to compete in real time</p>
            </div>

            {joinError && (
              <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Room Code / ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="e.g. ROOM-1"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono tracking-wider transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Team / Player Name
                </label>
                <input
                  ref={teamInputRef}
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Cyber Warriors"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'CONNECTING...' : 'ENTER QUIZ ARENA →'}
              </button>
            </form>
          </div>
        </main>

        <footer className="text-center py-6 text-xs text-slate-500">
          Quiz Buzzer Participant Portal
        </footer>
      </div>
    );
  }

  // Step 2: Buzzer Arena Screen
  const isLocked = buzzerState === 'locked';
  const isLockedOut = hasSomeoneBuzzed && !myBuzz;

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-red-500 selection:text-white">
      <Header connectionStatus={connectionStatus} pingMs={pingMs} roomId={roomId} role="participant" />

      {/* Main Buzzer Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center">
        {/* Top Info Header */}
        <div className="w-full flex items-center justify-between mb-8 glass-card px-6 py-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHasJoined(false)}
              className="p-1.5 rounded-lg glass-button text-slate-400 hover:text-white transition-colors"
              title="Leave Room"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">TEAM</span>
              <span className="text-base font-extrabold text-white">{teamName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">STATUS:</span>
            {buzzerState === 'active' ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse">
                ARMED & READY
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                LOCKED / STANDBY
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Status Notification Banners (Hides who clicked to participants!) */}
        {myBuzz && (
          <div className="w-full mb-8 p-6 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-center animate-pulse">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-2xl font-extrabold text-emerald-300 uppercase">
              BUZZER PRESSED!
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Your hit is recorded. Standby for the Host/Admin to announce the result!
            </p>
          </div>
        )}

        {isLockedOut && (
          <div className="w-full mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
            <Lock className="w-6 h-6 text-amber-400 mx-auto mb-1" />
            <h4 className="text-lg font-bold text-amber-400 uppercase">
              BUZZER LOCKED — A TEAM HAS BUZZED IN!
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Listen to the Host/Admin to see who answered first.
            </p>
          </div>
        )}

        {/* MASSIVE CENTRAL BUZZER BUTTON */}
        <div className="relative my-6 flex items-center justify-center">
          {/* Outer Pulsing Aura Ring when Active */}
          {buzzerState === 'active' && !myBuzz && (
            <div className="absolute inset-0 rounded-full bg-red-600/30 blur-2xl animate-pulse-ring pointer-events-none"></div>
          )}

          <button
            onClick={triggerBuzz}
            disabled={isLocked || !!myBuzz || isPressing}
            className={`
              relative w-64 h-64 sm:w-80 sm:h-80 rounded-full font-black text-2xl sm:text-4xl tracking-widest uppercase transition-all duration-150 transform active:scale-95 shadow-2xl flex flex-col items-center justify-center select-none
              ${
                buzzerState === 'active' && !myBuzz
                  ? 'bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 text-white shadow-red-600/50 hover:shadow-red-500/80 cursor-pointer border-4 border-red-400/60 ring-8 ring-red-500/20'
                  : myBuzz
                  ? 'bg-emerald-900/80 text-emerald-300 cursor-not-allowed border-4 border-emerald-500/60 shadow-none'
                  : 'bg-gradient-to-tr from-slate-800 to-slate-900 text-slate-500 cursor-not-allowed border-4 border-slate-800 shadow-none'
              }
            `}
          >
            {/* Button Inner Reflection */}
            <div className="absolute top-4 w-3/4 h-12 bg-white/10 rounded-full blur-sm pointer-events-none"></div>

            {buzzerState === 'active' && !myBuzz ? (
              <>
                <Zap className="w-12 h-12 sm:w-16 sm:h-16 text-amber-300 mb-2 animate-bounce fill-amber-300" />
                <span className="drop-shadow-lg">BUZZ NOW!</span>
                <span className="text-[11px] font-mono tracking-normal text-red-200 mt-2 bg-red-950/60 px-3 py-1 rounded-full border border-red-400/30">
                  PRESS OR SPACEBAR
                </span>
              </>
            ) : myBuzz ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-2" />
                <span>BUZZED IN</span>
                <span className="text-xs font-mono tracking-normal text-emerald-200 mt-1">
                  STANDBY FOR HOST
                </span>
              </>
            ) : (
              <>
                <Lock className="w-12 h-12 text-slate-600 mb-2" />
                <span>LOCKED</span>
                <span className="text-xs font-mono text-slate-600 mt-1 font-normal">
                  WAITING FOR HOST
                </span>
              </>
            )}
          </button>
        </div>

        {/* Spacebar Prompt */}
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800">
          <Keyboard className="w-4 h-4 text-red-400" />
          <span>Pro-tip: Press <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px] border border-slate-700">Spacebar</kbd> on desktop for fastest reaction time.</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-500">
        Team: <span className="text-slate-300 font-semibold">{teamName}</span> • Room: <span className="text-amber-400 font-semibold">{roomId}</span>
      </footer>
    </div>
  );
}
