export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeTheme {
  key: TimeOfDay;
  greeting: string;
  emoji: string;
  imageUrl: string;
  gradient: string;
  overlay: string;
  accentText: string;
}

const THEMES: Record<TimeOfDay, TimeTheme> = {
  dawn: {
    key: 'dawn',
    greeting: 'Good early morning',
    emoji: '🌅',
    imageUrl:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80',
    gradient: 'linear-gradient(135deg, #4338ca 0%, #ec4899 55%, #f59e0b 100%)',
    overlay: 'linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.45) 100%)',
    accentText: 'text-amber-100',
  },
  morning: {
    key: 'morning',
    greeting: 'Good morning',
    emoji: '☀️',
    imageUrl:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #f59e0b 100%)',
    overlay: 'linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.4) 100%)',
    accentText: 'text-sky-50',
  },
  afternoon: {
    key: 'afternoon',
    greeting: 'Good afternoon',
    emoji: '🌤️',
    imageUrl:
      'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1600&q=80',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #14b8a6 100%)',
    overlay: 'linear-gradient(180deg, rgba(15,23,42,0.42) 0%, rgba(15,23,42,0.35) 100%)',
    accentText: 'text-cyan-50',
  },
  evening: {
    key: 'evening',
    greeting: 'Good evening',
    emoji: '🌆',
    imageUrl:
      'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1600&q=80',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #db2777 50%, #6d28d9 100%)',
    overlay: 'linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.5) 100%)',
    accentText: 'text-orange-100',
  },
  night: {
    key: 'night',
    greeting: 'Good night',
    emoji: '🌙',
    imageUrl:
      'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1600&q=80',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
    overlay: 'linear-gradient(180deg, rgba(2,6,23,0.7) 0%, rgba(2,6,23,0.6) 100%)',
    accentText: 'text-indigo-100',
  },
};

export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h < 5) return 'night';
  if (h < 11) return 'morning';
  if (h < 14) return 'afternoon';
  if (h < 18) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export function getTimeTheme(now: Date = new Date()): TimeTheme {
  const key = getTimeOfDay(now);
  if (key === 'morning' && now.getHours() < 7) return THEMES.dawn;
  return THEMES[key];
}

/**
 * Returns a CSS background value combining a dark overlay (for text contrast),
 * the time-of-day image, and a gradient fallback. Use as the `background` CSS prop.
 */
export function getTimeBackground(theme: TimeTheme): string {
  return `${theme.overlay}, url("${theme.imageUrl}") center/cover no-repeat, ${theme.gradient}`;
}
