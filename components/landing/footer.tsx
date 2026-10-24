'use client';

import { Sparkles, Github, Twitter, Linkedin, Mail } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const sections = [
    {
      title: 'Product',
      links: [
        { name: 'Features', href: '#features' },
        { name: 'Use Cases', href: '#use-cases' },
        { name: 'Pricing', href: '#' },
        { name: 'Changelog', href: '#' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { name: 'Documentation', href: '/docs' },
        { name: 'Help Center', href: '#' },
        { name: 'Community', href: '#' },
        { name: 'Blog', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { name: 'About Us', href: '#' },
        { name: 'Contact', href: '#' },
        { name: 'Privacy Policy', href: '#' },
        { name: 'Terms of Service', href: '#' },
      ],
    },
  ];

  const socialLinks = [
    { icon: <Github className="size-5" />, href: 'https://github.com/THU-MAIC/Classby-AI' },
    { icon: <Twitter className="size-5" />, href: '#' },
    { icon: <Linkedin className="size-5" />, href: '#' },
    { icon: <Mail className="size-5" />, href: '#' },
  ];

  return (
    <footer className="relative z-10 w-full bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-20 pb-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6 group w-fit">
              <img src="/logo-horizontal.svg" alt="Classby-AI" className="h-10 dark:hidden" />
              <img src="/logo-horizontal-white.svg" alt="Classby-AI" className="h-10 hidden dark:block" />
            </Link>
            <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
              Empowering learners through AI-native immersive classrooms. Transform any topic into an interactive educational journey.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  className="size-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-200 dark:hover:border-purple-800 transition-all hover:scale-110"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav Columns */}
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-sm">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800 mb-8" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {currentYear} Classby-AI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">
              Built by Classby-AI
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
