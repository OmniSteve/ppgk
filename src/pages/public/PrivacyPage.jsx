import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-[#2563EB] text-sm hover:underline mb-8 block">← Back to home</Link>
        <h1 className="text-4xl font-black mb-4">Privacy Notice</h1>
        <p className="text-slate-400 mb-8">Last updated: January 2025 · Premier Performance Goalkeeping · Malta</p>
        <div className="space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Data Controller</h2>
            <p>Premier Performance Goalkeeping, operating in Malta, is the data controller for personal information collected through this platform.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Data We Collect</h2>
            <p>We collect: name, email, mobile number, emergency contact details, and player information including date of birth, experience level, medical information and allergies. We collect this data to provide and operate our training services.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Data</h2>
            <p>Your data is used to: manage bookings, process payments, send notifications, ensure player safety during sessions, and comply with our legal obligations.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Sharing</h2>
            <p>We share data only with coaches delivering sessions, and our payment processor. We do not sell personal data. We do not share data with third parties for marketing.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Data Retention</h2>
            <p>Booking and financial records are retained for seven years for accounting purposes. Account data is retained while your account is active. Medical information is deleted upon written request where legally permissible.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Your Rights</h2>
            <p>Under the GDPR, you have the right to access, correct, delete, or export your personal data. You may also object to processing or request restriction. Contact us to exercise these rights.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Security</h2>
            <p>We implement appropriate technical and organisational measures to protect your data. Medical and child-related data is accessible only by authorised staff.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
            <p>For privacy queries, contact: info@ppgk.app</p>
          </section>
        </div>
      </div>
    </div>
  );
}