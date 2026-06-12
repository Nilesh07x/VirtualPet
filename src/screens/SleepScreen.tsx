/**
 * SleepScreen
 *
 * Bedroom background. Two-state pet system:
 *
 * AWAKE (default on enter):
 *   - pet_neutral.png standing beside the bed
 *   - "Go To Sleep" button shown
 *
 * SLEEPING:
 *   - pet_sleeping.png centred on bed, ZZZ loop
 *   - "Wake Up" button shown
 *   - Energy recovers +5 every 2 s
 *   - sleep.mp3 loops quietly
 *
 * ENERGY REACHES 100 (auto-wake):
 *   - Sleep sound stops immediately
 *   - Pet auto-wakes: pet_max_happy.png shown
 *   - happy.mp3 plays once  (hasCelebratedRest guard)
 *   - Confetti + star burst animation
 *   - "Fully Rested! 🎉" popup for 2.5 s
 *
 * HOME BUTTON:
 *   - SoundManager.stopAll() before navigating away
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MiniStatBar } from '../components/MiniStatBar';
import { PetDisplay } from '../components/PetDisplay';
import { RoomBackground } from '../components/RoomBackground';
import { mediumHaptic, successHaptic } from '../utils/Haptics';
import { CelebrationRain } from '../components/CelebrationRain';
import { useAppDispatch, useAppSelector } from '../hooks';
import type { ScreenName } from '../navigation/AppNavigator';
import { selectEnergy, sleepPet, wakePet, recoverEnergy } from '../redux/petSlice';
import SoundManager from '../utils/SoundManager';

// ---------------------------------------------------------------------------
// Confetti particle — single star emoji that bursts outward
// ---------------------------------------------------------------------------

function ConfettiParticle({ index }: { index: number }) {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const sc = useRef(new Animated.Value(0.4)).current;

  const EMOJIS = ['⭐', '🌟', '✨', '💫', '🎉', '🎊', '💛', '⚡'];
  const emoji = EMOJIS[index % EMOJIS.length];

  useEffect(() => {
    const angle = (index / 12) * Math.PI * 2;
    const radius = 70 + Math.random() * 80;
    Animated.parallel([
      Animated.timing(x, { toValue: Math.cos(angle) * radius, duration: 900, useNativeDriver: true }),
      Animated.timing(y, { toValue: Math.sin(angle) * radius - 50, duration: 900, useNativeDriver: true }),
      Animated.timing(sc, { toValue: 1.6, duration: 350, useNativeDriver: true }),
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
        fontSize: 24,
        transform: [{ translateX: x }, { translateY: y }, { scale: sc }],
        opacity: op,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// SleepScreen
// ---------------------------------------------------------------------------

type PetVisual = 'awake' | 'sleeping' | 'max_happy';

interface SleepScreenProps {
  onNavigate: (screen: ScreenName) => void;
}

export default function SleepScreen({ onNavigate }: SleepScreenProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const energy = useAppSelector(selectEnergy);
  // Keep a ref so the interval callback always sees the latest energy value
  const energyRef = useRef(energy);
  useEffect(() => { energyRef.current = energy; }, [energy]);

  const [petVisual, setPetVisual] = useState<PetVisual>('awake');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const isSleeping = petVisual === 'sleeping';
  const isMaxHappy = petVisual === 'max_happy';

  // ── Animation refs ────────────────────────────────────────────────────────
  const screenFade = useRef(new Animated.Value(0)).current;
  const petOpacity = useRef(new Animated.Value(1)).current;
  const zzzOpacity = useRef(new Animated.Value(0)).current;
  const zzzY = useRef(new Animated.Value(0)).current;
  const popupScale = useRef(new Animated.Value(0.5)).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const zzzLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const energyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard: trigger celebration only once per sleep session
  const hasCelebratedRest = useRef(false);

  // ── Mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(screenFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    return () => {
      SoundManager.stopAll();
      dispatch(wakePet());
      if (energyTimer.current) clearInterval(energyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ZZZ loop while sleeping ────────────────────────────────────────────────
  useEffect(() => {
    if (isSleeping) {
      zzzOpacity.setValue(0);
      zzzY.setValue(0);
      zzzLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(zzzOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(zzzY, { toValue: -50, duration: 1800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(zzzOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(zzzY, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        ]),
      );
      zzzLoopRef.current.start();
    } else {
      zzzLoopRef.current?.stop();
      zzzOpacity.setValue(0);
      zzzY.setValue(0);
    }
    return () => zzzLoopRef.current?.stop();
  }, [isSleeping, zzzOpacity, zzzY]);

  // ── Celebration when Energy reaches 100 ───────────────────────────────────
  const triggerFullyRestedCelebration = useCallback(() => {
    if (hasCelebratedRest.current) return;
    hasCelebratedRest.current = true;

    // 1. Stop sleep sound and timer
    SoundManager.stopSleep();
    if (energyTimer.current) { clearInterval(energyTimer.current); energyTimer.current = null; }

    // 2. Wake Redux immediately
    dispatch(wakePet());

    // 3. Fade out sleeping pet → switch to max_happy → fade in
    Animated.timing(petOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
      setPetVisual('max_happy');
      Animated.timing(petOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });

    // 4. Play happy.mp3
    setShowCelebration(true);
    successHaptic();
    SoundManager.playHappy(() => {
      setShowCelebration(false);
    });

    // 5. Show confetti burst
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1300);

    // 6. Animate "Fully Rested! 🎉" popup in → hold → out
    popupScale.setValue(0.5);
    popupOpacity.setValue(0);
    setShowPopup(true);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(popupScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(popupOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      Animated.delay(2200),
      Animated.timing(popupOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => setShowPopup(false));
  }, [dispatch, petOpacity, popupOpacity, popupScale]);

  // Watch energy while sleeping — auto-celebrate when it hits 100
  useEffect(() => {
    if (isSleeping && energy >= 100 && !hasCelebratedRest.current) {
      triggerFullyRestedCelebration();
    }
  }, [energy, isSleeping, triggerFullyRestedCelebration]);

  // ── Transition helper ─────────────────────────────────────────────────────
  const transitionTo = (next: PetVisual) => {
    Animated.timing(petOpacity, { toValue: 0, duration: 380, useNativeDriver: true }).start(() => {
      setPetVisual(next);
      if (next === 'sleeping') {
        hasCelebratedRest.current = false; // reset guard for new sleep session
        dispatch(sleepPet());
        SoundManager.playSleep();
        if (energyTimer.current) clearInterval(energyTimer.current);
        energyTimer.current = setInterval(() => {
          dispatch(recoverEnergy());
          if (energyRef.current >= 100) {
            clearInterval(energyTimer.current!);
            energyTimer.current = null;
          }
        }, 2000);
      } else if (next === 'awake') {
        SoundManager.stopSleep();
        if (energyTimer.current) { clearInterval(energyTimer.current); energyTimer.current = null; }
        dispatch(wakePet());
      }
      Animated.timing(petOpacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    });
  };

  const handleGoToSleep = () => {
    mediumHaptic();
    transitionTo('sleeping');
  };
  const handleWakeUp = () => {
    mediumHaptic();
    transitionTo('awake');
  };
  const handleLeave = () => {
    SoundManager.stopAll();
    dispatch(wakePet());
    onNavigate('Home');
  };

  const energyLabel =
    energy >= 100 ? '⚡ Fully Rested!' :
      energy >= 90 ? '⚡ Almost there!' :
        energy >= 60 ? '💤 Getting there...' :
          '😴 Very tired...';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <RoomBackground room="bedroom">
        <Animated.View style={[styles.inner, { opacity: screenFade }]}>

          {/* ── Top bar ─────────────────────────────────────── */}
          <View style={styles.topBar}>
            <Pressable
              onPress={handleLeave}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.backText}>← Home</Text>
            </Pressable>
            <View style={styles.hud}>
              <MiniStatBar icon="⚡" value={energy} color="#FFCA28" />
            </View>
          </View>

          {/* ── Pet area ─────────────────────────────────────── */}
          <View style={isMaxHappy || !isSleeping ? styles.petAreaAwake : styles.petAreaSleeping}>
            <View style={styles.confettiAnchor}>
              {showConfetti && Array.from({ length: 12 }).map((_, i) => (
                <ConfettiParticle key={i} index={i} />
              ))}
            </View>

            <Animated.View style={{ opacity: petOpacity, alignItems: 'center' }}>
              {/* ZZZ float above sleeping pet */}
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
              <PetDisplay
                size={250}
                isSleeping={isSleeping}
                isHappy={isMaxHappy}
              />
            </Animated.View>
          </View>

          {/* ── Energy label ─────────────────────────────────── */}
          <View style={styles.labelWrap}>
            <Text style={styles.energyLabel}>{energyLabel}</Text>
          </View>

          {/* ── "Fully Rested!" popup ─────────────────────────── */}
          {showPopup && (
            <Animated.View
              style={[
                styles.popup,
                { opacity: popupOpacity, transform: [{ scale: popupScale }] },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.popupTitle}>Fully Rested! 🎉</Text>
              <Text style={styles.popupSub}>Your pet is full of energy!</Text>
            </Animated.View>
          )}

          {/* ── Action button ────────────────────────────────── */}
          <View style={styles.btnArea}>
            {isSleeping ? (
              <Pressable
                onPress={handleWakeUp}
                style={({ pressed }) => [styles.wakeBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Wake up"
              >
                <Text style={styles.wakeBtnIcon}>☀️</Text>
                <Text style={styles.wakeBtnLabel}>Wake Up</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleGoToSleep}
                style={({ pressed }) => [styles.sleepBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Go to sleep"
              >
                <Text style={styles.sleepBtnIcon}>🌙</Text>
                <Text style={styles.sleepBtnLabel}>
                  {isMaxHappy ? 'Sleep Again' : 'Go To Sleep'}
                </Text>
              </Pressable>
            )}
          </View>

          <CelebrationRain active={showCelebration} />
        </Animated.View>
      </RoomBackground>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  inner: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 35,
  },
  backBtn: {
    backgroundColor: 'rgba(15, 0, 0, 0.91)',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  backText: { fontSize: 14, fontWeight: '800', color: '#FFCA28' },
  hud: {
    backgroundColor: 'rgba(18, 2, 2, 0.92)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 180,
  },

  // ── Pet positioning ────────────────────────────────────────────────────────
  petAreaAwake: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingBottom: 35,
    paddingLeft: 300,
  },
  petAreaSleeping: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingBottom: 0,
    paddingTop: 800,
    paddingLeft: 200,
  },

  // Confetti burst anchor (zero-size, centred over pet)
  confettiAnchor: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    width: 0,
    height: 0,
    zIndex: 200,
  },

  zzz: {
    position: 'absolute',
    top: -10,
    right: -10,
    fontSize: 28,
    zIndex: 5,
  },

  // ── Labels ─────────────────────────────────────────────────────────────────
  labelWrap: { alignItems: 'center', marginTop: 8 },
  energyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFCA28',
    backgroundColor: 'rgba(0,0,0,0.40)',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 10,
  },

  // ── "Fully Rested!" popup ─────────────────────────────────────────────────
  popup: {
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
    backgroundColor: 'rgba(0,0,0,0.80)',
    borderRadius: 20,
    paddingHorizontal: 34,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: '#FFCA28',
    zIndex: 300,
    alignItems: 'center',
  },
  popupTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFCA28',
    letterSpacing: 0.5,
  },
  popupSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginTop: 6,
    opacity: 0.85,
  },

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnArea: { alignItems: 'center', paddingVertical: 18 },

  sleepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B21A8',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 42,
    borderBottomWidth: 4,
    borderBottomColor: '#4A148C',
    elevation: 6,
    gap: 10,
  },
  sleepBtnIcon: { fontSize: 24 },
  sleepBtnLabel: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.4 },

  wakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 42,
    borderBottomWidth: 4,
    borderBottomColor: '#92400E',
    elevation: 6,
    gap: 10,
  },
  wakeBtnIcon: { fontSize: 24 },
  wakeBtnLabel: { fontSize: 16, fontWeight: '900', color: '#1C1917', letterSpacing: 0.4 },

  btnPressed: {
    transform: [{ scale: 0.95 }],
    borderBottomWidth: 1,
    elevation: 2,
  },
});
