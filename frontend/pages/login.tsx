"use client";

import { useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { LogoIcon } from "@/components/layout/Icons";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Sparkles, Check, User } from "lucide-react";

function SsoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props} aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.97-3.05 8.44-7 9.92C8.05 19.44 5 15.97 5 11V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const router = useRouter();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 80, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 80, damping: 20 });
  const rotateX = useTransform(springY, [-300, 300], [2, -2]);
  const rotateY = useTransform(springX, [-300, 300], [-2, 2]);

  const startOAuth = (provider: string) => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const callbackUrl = next && next.startsWith("/") ? next : "/dashboard";
    void router.push(`/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const ssoEnabled = process.env.NEXT_PUBLIC_SSO_ENABLED === "true";

  const validateForm = () => {
    const newErrors: { name?: string; email?: string; password?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email format";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setServerError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) {
        setServerError(data.error || "Sign in failed. Please try again.");
        setIsLoading(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") ? next : "/dashboard";
    } catch {
      setServerError("Unable to reach the server. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F5F1EB] flex overflow-hidden">
      {/* Left — Dark luxury editorial */}
      <motion.div
        className="hidden lg:flex lg:w-[54%] relative overflow-hidden border-r border-[#1A1A1E]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mouseX.set(e.clientX - rect.left - rect.width / 2);
          mouseY.set(e.clientY - rect.top - rect.height / 2);
        }}
        onMouseLeave={() => {
          mouseX.set(0);
          mouseY.set(0);
        }}
      >
        <div className="absolute inset-0 bg-[#0F0F0F]" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        {/* Warm brass orbs */}
        <motion.div
          className="absolute -top-32 -right-32 w-[720px] h-[720px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(200,169,110,0.12), transparent 65%)", rotateX, rotateY }}
        />
        <motion.div
          className="absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(26,26,30,0.8), transparent 70%)" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] border border-[#C8A96E]/[0.08] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] border border-[#C8A96E]/[0.04] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-[#C8A96E] flex items-center justify-center group-hover:bg-[#B89A5F] transition">
              <span className="font-serif font-bold text-[#0F0F0F]">◈</span>
            </div>
            <span className="font-serif text-xl tracking-tight text-[#F5F1EB]">Rittik<span className="font-light text-[#C8A96E]">EvalOpsAI</span></span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[#C8A96E]/10 border border-[#C8A96E]/20 text-xs font-medium text-[#C8A96E]">ENTERPRISE</span>
          </Link>

          <div className="space-y-10">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1A1E] border border-[#2A2A28] text-xs text-stone-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> System operational • 99.99% uptime
              </div>
              <h1 className="mt-6 font-serif text-[44px] xl:text-[52px] leading-[0.9] tracking-[-0.03em] text-[#F5F1EB]">
                Evaluate.
                <br />
                <span className="font-light italic text-[#C8A96E]">Compare.</span>
                <br />
                Ship with
                <br />
                confidence.
              </h1>
              <p className="mt-6 text-[15px] leading-relaxed text-stone-400 max-w-[420px]">
                The evaluation layer for teams shipping LLMs. Benchmark GPT, Claude, Llama and Qwen across accuracy, hallucination, latency and cost — in one refined workspace.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-full bg-[#1A1A1E] border border-[#2A2A28] text-xs text-stone-300 flex items-center gap-2"><Check className="h-3 w-3 text-[#C8A96E]" /> SOC 2 Certified</span>
                <span className="px-3 py-1.5 rounded-full bg-[#1A1A1E] border border-[#2A2A28] text-xs text-stone-300 flex items-center gap-2"><Shield className="h-3 w-3 text-[#C8A96E]" /> Private by design</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-[#1A1A1E] rounded-2xl border border-[#2A2A28] p-6 overflow-hidden group"
              style={{ rotateX, rotateY, transformPerspective: 1000 }}
              whileHover={{ y: -4 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#C8A96E]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex -space-x-2">
                    <div className="h-9 w-9 rounded-full bg-[#C8A96E] border-2 border-[#1A1A1E] flex items-center justify-center text-xs font-bold text-[#0F0F0F]">R</div>
                    <div className="h-9 w-9 rounded-full bg-[#232326] border-2 border-[#1A1A1E] flex items-center justify-center text-xs font-bold text-white">A</div>
                    <div className="h-9 w-9 rounded-full bg-stone-700 border-2 border-[#1A1A1E] flex items-center justify-center text-xs font-bold text-white">S</div>
                    <div className="h-9 w-9 rounded-full bg-stone-800 border-2 border-[#1A1A1E] flex items-center justify-center text-xs text-stone-300">+9</div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">Live</span>
                </div>
                <p className="font-serif text-lg leading-tight text-[#F5F1EB]">“Cut our evaluation time by 70%.”</p>
                <p className="text-xs text-stone-500 mt-1">— Sarah Chen, AI Lead at Linear</p>
                <div className="mt-5 space-y-3">
                  <div className="flex justify-between text-xs"><span className="text-stone-500">Avg. accuracy</span><span className="font-mono font-medium text-[#F5F1EB]">94.2%</span></div>
                  <div className="h-1.5 bg-[#0F0F0F] rounded-full overflow-hidden border border-[#2A2A28]"><motion.div className="h-full bg-[#C8A96E] rounded-full" initial={{ width: 0 }} animate={{ width: "94.2%" }} transition={{ delay: 0.9, duration: 1.2, ease: [0.16, 1, 0.3, 1] }} /></div>
                  <div className="flex gap-2 text-xs"><span className="px-2 py-1 rounded-full bg-[#0F0F0F] border border-[#2A2A28] text-stone-400">GPT-4o 94%</span><span className="px-2 py-1 rounded-full bg-[#0F0F0F] border border-[#2A2A28] text-stone-400">Claude 92%</span></div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>© 2026 RittikEvalOpsAI</span>
            <span className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-[#C8A96E]" /> Crafted for excellence</span>
          </div>
        </div>
      </motion.div>

      {/* Right — Form dark */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-[#0F0F0F] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A1A1E]/20 via-transparent to-transparent pointer-events-none" />
        <motion.div
          className="w-full max-w-[440px] relative"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-8 w-8 rounded-xl bg-[#C8A96E] flex items-center justify-center"><span className="font-serif font-bold text-[#0F0F0F]">◈</span></div>
            <span className="font-serif font-bold text-[#F5F1EB]">RittikEvalOpsAI</span>
          </div>

          <div className="mb-8">
            <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="font-serif text-[32px] tracking-[-0.02em] leading-none text-[#F5F1EB]">Welcome back</motion.h1>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-2.5 text-[14px] leading-relaxed text-stone-400">Sign in to your workspace. All API keys remain encrypted and never leave your vault.</motion.p>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#1A1A1E] rounded-2xl border border-[#2A2A28] p-7 shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input label="Your name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} leftIcon={<User className="h-4 w-4" />} autoComplete="name" disabled={isLoading} />
              <Input label="Work email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} leftIcon={<Mail className="h-4 w-4" />} autoComplete="email" disabled={isLoading} />
              <div>
                <Input label="Password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} leftIcon={<Lock className="h-4 w-4" />} rightIcon={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-stone-500 hover:text-[#F5F1EB] transition" aria-label={showPassword ? "Hide" : "Show"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} autoComplete="current-password" disabled={isLoading} />
                <div className="mt-2.5 flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-[#3A3A38] bg-[#0F0F0F] text-[#C8A96E] focus:ring-[#C8A96E]/20" />
                    <span className="text-sm text-stone-400 group-hover:text-stone-200 transition">Keep me signed in</span>
                  </label>
                  <span className="text-sm font-medium text-[#C8A96E]">Forgot password?</span>
                </div>
              </div>

              {serverError && (
                <div role="alert" className="mt-4 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] leading-relaxed text-red-400">
                  {serverError}
                </div>
              )}

              <Button type="submit" className="w-full h-[46px] text-[14px] mt-1" isLoading={isLoading}>
                <span className="flex items-center gap-2">Continue to workspace <ArrowRight className="h-4 w-4" /></span>
              </Button>
            </form>

            {ssoEnabled && (
              <div className="mt-7">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#2A2A28]" /></div>
                  <div className="relative flex justify-center text-xs"><span className="px-3 bg-[#1A1A1E] text-stone-500">or continue with SSO</span></div>
                </div>
                <div className="mt-5 flex flex-col items-center gap-3">
                  <button type="button" onClick={() => startOAuth("oidc")} className="h-[46px] w-full max-w-sm rounded-xl bg-[#1A1A1E] border border-[#2A2A28] hover:bg-[#232326] hover:border-[#3A3A38] text-sm font-medium text-[#F5F1EB] flex items-center justify-center gap-2 transition group">
                    <SsoIcon className="h-[18px] w-[18px] text-[#C8A96E] group-hover:scale-110 transition" /> SSO
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-stone-500">SSO for Enterprise • SAML 2.0 & OIDC</p>
              </div>
            )}

            <p className="mt-6 text-center text-sm text-stone-400">
              New to RittikEvalOpsAI? <Link href="/register" className="font-medium text-[#C8A96E] hover:underline">Create workspace</Link>
            </p>
          </motion.div>

<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 text-center text-xs leading-relaxed text-stone-500">
              By continuing you agree to our <span className="underline underline-offset-4">Terms</span> and <span className="underline underline-offset-4">Privacy</span>. Your keys are encrypted at rest.
            </motion.p>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-stone-600">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> All systems operational</span>
            <span className="hidden sm:inline">•</span>
            <span>Press <kbd className="px-1.5 py-0.5 bg-[#1A1A1E] border border-[#2A2A28] rounded text-stone-400">⌘K</kbd> to search</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
