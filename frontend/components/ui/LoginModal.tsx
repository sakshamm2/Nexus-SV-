"use client";
import { useState } from "react";
import { Mail, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Emails the user a sign-in link that brings them back to /chat, already signed in
  const sendLink = async () => {
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/chat` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass relative w-full max-w-sm rounded-3xl bg-[#0b0b0d]/90 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-gray-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        {sent ? (
          <div className="text-center">
            <Mail className="mx-auto h-10 w-10 text-fuchsia-400" />
            <h2 className="mt-4 text-2xl font-semibold">Check your email</h2>
            <p className="mt-2 text-sm text-gray-400">
              We sent a sign-in link to {email}. Click it to finish signing in. This window closes on its own.
            </p>
            <button onClick={() => setSent(false)} className="mt-6 text-sm text-gray-400 underline">
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">Sign in to Nexus SV</h2>
            <p className="mt-2 text-sm text-gray-400">
              Enter your email and we&apos;ll send you a sign-in link. Signed-in users can upload documents.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendLink();
              }}
              className="mt-6 space-y-3"
            >
              <input
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-gray-500 focus:border-white/30"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send sign-in link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}