/**
 * PetDisplay
 *
 * The virtual pet component shared across all screens.
 *
 * Features:
 *   - Idle bounce animation (gentle float up-down)
 *   - Glow ring that changes colour based on mood
 *   - Sleeping ZZZ animation (💤 floats upward)
 *   - Mood badge with emoji + label
 *
 * Props:
 *   mood       — current PetMood from Redux
 *   size       — image side length in px (default 220)
 *   isSleeping — whether to apply sleeping visuals
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useAppSelector } from '../hooks';
import {
  selectHunger,
  selectEnergy,
  selectClean,
  selectComputedHappiness,
} from '../redux/petSlice';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PET_NEUTRAL = require('../assets/pets/pet_neutral.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PET_HAPPY = require('../assets/pets/pet_happy.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PET_SAD = require('../assets/pets/pet_sad.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PET_EATING = require('../assets/pets/pet_eating.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PET_SLEEPING = require('../assets/pets/pet_sleeping.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PET_MAX_HAPPY = require('../assets/pets/pet_max_happy.png');

// ---------------------------------------------------------------------------
// Mood config
// ---------------------------------------------------------------------------

interface MoodCfg {
  emoji: string;
  label: string;
  glowColor: string;
  image: any;
}

const MOOD_CFG: Record<string, MoodCfg> = {
  sleeping: { emoji: '😴', label: 'Zzz...', glowColor: '#818CF8', image: PET_SLEEPING },
  eating: { emoji: '😋', label: 'Yum!', glowColor: '#34D399', image: PET_EATING },
  max_happy: { emoji: '🌟', label: 'Super Happy!', glowColor: '#EC4899', image: PET_MAX_HAPPY },
  sad: { emoji: '😢', label: 'Sad...', glowColor: '#60A5FA', image: PET_SAD },
  happy: { emoji: '😄', label: 'Happy!', glowColor: '#FFD700', image: PET_HAPPY },
  neutral: { emoji: '😊', label: 'Okay', glowColor: '#A78BFA', image: PET_NEUTRAL },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PetDisplayProps {
  size?: number;
  isSleeping?: boolean;
  isEating?: boolean;
  isHappy?: boolean;   // forced happy (e.g. after bath)
  hideBadge?: boolean;
}

export function PetDisplay({
  size = 220,
  isSleeping = false,
  isEating = false,
  isHappy = false,
  hideBadge = false,
}: PetDisplayProps): React.JSX.Element {
  const bounceY = useRef(new Animated.Value(0)).current;
  const bounceScale = useRef(new Animated.Value(1)).current;
  const zzzOpacity = useRef(new Animated.Value(0)).current;
  const zzzY = useRef(new Animated.Value(0)).current;

  // Select stats from redux
  const hunger = useAppSelector(selectHunger);
  const clean = useAppSelector(selectClean);
  const energy = useAppSelector(selectEnergy);
  const happiness = useAppSelector(selectComputedHappiness);

  // Determine display sprite key
  let stateKey: keyof typeof MOOD_CFG = 'neutral';
  if (isSleeping) {
    stateKey = 'sleeping';
  } else if (isEating) {
    stateKey = 'eating';
  } else if (isHappy) {
    stateKey = 'happy';
  } else if (hunger > 90 && clean > 90 && energy > 90) {
    stateKey = 'max_happy';
  } else if (hunger < 30 || clean < 30 || energy < 30) {
    stateKey = 'sad';
  } else if (happiness > 70) {
    stateKey = 'happy';
  }

  const cfg = MOOD_CFG[stateKey];

  // ── Scale Bounce Animation on Eat or Happy ────────────────────────────────
  useEffect(() => {
    if (isEating || isHappy) {
      Animated.sequence([
        Animated.timing(bounceScale, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.spring(bounceScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [isEating, isHappy, bounceScale]);

  // ── Idle bounce / Breathing animation ─────────────────────────────────────
  useEffect(() => {
    const toValue = isSleeping ? -4 : -10;
    const duration = isSleeping ? 2000 : 1400;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue, duration, useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounceY, isSleeping]);

  // ── ZZZ float while sleeping ─────────────────────────────────────────────
  useEffect(() => {
    if (!isSleeping) {
      zzzOpacity.setValue(0);
      zzzY.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(zzzOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(zzzY, { toValue: -45, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(zzzOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(zzzY, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isSleeping, zzzOpacity, zzzY]);

  const glowSize = Math.round(size * 0.75);

  return (
    <View style={styles.wrapper}>
      {/* ── Glow ring (behind pet) ─────────────────────────────────────── */}


      {/* ── Floating ZZZ ──────────────────────────────────────────────── */}
      {isSleeping && (
        <Animated.Text
          style={[
            styles.zzz,
            { opacity: zzzOpacity, transform: [{ translateY: zzzY }] },
          ]}
        >
          💤
        </Animated.Text>
      )}

      {/* ── Pet image — Animated.View wrapping Image for reliable bounce ─ */}
      <Animated.View
        style={[
          { width: size, height: size },
          isSleeping && { opacity: 0.78 },
          { transform: [{ translateY: bounceY }, { scale: bounceScale }] },
        ]}
      >
        <Image
          source={cfg.image}
          style={{
            width: size,
            height: size,
            opacity: 1.5,
          }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Mood badge ────────────────────────────────────────────────── */}
      {!hideBadge && (
        <View style={[styles.badge, { borderColor: cfg.glowColor + '90' }]}>
          <Text style={styles.badgeEmoji}>{cfg.emoji}</Text>
          <Text style={[styles.badgeLabel, { color: cfg.glowColor }]}>
            {cfg.label}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  zzz: {
    position: 'absolute',
    top: -5,
    right: 10,
    fontSize: 28,
    zIndex: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1.5,
    gap: 5,
  },
  badgeEmoji: {
    fontSize: 15,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

export default PetDisplay;
