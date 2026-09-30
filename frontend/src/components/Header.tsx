'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ConnectionStatus } from '@/hooks/useSocket';
import { sound } from '@/lib/sound';
import { Volume2, VolumeX, Radio, Wifi, Shield, Users, Sparkles } from 'lucide-react';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  pingMs: number | null;
  roomId?: string;
  role?: 'admin' | 'participant' | 'landing';
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  pingMs,
  roomId,
  role = 'landing',
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setEnabled(next);
    if (next) sound.playArm();
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            CONNECTED
          </span>
        );
      case 'reconnecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            RECONNECTING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            DISCONNECTED
          </span>
        );
    }
  };

  return (
    <header className="w-full glass-panel sticky top-0 z-50 border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 text-white shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform duration-200">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white tracking-wide">
                QUIZ<span className="text-red-500">BUZZER</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700">
                v1.0 • Low Latency
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Ultra-Fast Atomic Race-Condition Engine
            </p>
          </div>
        </Link>

        {/* Room & Status Info */}
        <div className="flex items-center gap-3 md:gap-4">
          {roomId && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card border border-slate-700/50">
              <span className="text-xs text-slate-400">ROOM CODE:</span>
              <span className="font-mono text-sm font-bold text-amber-400 tracking-wider">
                {roomId}
              </span>
            </div>
          )}

          {pingMs !== null && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-800">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>{pingMs} ms</span>
            </div>
          )}

          {getStatusBadge()}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg glass-button text-slate-300 hover:text-white transition-colors"
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>
        </div>
      </div>
    </header>
  );
};
