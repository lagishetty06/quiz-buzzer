'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { useSocket } from '@/hooks/useSocket';
import { Shield, Users, Zap, Award, Cpu, Activity, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  const { connectionStatus, pingMs } = useSocket();

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-red-500 selection:text-white">
      <Header connectionStatus={connectionStatus} pingMs={pingMs} role="landing" />

      {/* Main Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center items-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider mb-8 animate-bounce">
          <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>Engineered for 1,000+ Concurrent Participants</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-center text-white tracking-tight leading-tight max-w-4xl">
          Real-Time Quiz Buzzer <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-rose-400 to-amber-400">
            Millisecond Precision
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 text-center max-w-2xl leading-relaxed">
          High-performance, zero-latency buzzer app powered by Redis atomic lock engine & WebSockets. Zero race-conditions guaranteed.
        </p>

        {/* Role Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 w-full max-w-4xl mt-12">
          {/* Participant Portal Card */}
          <Link
            href="/participant"
            className="group relative p-8 rounded-2xl glass-panel border border-slate-700/60 hover:border-red-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
            
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30 mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-white group-hover:text-red-400 transition-colors flex items-center gap-2">
                Participant Portal
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Join a live quiz room with your team name, press the central buzzer, and compete for the instant winner spot.
              </p>

              <ul className="mt-6 space-y-2.5">
                <li className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Spacebar & Touch Buzzer Trigger</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Instant Winner Lockout Feedback</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Auto-Reconnect Resilience</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-red-400">
              <span>JOIN ARENA AS PLAYER</span>
              <span className="p-1.5 rounded-full bg-red-500/10 border border-red-500/20 group-hover:bg-red-500 group-hover:text-white transition-all">
                →
              </span>
            </div>
          </Link>

          {/* Admin Portal Card */}
          <Link
            href="/admin"
            className="group relative p-8 rounded-2xl glass-panel border border-slate-700/60 hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>

            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2">
                Admin Portal
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Control room state, activate/lock buzzers, view live participant counts, and inspect real-time millisecond leaderboards.
              </p>

              <ul className="mt-6 space-y-2.5">
                <li className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>One-Click Buzzer Activation & Freeze</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Relative Millisecond Delta Timeline</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Real-Time Participant Monitoring</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-400">
              <span>LAUNCH CONTROL DASHBOARD</span>
              <span className="p-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white transition-all">
                →
              </span>
            </div>
          </Link>
        </div>

        {/* Feature Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl w-full mt-16 pt-8 border-t border-slate-800/80">
          <div className="glass-card p-4 rounded-xl flex items-start gap-3">
            <Cpu className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">Redis Atomic Engine</h4>
              <p className="text-xs text-slate-400 mt-1">Single-threaded Lua eval guarantees single winner down to the millisecond.</p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl flex items-start gap-3">
            <Activity className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">Microsecond Delta</h4>
              <p className="text-xs text-slate-400 mt-1">Precise relative timing (e.g. Winner vs +42ms runner-up) resolves close calls.</p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl flex items-start gap-3">
            <Zap className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">1,000 Sockets Scale</h4>
              <p className="text-xs text-slate-400 mt-1">Lightweight binary & JSON event payloads for high throughput.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-slate-500 border-t border-slate-800/60">
        Quiz Buzzer Architecture • Next.js App Router + Socket.io + Redis State Store
      </footer>
    </div>
  );
}
