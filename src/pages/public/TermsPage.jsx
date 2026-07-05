import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-[#2563EB] text-sm hover:underline mb-8 block">← Back to home</Link>
        <h1 className="text-4xl font-black mb-4">Terms and Conditions</h1>
        <p className="text-slate-400 mb-8">Last updated: January 2025 · Premier Performance Goalkeeping · Malta</p>
        <div className="prose prose-invert max-w-none space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By registering for an account and using the Premier Performance Goalkeeping platform, you agree to these terms and conditions. If you do not agree, please do not use this service.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Booking and Cancellation Policy</h2>
            <p>Session bookings are subject to availability. Cancellations must be made before the session cancellation deadline. Credits may be refunded for eligible cancellations as configured by the administrator. Rescheduling is limited to once per seven-day period per individual booking.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Session Credits and Packages</h2>
            <p>Session credits purchased as part of a package expire three months from the date of purchase unless otherwise specified. Expired credits cannot be used. Credits are non-transferable.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Payments</h2>
            <p>All payments are processed securely. The currency is Euro (EUR). Refunds are subject to the cancellation policy. We do not store payment card details.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Health and Safety</h2>
            <p>Participants must disclose relevant medical conditions and allergies when creating a player profile. Premier Performance Goalkeeping reserves the right to refuse participation if safety concerns arise.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. GDPR and Data Protection</h2>
            <p>Your personal data is processed in accordance with the GDPR and our Privacy Notice. We operate primarily in Malta under EU data protection law.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Contact</h2>
            <p>For any queries, please contact us through the application or email us at info@ppgk.app.</p>
          </section>
        </div>
      </div>
    </div>
  );
}