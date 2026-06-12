/**
 * Utility helpers.
 *
 * Place pure, stateless helper functions here — formatting, calculations,
 * date utilities, colour helpers, etc.
 *
 * @example
 *   import { formatStatLabel } from '../utils';
 */

/**
 * Clamp a numeric value between `min` and `max`.
 */
export const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

/**
 * Map a 0–100 stat value to a human-readable label.
 */
export const statLabel = (value: number): string => {
  if (value >= 80) return 'Great';
  if (value >= 60) return 'Good';
  if (value >= 40) return 'Okay';
  if (value >= 20) return 'Low';
  return 'Critical';
};

/**
 * Format a Unix timestamp (ms) as a locale date string.
 */
export const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString();
