const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

/**
 * Formats an ISO date string or Date for display in the user's locale.
 */
export function formatDate(
  input: string | Date,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  locale?: string
): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Formats a duration in seconds as H:MM:SS or M:SS when under one hour.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Formats a numeric score with optional max and decimal places.
 */
export function formatScore(
  score: number,
  max?: number,
  fractionDigits = 1
): string {
  const formatted = score.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
  if (max === undefined) {
    return formatted;
  }
  const formattedMax = max.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
  return `${formatted} / ${formattedMax}`;
}

/**
 * Truncates text to a maximum length with an ellipsis suffix.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const sliceLength = Math.max(0, maxLength - 1);
  return `${text.slice(0, sliceLength)}…`;
}
