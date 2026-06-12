/**
 * CleanScreen
 *
 * Bathroom background. Three draggable bath items on the bottom shelf.
 * Drag each item onto the pet to clean it:
 *   Soap     → soap_shampoo.mp3 + 🫧 bubbles + +10 Clean
 *   Shampoo  → soap_shampoo.mp3 + 💆 wash     + +10 Clean
 *   Towel    → towel.mp3        + ✨ sparkle  + +10 Clean
 *
 * After a successful drop:
 *   - Pet shows happy sprite for 1.8 s
 *   - Floating "+10 Clean" text rises
 *   - Effect sparkle bursts
 *   - happy.mp3 plays once when clean first reaches 100
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
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
import { CelebrationRain } from '../components/CelebrationRain';
import { useAppDispatch, useAppSelector } from '../hooks';
import type { ScreenName } from '../navigation/AppNavigator';
import { cleanPet, selectClean } from '../redux/petSlice';
import SoundManager from '../utils/SoundManager';
import { mediumHaptic, lightHaptic, successHaptic } from '../utils/Haptics';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const BATH_ITEMS = [
  { id: 'soap', emoji: '🧼', name: 'Soap', amount: 10, effect: '🫧', sound: 'soap', color: '#1E88E5', shade: '#0D47A1' },
  { id: 'shampoo', emoji: '🧴', name: 'Shampoo', amount: 10, effect: '💆', sound: 'soap', color: '#7B1FA2', shade: '#4A148C' },
  { id: 'towel', emoji: '🧻', name: 'Towel', amount: 10, effect: '✨', sound: 'towel', color: '#00897B', shade: '#004D40' },
] as const;

// ---------------------------------------------------------------------------
// FloatingReward
// ---------------------------------------------------------------------------

function FloatingReward({ text, color, trigger }: { text: string; color: string; trigger: number }) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;
    y.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.timing(y, { toValue: -75, duration: 1100, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, [trigger, y, opacity]);

  if (trigger === 0) return null;
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        top: 0,
        alignSelf: 'center',
        fontSize: 17,
        fontWeight: '900',
        color,
        opacity,
        transform: [{ translateY: y }],
        zIndex: 100,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      }}
    >
      {text}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// SparkleEffect — bursts outward on successful clean
// ---------------------------------------------------------------------------

function SparkleEffect({ trigger, effect }: { trigger: number; effect: string }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;
    scale.setValue(0.3);
    opacity.setValue(1);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.6, friction: 3, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, [trigger, scale, opacity]);

  if (trigger === 0) return null;
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        top: 10,
        alignSelf: 'center',
        fontSize: 36,
        opacity,
        transform: [{ scale }],
        zIndex: 99,
        pointerEvents: 'none',
      }}
    >
      {effect}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// DraggableBathItem
// ---------------------------------------------------------------------------

interface DraggableBathItemProps {
  emoji: string;
  name: string;
  color: string;
  shade: string;
  onDropOnPet: (x: number, y: number) => boolean;
}

function DraggableBathItem({ emoji, name, color, shade, onDropOnPet }: DraggableBathItemProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const itemScale = useRef(new Animated.Value(1)).current;
  const onDropRef = useRef(onDropOnPet);
  useEffect(() => { onDropRef.current = onDropOnPet; }, [onDropOnPet]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.stopAnimation();
        pan.setValue({ x: 0, y: 0 });
        Animated.spring(itemScale, { toValue: 1.25, useNativeDriver: true }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, g) => {
        Animated.spring(itemScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        onDropRef.current(g.moveX, g.moveY);
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          friction: 5,
          tension: 60,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ transform: pan.getTranslateTransform(), zIndex: 50, elevation: 20 }}
    >
      <Animated.View
        style={[
          styles.bathCard,
          { backgroundColor: color, borderBottomColor: shade },
          { transform: [{ scale: itemScale }] },
        ]}
      >
        <Text style={styles.bathEmoji}>{emoji}</Text>
        <Text style={styles.bathLabel}>{name}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// CleanScreen
// ---------------------------------------------------------------------------

interface CleanScreenProps {
  onNavigate: (screen: ScreenName) => void;
}

export default function CleanScreen({ onNavigate }: CleanScreenProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const clean = useAppSelector(selectClean);

  const [isHappy, setIsHappy] = useState(false);
  const [rewardTrigger, setRewardTrigger] = useState(0);
  const [sparkleTrigger, setSparkleTrigger] = useState(0);
  const [sparkleEmoji, setSparkleEmoji] = useState('✨');

  const happyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const petRef = useRef<View>(null);
  const petBounds = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Guard: play happy.mp3 only once when clean first reaches 100
  const happyAt100Played = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    return () => { if (happyTimer.current) clearTimeout(happyTimer.current); };
  }, [fadeIn]);

  // Detect clean hitting 100
  useEffect(() => {
    if (clean >= 100 && !happyAt100Played.current) {
      happyAt100Played.current = true;
      setShowCelebration(true);
      successHaptic();
      SoundManager.playHappy(() => {
        setShowCelebration(false);
      });
    }
    if (clean < 100) happyAt100Played.current = false;
  }, [clean]);

  const onPetLayout = useCallback(() => {
    petRef.current?.measureInWindow((x, y, w, h) => {
      petBounds.current = { x, y, w, h };
    });
  }, []);

  const handleDropOnPet = useCallback(
    (dropX: number, dropY: number, amount: number, effect: string, sound: 'soap' | 'towel'): boolean => {
      const { x, y, w, h } = petBounds.current;
      const pad = 35;
      const hit =
        dropX > x - pad && dropX < x + w + pad &&
        dropY > y - pad && dropY < y + h + pad;

      if (hit) {
        if (happyTimer.current) clearTimeout(happyTimer.current);
        // Play per-item sound
        if (sound === 'soap') SoundManager.playSoapShampoo();
        else SoundManager.playTowel();
        lightHaptic();

        dispatch(cleanPet());
        setIsHappy(true);
        setSparkleEmoji(effect);
        setRewardTrigger(t => t + 1);
        setSparkleTrigger(t => t + 1);
        happyTimer.current = setTimeout(() => setIsHappy(false), 1800);
      }
      return hit;
    },
    [dispatch],
  );

  const statusText =
    clean >= 80 ? '✨ Squeaky clean!' :
      clean >= 50 ? '💧 Needs a wash!' :
        '😅 Urgently dirty!';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <RoomBackground room="bathroom">
        <Animated.View style={[styles.inner, { opacity: fadeIn }]}>

          {/* ── Top bar ─────────────────────────────────────── */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => {
                SoundManager.stopAll();
                onNavigate('Home');
              }}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.backText}>← Home</Text>
            </Pressable>
            <View style={styles.hud}>
              <MiniStatBar icon="🧼" value={clean} color="#42A5F5" />
            </View>
          </View>

          {/* ── Pet ─────────────────────────────────────────── */}
          <View style={styles.petArea}>
            <View ref={petRef} onLayout={onPetLayout} style={styles.petWrapper}>
              <FloatingReward text="+10 Clean" color="#42A5F5" trigger={rewardTrigger} />
              <SparkleEffect trigger={sparkleTrigger} effect={sparkleEmoji} />
              <PetDisplay size={300} isHappy={isHappy || showCelebration} />
            </View>
          </View>

          {/* ── Status ──────────────────────────────────────── */}
          <View style={styles.statusWrap}>
            <Text style={styles.statusText}>
              {isHappy ? '🎉 So fresh!' : statusText}
            </Text>
          </View>

          {/* ── Instruction ─────────────────────────────────── */}
          <View style={styles.instructionWrap}>
            <Text style={styles.instruction}>
              {isHappy ? '🧼 All clean!' : '🛁  Drag items onto your pet!'}
            </Text>
          </View>

          {/* ── Draggable bath items ─────────────────────────── */}
          <View style={styles.itemRow}>
            {BATH_ITEMS.map(item => (
              <DraggableBathItem
                key={item.id}
                emoji={item.emoji}
                name={item.name}
                color={item.color}
                shade={item.shade}
                onDropOnPet={(x, y) => handleDropOnPet(x, y, item.amount, item.effect, item.sound)}
              />
            ))}
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
    paddingTop: 30,
  },
  backBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.91)',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  backText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  hud: {
    backgroundColor: 'rgba(0, 0, 0, 0.93)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 180,
  },

  petArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  petWrapper: { alignItems: 'center' },

  statusWrap: { alignItems: 'center', marginTop: 6 },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.32)',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 10,
  },

  instructionWrap: { alignItems: 'center', marginTop: 6, marginBottom: 4 },
  instruction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 10,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 12,
    paddingBottom: 22,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
    overflow: 'visible',
  },
  bathCard: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 88,
    borderBottomWidth: 4,
    elevation: 8,
  },
  bathEmoji: { fontSize: 32, marginBottom: 3 },
  bathLabel: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
