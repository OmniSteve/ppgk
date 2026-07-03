import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Calendar, CreditCard, Users, CheckCircle, ArrowRight, Star } from 'lucide-react';

const features = [
  { icon: Calendar, title: 'Book Sessions', desc: 'Browse and book individual training sessions with ease.' },
  { icon: CreditCard, title: 'Flexible Packages', desc: 'Purchase session credit packages and manage your balance.' },
  { icon: Users, title: 'Multiple Players', desc: 'Manage bookings for multiple players under one account.' },
  { icon: Shield, title: 'Secure & Private', desc: 'Your data is protected with industry-standard security.' },
];

const benefits = [
  'Mobile-friendly booking in seconds',
  'Real-time session availability',
  'Automatic credit management',
  'Calendar integration for all bookings',
  'Email confirmations and reminders',
  'Full booking and payment history',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center">
            <span className="font-black text-white text-sm">GK</span>
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Premier Performance</p>
            <p className="text-[#2563EB] text-xs">Goalkeeping</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/signin" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">
            Sign In
          </Link>
          <Link to="/register" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-full px-4 py-1.5 text-[#2563EB] text-sm font-medium mb-8">
          <Star size={14} />
          Malta's Premier Goalkeeping Academy
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
          Train Smarter.<br />
          <span className="text-[#2563EB]">Book Faster.</span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          The complete platform for Premier Performance Goalkeeping — book sessions, manage credits, and track your goalkeeper's development in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/register"
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-8 py-4 rounded-xl text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/30"
          >
            Create Your Account
            <ArrowRight size={20} />
          </Link>
          <Link
            to="/signin"
            className="border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all flex items-center justify-center gap-2"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#0F2237] py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Everything you need</h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">One platform for parents, players, and coaches.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-[#0D1B2A] rounded-2xl p-6 border border-white/10 hover:border-[#2563EB]/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#2563EB]/20 flex items-center justify-center mb-4">
                  <f.icon size={22} className="text-[#2563EB]" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-black mb-6">Built for goalkeeping families</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Head Coach Matthew Towns and the Premier Performance team have designed this platform around the needs of goalkeepers and their families in Malta.
            </p>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-slate-300">
                  <CheckCircle size={18} className="text-[#2563EB] flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-[#2563EB]/20 to-[#0F2237] rounded-3xl p-8 border border-[#2563EB]/20">
            <div className="space-y-4">
              <div className="bg-[#0D1B2A] rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Saturday Morning GK Session</span>
                  <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full font-medium">4 spots left</span>
                </div>
                <p className="text-slate-400 text-xs">9:00 AM – 11:00 AM · Ta' Qali Stadium</p>
              </div>
              <div className="bg-[#0D1B2A] rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Credit Balance</span>
                  <span className="text-[#2563EB] font-bold text-lg">8 credits</span>
                </div>
                <p className="text-slate-400 text-xs">3 packages · Expires in 67 days</p>
              </div>
              <div className="bg-[#2563EB] rounded-xl p-4">
                <p className="font-bold text-sm">Booking confirmed!</p>
                <p className="text-blue-200 text-xs mt-1">Lucas — Saturday 9:00 AM · 2 credits deducted</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2024 Premier Performance Goalkeeping. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/terms" className="text-slate-500 hover:text-white text-sm transition-colors">Terms</Link>
            <Link to="/privacy" className="text-slate-500 hover:text-white text-sm transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}