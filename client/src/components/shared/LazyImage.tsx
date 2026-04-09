import { useEffect, useState, type ImgHTMLAttributes } from 'react';

import { Skeleton } from '@/components/ui/Skeleton';

const SIZE_PX = { sm: 32, md: 40, lg: 64 } as const;

export type LazyImageSize = keyof typeof SIZE_PX;

export type LazyImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt' | 'width' | 'height' | 'loading' | 'decoding'
> & {
  src: string;
  alt: string;
  size?: LazyImageSize;
};

export function LazyImage({
  src,
  alt,
  size = 'md',
  className = '',
  onLoad,
  onError,
  ...imgRest
}: LazyImageProps) {
  const dim = SIZE_PX[size];
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setPhase('loading');
  }, [src]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-slate-100 ${className}`}
      style={{ width: dim, height: dim }}
    >
      {phase !== 'error' ? (
        <img
          src={src}
          alt={alt}
          width={dim}
          height={dim}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition-opacity duration-200 ${
            phase === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={(e) => {
            setPhase('ready');
            onLoad?.(e);
          }}
          onError={(e) => {
            setPhase('error');
            onError?.(e);
          }}
          {...imgRest}
        />
      ) : null}
      {phase === 'loading' ? (
        <Skeleton
          className="pointer-events-none absolute inset-0 h-full w-full rounded-full"
          aria-hidden
        />
      ) : null}
      {phase === 'error' ? (
        <span
          className="absolute inset-0 flex items-center justify-center bg-slate-200 text-slate-500"
          role="img"
          aria-label={alt ? `Could not load image: ${alt}` : 'Image failed to load'}
        >
          <svg
            className="h-[45%] w-[45%]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </span>
      ) : null}
    </div>
  );
}
