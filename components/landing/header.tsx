'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useTheme } from '@/lib/hooks/use-theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Globe, 
  Sparkles,
  LogOut,
  User as UserIcon,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { 
  Avatar, 
  AvatarImage, 
  AvatarFallback 
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onSettingsOpen?: () => void;
  scrollToGenerate?: () => void;
}

export function Header({ onSettingsOpen, scrollToGenerate }: HeaderProps) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLocale = () => {
    const next = locale === 'en-US' ? 'hi-IN' : locale === 'hi-IN' ? 'en-IN' : 'en-US';
    setLocale(next);
  };

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'Use Cases', href: '#use-cases' },
    { name: 'Documentation', href: '/docs' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4',
        isScrolled 
          ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 py-3' 
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
               
            <img src="/logo-horizontal.svg" alt="Classby-AI" className="h-10 dark:hidden" />
            <img src="/logo-horizontal-white.svg" alt="Classby-AI" className="h-10 hidden dark:block" />
         
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <Globe className="size-3.5" />
            <span className="uppercase">{locale.split('-')[0]}</span>
          </button>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all outline-none group">
                  <Avatar size="sm" className="border border-slate-200 dark:border-slate-800">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 font-bold">
                      {session.user.name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="size-3.5 text-slate-400 group-data-[state=open]:rotate-180 transition-transform" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold truncate">{session.user.name}</span>
                  <span className="text-xs font-medium text-slate-500 truncate">{session.user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer w-full">
                    <UserIcon className="size-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
                  onClick={() => signOut()}
                >
                  <LogOut className="size-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="text-sm font-bold">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="ghost" className="text-sm font-bold">
                Sign up
              </Button>
            </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-slate-600 dark:text-slate-400"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-lg font-bold text-slate-900 dark:text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={toggleLocale} className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    <Globe className="size-4" /> {locale === 'en-US' ? 'English' : 'Hindi'}
                  </button>
                  <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />} Theme
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {session?.user ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <Avatar size="lg">
                        <AvatarImage src={session.user.image ?? undefined} />
                        <AvatarFallback className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 font-bold text-lg">
                          {session.user.name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold truncate">{session.user.name}</span>
                        <span className="text-xs text-slate-500 truncate">{session.user.email}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full font-bold h-12 rounded-xl flex items-center gap-2 text-destructive border-destructive/20 hover:bg-destructive/5"
                      onClick={() => signOut()}
                    >
                      <LogOut className="size-4" /> Log out
                    </Button>
                  </div>
                ) : (
                  <>
                    <Link href="/login" className="w-full">
                      <Button variant="outline" className="w-full font-bold h-12 rounded-xl">Log in</Button>
                    </Link>
                    <Button 
                      onClick={() => {
                        setMobileMenuOpen(false);
                        scrollToGenerate?.();
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 rounded-xl"
                    >
                      Get Started <ArrowRight className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
