import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useChat } from "../../context/ChatContext";

export function LoginScreen() {
  const { login, isConnecting } = useChat();
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await login(phone.trim(), displayName.trim());
    if (!result.ok) {
      setError(result.error || "Could not sign in. Try again.");
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-surface-dark via-[#0d1220] to-[#141a2e] p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl bg-surface-dark-soft border border-white/10 shadow-glow-cyan p-8"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-gradient-to-br from-glow-cyan to-glow-violet flex items-center justify-center text-xl font-bold text-slate-900">
            OC
          </div>
          <h1 className="text-2xl font-semibold text-text-dark">Orbital Chat</h1>
          <p className="text-sm text-text-dark/60 mt-1">Sign in with your phone number</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-dark/60 mb-1.5">
              Phone number
            </label>
            <input
              type="tel"
              inputMode="tel"
              required
              placeholder="+1 555 000 1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-text-dark placeholder:text-text-dark/30 outline-none focus:border-glow-cyan/60 focus:shadow-glow-cyan transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-dark/60 mb-1.5">
              Display name (optional)
            </label>
            <input
              type="text"
              placeholder="What should others call you?"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-text-dark placeholder:text-text-dark/30 outline-none focus:border-glow-violet/60 focus:shadow-glow-violet transition"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full rounded-lg bg-gradient-to-r from-glow-cyan to-glow-violet py-2.5 font-semibold text-slate-900 disabled:opacity-60 transition hover:opacity-90"
          >
            {isConnecting ? "Connecting…" : "Continue"}
          </button>
        </form>

        <p className="mt-6 text-[11px] leading-relaxed text-text-dark/40 text-center">
          This demo verifies your phone number as an identity label only — it
          does not send a real SMS/OTP code. Do not use it for anything you
          wouldn't say under your real number; production deployments should
          add a verified OTP provider before going live.
        </p>
      </motion.div>
    </div>
  );
}
