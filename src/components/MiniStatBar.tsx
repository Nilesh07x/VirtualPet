/**
 * MiniStatBar
 *
 * Compact HUD stat bar.
 * Layout:  icon  [████████░░]  80
 *
 * The fill width animates smoothly on value change.
 * The numeric label is a plain Text — one clean integer, no duplicates.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export interface MiniStatBarProps {
  icon: string;
  /** 0–100 */
  value: number;
  color: string;
}

export function MiniStatBar({ icon, value, color }: MiniStatBarProps): React.JSX.Element {
  const clamped  = Math.min(100, Math.max(0, Math.round(value)));
  const fillAnim = useRef(new Animated.Value(clamped)).current;

  // Animate only the bar fill width — NOT the text (avoids interpolation bugs)
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue:  clamped,
      duration: 400,
      useNativeDriver: false, // width % — must be false
    }).start();
  }, [clamped, fillAnim]);

  const isLow    = clamped < 25;
  const barColor = isLow ? '#FF3B30' : color;
  const numColor = isLow ? '#FF3B30' : color;

  return (
    <View style={styles.row}>
      {/* Stat emoji icon */}
      <Text style={styles.icon}>{icon}</Text>

      {/* Animated fill bar */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: barColor,
              width: fillAnim.interpolate({
                inputRange:  [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>

      {/*
        Plain Text — single clean integer.
        DO NOT put Animated.Value or interpolate() inside Text children —
        that causes duplicate/concatenated rendering on Android.
      */}
      <Text style={[styles.num, { color: numColor }]}>
        {clamped}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  icon: {
    fontSize: 12,
    width: 18,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    height: 7,
    marginHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  num: {
    fontSize: 10,
    fontWeight: '800',
    width: 24,
    textAlign: 'right',
  },
});

export default MiniStatBar;
