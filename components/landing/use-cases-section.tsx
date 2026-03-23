'use client';

import { motion } from 'motion/react';
import { 
  Code, 
  Gamepad, 
  LineChart, 
  BookOpen,
  ArrowRight
} from 'lucide-react';

const USE_CASES = [
  {
    icon: Code,
    title: 'Programming',
    quote: 'Teach me Python from scratch in 30 min',
    desc: 'Generate structured coding lessons with interactive examples and AI-assisted debugging.',
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-500'
  },
  {
    icon: Gamepad,
    title: 'Game Rules',
    quote: 'How to play the board game Avalon',
    desc: 'Break down complex rulebooks into engaging tutorials with visual aids and practice rounds.',
    color: 'from-purple-500/20 to-pink-500/20',
    iconColor: 'text-purple-500'
  },
  {
    icon: LineChart,
    title: 'Financial Analysis',
    quote: 'Analyze the stock prices of Zhipu and MiniMax',
    desc: 'Create real-time data visualizations and market analysis sessions with AI agents.',
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-500'
  },
  {
    icon: BookOpen,
    title: 'Academic Research',
    quote: 'Break down the latest DeepSeek paper',
    desc: 'Summarize long academic papers into digestible classroom sessions with expert AI moderators.',
    color: 'from-orange-500/20 to-red-500/20',
    iconColor: 'text-orange-500'
  }
];

export function UseCasesSection() {
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-950/20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl md:text-4xl font-bold mb-4 dark:text-white"
            >
              Real-world Use Cases
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-slate-500 dark:text-slate-400"
            >
              From complex coding topics to deep academic research, Classby-AI makes learning anything simple and interactive.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold hover:gap-3 transition-all">
              Explore all cases <ArrowRight className="size-4" />
            </button>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {USE_CASES.map((useCase, idx) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              viewport={{ once: true }}
              className={`relative overflow-hidden rounded-[32px] p-1 bg-linear-to-br ${useCase.color}`}
            >
              <div className="relative h-full bg-white dark:bg-slate-900 rounded-[31px] p-8 lg:p-10">
                <div className="flex items-start justify-between mb-8">
                  <div className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 ${useCase.iconColor}`}>
                    <useCase.icon className="size-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {useCase.title}
                  </span>
                </div>
                
                <div className="mb-6">
                  <p className="text-lg lg:text-xl font-semibold mb-4 dark:text-white italic">
                    &ldquo;{useCase.quote}&rdquo;
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed">
                    {useCase.desc}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="size-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-xs font-medium text-slate-400">Interactive session ready</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
