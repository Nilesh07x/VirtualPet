/**
 * HomeScreen
 *
 * Living-room background. Pet anchored near the bottom centre.
 *
 * Sound features:
 *   - FEED / CLEAN / SLEEP buttons → playTap()
 *   - Level-up detection → playLevelUp() + ⭐ LEVEL UP! banner (2 s)
 *   - All-100 detection  → playHappy()  + confetti burst (once per session)
 *   - 🔊/🔇 mute toggle top-right
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  selectComputedHappiness,
  selectEnergy,
  selectHunger,
  selectClean,
  selectIsSleeping,
  selectCoins,
  selectLevel,
} from '../redux/petSlice';
import { selectIsMuted, toggleMute, selectIsHapticsEnabled, toggleHaptics } from '../redux/settingsSlice';
import { MiniStatBar } from '../components/MiniStatBar';
import { PetDisplay } from '../components/PetDisplay';
import { RoomBackground } from '../components/RoomBackground';
import SoundManager from '../utils/SoundManager';
import { mediumHaptic, successHaptic } from '../utils/Haptics';
import type { ScreenName } from '../navigation/AppNavigator';

// ---------------------------------------------------------------------------
// Confetti particle — a single animated star
// ---------------------------------------------------------------------------

function ConfettiParticle({ index }: { index: number }) {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const sc = useRef(new Animated.Value(0.5)).current;

  const EMOJIS = ['⭐', '🌟', '✨', '💫', '🎉', '🎊'];
  const emoji = EMOJIS[index % EMOJIS.length];

  useEffect(() => {
    const angle = (index / 12) * Math.PI * 2;
    const radius = 80 + Math.random() * 60;
    Animated.parallel([
      Animated.timing(x, { toValue: Math.cos(angle) * radius, duration: 900, useNativeDriver: true }),
      Animated.timing(y, { toValue: Math.sin(angle) * radius - 40, duration: 900, useNativeDriver: true }),
      Animated.timing(sc, { toValue: 1.5, duration: 300, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(op, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        fontSize: 22,
        transform: [{ translateX: x }, { translateY: y }, { scale: sc }],
        opacity: op,
        zIndex: 200,
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function HudPanel(): React.JSX.Element {
  const hunger = useAppSelector(selectHunger);
  const clean = useAppSelector(selectClean);
  const energy = useAppSelector(selectEnergy);
  const happiness = useAppSelector(selectComputedHappiness);

  return (
    <View style={styles.hud}>
      <MiniStatBar icon="🍔" value={hunger} color="#FF7043" />
      <MiniStatBar icon="🧼" value={clean} color="#42A5F5" />
      <MiniStatBar icon="⚡" value={energy} color="#FFCA28" />
      <MiniStatBar icon="😊" value={happiness} color="#EC4899" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

interface ActionBtnProps {
  icon: string;
  label: string;
  bg: string;
  shade: string;
  onPress: () => void;
  disabled?: boolean;
}

function ActionBtn({ icon, label, bg, shade, onPress, disabled }: ActionBtnProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    SoundManager.playTap();
    mediumHaptic();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.btn,
          { backgroundColor: bg, borderBottomColor: shade },
          disabled && styles.btnDisabled,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={styles.btnIcon}>{icon}</Text>
        <Text style={styles.btnLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

interface HomeScreenProps {
  onNavigate: (screen: ScreenName) => void;
}

export default function HomeScreen({ onNavigate }: HomeScreenProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const isSleeping = useAppSelector(selectIsSleeping);
  const coins = useAppSelector(selectCoins);
  const level = useAppSelector(selectLevel);
  const hunger = useAppSelector(selectHunger);
  const clean = useAppSelector(selectClean);
  const energy = useAppSelector(selectEnergy);
  const isMuted = useAppSelector(selectIsMuted);
  const isHapticsEnabled = useAppSelector(selectIsHapticsEnabled);

  // Track previous level to detect level-up
  const prevLevelRef = useRef(level);

  // Level-up banner state
  const [showLevelUp, setShowLevelUp] = useState(false);
  const levelUpOpacity = useRef(new Animated.Value(0)).current;
  const levelUpScale = useRef(new Animated.Value(0.5)).current;

  // Confetti state — shown once when all stats are 100
  const [showConfetti, setShowConfetti] = useState(false);
  const allMaxRef = useRef(false); // guard: only trigger once per max achievement

  // Fade-in on mount
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeIn]);

  // ── Level-up detection ────────────────────────────────────────────────────
  useEffect(() => {
    if (level > prevLevelRef.current) {
      prevLevelRef.current = level;
      SoundManager.playLevelUp();
      successHaptic();
      // Animate banner in, hold, then out
      levelUpOpacity.setValue(0);
      levelUpScale.setValue(0.5);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(levelUpOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.spring(levelUpScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]),
        Animated.delay(1600),
        Animated.timing(levelUpOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(() => setShowLevelUp(false));
      setShowLevelUp(true);
    } else {
      prevLevelRef.current = level;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // ── All-100 / max-happy detection ─────────────────────────────────────────
  useEffect(() => {
    const allMax = hunger >= 100 && clean >= 100 && energy >= 100;
    if (allMax && !allMaxRef.current) {
      allMaxRef.current = true;
      SoundManager.playHappy();
      successHaptic();
      setShowConfetti(true);
      // Hide confetti after 1.2 s (particles self-fade)
      setTimeout(() => setShowConfetti(false), 1200);
    }
    if (!allMax) {
      allMaxRef.current = false; // reset guard so it can fire again later
    }
  }, [hunger, clean, energy]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <RoomBackground room="living">
        <Animated.View style={[styles.inner, { opacity: fadeIn }]}>

          {/* ── Top bar ──────────────────────────────────────── */}
          <View style={styles.topBar}>
            {/* Left: title + level/coins */}
            <View style={styles.leftBadge}>
              <View style={styles.titleBadge}>
                <Text style={styles.titleText}>🏠 My Home</Text>
              </View>
              <View style={[styles.titleBadge, styles.levelBadge]}>
                <Text style={styles.hudText}>⭐ Lv.{level}</Text>
                <Text style={styles.hudText}>🪙 {coins}</Text>
              </View>

              <View style={styles.titleBadge}>
                <Text style={styles.hudText}> Developed By Nilesh</Text>
              </View>

            </View>

            {/* Right: stat bars + settings toggles */}
            <View style={styles.rightCluster}>
              <HudPanel />
              <View style={styles.settingsRow}>
                <Pressable
                  onPress={() => dispatch(toggleMute())}
                  style={styles.muteBtn}
                  accessibilityLabel={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                >
                  <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    dispatch(toggleHaptics());
                    mediumHaptic();
                  }}
                  style={styles.muteBtn}
                  accessibilityLabel={isHapticsEnabled ? 'Disable haptics' : 'Enable haptics'}
                >
                  <Text style={styles.muteIcon}>{isHapticsEnabled ? '📳' : '📳 OFF'}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── Pet area (bottom-anchored) ────────────────────── */}
          <View style={styles.petArea}>
            {/* Confetti burst when all stats max */}
            {showConfetti && (
              <View style={styles.confettiAnchor}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <ConfettiParticle key={i} index={i} />
                ))}
              </View>
            )}
            <PetDisplay size={300} isSleeping={isSleeping} />
          </View>

          {/* ── Foreground strip — depth illusion ────────────── */}
          <View style={styles.foregroundStrip} />

          {/* ── Level-up banner ────────────────────────────────── */}
          {showLevelUp && (
            <Animated.View
              style={[
                styles.levelUpBanner,
                { opacity: levelUpOpacity, transform: [{ scale: levelUpScale }] },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.levelUpText}>⭐ LEVEL UP!</Text>
              <Text style={styles.levelUpSub}>Level {level}</Text>
            </Animated.View>
          )}

          {/* ── Action buttons ───────────────────────────────── */}
          <View style={styles.actionRow}>
            <ActionBtn
              icon="🍔" label="FEED"
              bg="#FF7043" shade="#BF360C"
              onPress={() => onNavigate('Feed')}
              disabled={isSleeping}
            />
            <ActionBtn
              icon="🧼" label="CLEAN"
              bg="#1E88E5" shade="#0D47A1"
              onPress={() => onNavigate('Clean')}
              disabled={isSleeping}
            />
            <ActionBtn
              icon="😴" label="SLEEP"
              bg="#8E24AA" shade="#4A148C"
              onPress={() => onNavigate('Sleep')}
            />
          </View>

        </Animated.View>
      </RoomBackground>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  inner: { flex: 1 },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 30,
  },
  titleBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  leftBadge: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  levelBadge: {
    marginTop: 15,
    minWidth: 80,
    marginBottom: 10,
  },
  hudText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },

  rightCluster: {
    alignItems: 'flex-end',
    gap: 6,
  },
  settingsRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 8,
  },
  hud: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 180,
  },
  muteBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.89)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-end',
  },
  muteIcon: {
    fontSize: 18,
  },

  // ── Pet area ──────────────────────────────────────────────────────────────
  petArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  confettiAnchor: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    width: 0,
    height: 0,
    zIndex: 200,
  },

  // ── Level-up banner ───────────────────────────────────────────────────────
  levelUpBanner: {
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#FFCA28',
    zIndex: 300,
    alignItems: 'center',
  },
  levelUpText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFCA28',
    letterSpacing: 1,
  },
  levelUpSub: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },

  // ── Foreground strip ──────────────────────────────────────────────────────
  foregroundStrip: {
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  // ── Action row ────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 90,
    borderBottomWidth: 4,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.35 },
  btnIcon: { fontSize: 26, marginBottom: 3 },
  btnLabel: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },
});
