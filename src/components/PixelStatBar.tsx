/**
 * PixelStatBar
 *
 * A pixel-art style segmented progress bar for displaying pet stats.
 * 10 segments, filled proportionally to value (0–100).
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PixelStatBarProps {
  /** Emoji or symbol shown on the left */
  icon: string;
  /** Stat label, e.g. "Hunger" */
  label: string;
  /** Current stat value, 0–100 */
  value: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_SEGMENTS = 10;

/** Returns a segment colour based on how full the bar is */
const getSegmentColor = (filledCount: number): string => {
  if (filledCount >= 8) return '#4ade80'; // green  — healthy
  if (filledCount >= 5) return '#facc15'; // yellow — okay
  if (filledCount >= 3) return '#fb923c'; // orange — low
  return '#f87171';                        // red    — critical
};

/** Dim colour for empty segments */
const EMPTY_COLOR = '#1e1b2e';
const EMPTY_BORDER = '#3b3459';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PixelStatBar({ icon, label, value }: PixelStatBarProps): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, value));
  const filledCount = Math.round((clamped / 100) * TOTAL_SEGMENTS);
  const segmentColor = useMemo(() => getSegmentColor(filledCount), [filledCount]);

  return (
    <View style={styles.row}>
      {/* Icon + Label */}
      <View style={styles.labelGroup}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      {/* Segmented bar */}
      <View style={styles.barContainer}>
        {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => {
          const filled = i < filledCount;
          const isFirst = i === 0;
          const isLast = i === TOTAL_SEGMENTS - 1;

          const segmentStyle: ViewStyle = {
            backgroundColor: filled ? segmentColor : EMPTY_COLOR,
            borderColor: filled ? segmentColor : EMPTY_BORDER,
            borderTopLeftRadius: isFirst ? 4 : 0,
            borderBottomLeftRadius: isFirst ? 4 : 0,
            borderTopRightRadius: isLast ? 4 : 0,
            borderBottomRightRadius: isLast ? 4 : 0,
            // Pixel-art gap between segments
            marginRight: isLast ? 0 : 2,
          };

          return (
            <View
              key={i}
              style={[styles.segment, segmentStyle]}
            />
          );
        })}
      </View>

      {/* Numeric value */}
      <Text style={styles.value}>{Math.round(clamped)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },

  icon: {
    fontSize: 18,
    marginRight: 6,
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c4b5fd',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  barContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
    borderWidth: 1,
    borderColor: '#3b3459',
    borderRadius: 5,
    backgroundColor: '#0f0b1e',
    paddingHorizontal: 3,
    paddingVertical: 3,
  },

  segment: {
    flex: 1,
    height: '100%',
    borderWidth: 1,
  },

  value: {
    width: 32,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '800',
    color: '#e2d9f3',
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
});

// ---------------------------------------------------------------------------
// Demo / Examples
// ---------------------------------------------------------------------------

/**
 * Quick visual test — drop <PixelStatBarDemo /> into any screen to preview.
 *
 * @example
 *   import { PixelStatBarDemo } from '../components/PixelStatBar';
 */
export function PixelStatBarDemo(): React.JSX.Element {
  return (
    <View style={demoStyles.wrapper}>
      <Text style={demoStyles.heading}>Stat Bars</Text>
      <PixelStatBar icon="🍔" label="Hunger"  value={100} />
      <PixelStatBar icon="🧼" label="Clean"   value={50}  />
      <PixelStatBar icon="😴" label="Energy"  value={20}  />
      <PixelStatBar icon="❤️" label="Health"  value={75}  />
    </View>
  );
}

const demoStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#0f0b1e',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    margin: 16,
    borderWidth: 1,
    borderColor: '#3b3459',
  },
  heading: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
});

export default PixelStatBar;
