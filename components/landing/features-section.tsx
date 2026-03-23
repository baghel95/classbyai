'use client';

import { motion } from 'motion/react';
import { 
  Sparkles, 
  Users, 
  Layout, 
  Pencil, 
  Download, 
  MessageSquare,
  Bot,
  Chrome,
  Zap
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';

const FEATURES = [
  {
    icon: Zap,
    title: 'One-Click Generation',
    desc: 'Describe a topic or attach materials; the AI builds a full lesson in minutes.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  },
  {
    icon: Users,
    title: 'Multi-Agent Classroom',
    desc: 'AI teachers and peers lecture, discuss, and interact with you in real time.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    icon: Layout,
    title: 'Rich Scene Types',
    desc: 'Slides, quizzes, interactive HTML simulations, and project-based learning (PBL).',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10'
  },
  {
    icon: Pencil,
    title: 'Whiteboard & TTS',
    desc: 'Agents draw diagrams, write formulas, and explain concepts out loud.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  {
    icon: Download,
    title: 'Export Anywhere',
    desc: 'Download editable .pptx slides or interactive .html pages for offline use.',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10'
  },
  {
    icon: Bot,
    title: 'OpenClaw Integration',
    desc: 'Generate classrooms from Feishu, Slack, and 20+ messaging apps.',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10'
  }
];

export function FeaturesSection() {
  const { t } = useI18n();

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold mb-4 bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent"
          >
            Powerful Features for Modern Learning
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto"
          >
            Experience a new way of education powered by advanced multi-agent orchestration and generative AI.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="group p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/5 hover:-translate-y-1"
            >
              <div className={`${feature.bg} ${feature.color} size-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="size-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm md:text-base">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
