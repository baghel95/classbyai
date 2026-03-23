'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Mail, Lock, ArrowRight, Github, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const prompt = searchParams.get('prompt');

  useEffect(() => {
    if (prompt) {
      localStorage.setItem('requirementDraft', JSON.stringify(prompt));
    }
  }, [prompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // 1. Create user via API
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // 2. Sign in automatically
      await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      }) as any;
      router.push(callbackUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/10 dark:bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 dark:bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Create an account</h1>
          <p className="text-slate-600 dark:text-slate-400">Join thousands of students and teachers on Classby-AI</p>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/40 dark:border-white/5 rounded-[32px] p-8 shadow-2xl shadow-black/5 dark:shadow-black/20">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type="text"
                  value={name}
                  disabled={isLoading}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-purple-500/50 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-medium"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-purple-500/50 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-medium"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type="password"
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-purple-500/50 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all font-medium"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <Button 
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
            >
              {isLoading ? 'Creating Account...' : 'Get Started'} <ArrowRight className="size-5" />
            </Button>
          </form>

          <div className="mt-8 relative text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <span className="relative px-4 bg-white dark:bg-slate-900 text-xs font-bold text-slate-400 uppercase tracking-widest">
              Or sign up with
            </span>
          </div>

          <div className="mt-8 grid gap-4">
            <button 
              onClick={() => signIn('google')}
              className="h-12 w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <img src="https://www.google.com/favicon.ico" alt="" className="size-4" />
              Google
            </button>
           
          </div>
        </div>

        <p className="mt-10 text-center text-slate-600 dark:text-slate-400 font-medium">
          Already have an account?{' '}
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ''}`} className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
            Sign in
          </Link>
        </p>

        <p className="mt-6 text-center text-[10px] text-slate-400 leading-relaxed uppercase tracking-tighter">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
