/**
 * FeedScreen
 *
 * Kitchen background. Three draggable food items at the bottom.
 * Drag food onto the pet to feed it:
 *   - Pet shows happy sprite briefly
 *   - "+X Hunger" floats upward + heart burst
 *   - eat.mp3 plays on successful drop
 *   - happy.mp3 plays once when hunger first reaches 100
 * Drop anywhere else → food springs back to origin.
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
import { feedPet, selectHunger } from '../redux/petSlice';
import SoundManager from '../utils/SoundManager';
import { mediumHaptic, lightHaptic, successHaptic } from '../utils/Haptics';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FOODS = [
  { id: 'burger', emoji: '🍔', name: 'Burger', amount: 10, color: '#E65100', shade: '#BF360C' },
  { id: 'apple', emoji: '🍎', name: 'Apple', amount: 10, color: '#C62828', shade: '#B71C1C' },
  { id: 'cake', emoji: '🎂', name: 'Cake', amount: 15, color: '#AD1457', shade: '#880E4F' },
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
// HeartEffect — bursts outward on successful feed
// ---------------------------------------------------------------------------

function HeartEffect({ trigger }: { trigger: number }) {
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
      ❤️💖❤️
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// DraggableFood
// ---------------------------------------------------------------------------

interface DraggableFoodProps {
  emoji: string;
  name: string;
  color: string;
  shade: string;
  onDropOnPet: (x: number, y: number) => boolean;
}

function DraggableFood({ emoji, name, color, shade, onDropOnPet }: DraggableFoodProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const onDropRef = useRef(onDropOnPet);
  useEffect(() => { onDropRef.current = onDropOnPet; }, [onDropOnPet]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.stopAnimation();
        pan.setValue({ x: 0, y: 0 });
        Animated.spring(cardScale, { toValue: 1.25, useNativeDriver: true }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, g) => {
        Animated.spring(cardScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
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
          styles.foodCard,
          { backgroundColor: color, borderBottomColor: shade },
          { transform: [{ scale: cardScale }] },
        ]}
      >
        <Text style={styles.foodEmoji}>{emoji}</Text>
        <Text style={styles.foodLabel}>{name}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// FeedScreen
// ---------------------------------------------------------------------------

interface FeedScreenProps {
  onNavigate: (screen: ScreenName) => void;
}

export default function FeedScreen({ onNavigate }: FeedScreenProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const hunger = useAppSelector(selectHunger);

  const [isHappy, setIsHappy] = useState(false);
  const [rewardTrigger, setRewardTrigger] = useState(0);
  const [rewardText, setRewardText] = useState('+10 Hunger');

  const eatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const petRef = useRef<View>(null);
  const petBounds = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Guard: play happy.mp3 only once when hunger first reaches 100
  const happyAt100Played = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    return () => { if (eatTimer.current) clearTimeout(eatTimer.current); };
  }, [fadeIn]);

  // Detect hunger hitting 100 after feeding
  useEffect(() => {
    if (hunger >= 100 && !happyAt100Played.current) {
      happyAt100Played.current = true;
      setShowCelebration(true);
      successHaptic();
      SoundManager.playHappy(() => {
        setShowCelebration(false);
      });
    }
    if (hunger < 100) happyAt100Played.current = false; // reset guard
  }, [hunger]);

  const onPetLayout = useCallback(() => {
    petRef.current?.measureInWindow((x, y, w, h) => {
      petBounds.current = { x, y, w, h };
    });
  }, []);

  const handleDropOnPet = useCallback(
    (dropX: number, dropY: number, amount: number): boolean => {
      const { x, y, w, h } = petBounds.current;
      const pad = 35;
      const hit =
        dropX > x - pad && dropX < x + w + pad &&
        dropY > y - pad && dropY < y + h + pad;

      if (hit) {
        if (eatTimer.current) clearTimeout(eatTimer.current);
        SoundManager.playEat();
        lightHaptic();
        dispatch(feedPet({ amount }));
        setIsHappy(true);
        setRewardText(`+${amount} Hunger`);
        setRewardTrigger(t => t + 1);
        eatTimer.current = setTimeout(() => setIsHappy(false), 1500);
      }
      return hit;
    },
    [dispatch],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <RoomBackground room="kitchen">
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
              <MiniStatBar icon="🍔" value={hunger} color="#FF7043" />
            </View>
          </View>

          {/* ── Pet ─────────────────────────────────────────── */}
          <View style={styles.petArea}>
            <View ref={petRef} onLayout={onPetLayout} style={styles.petWrapper}>
              <FloatingReward text={rewardText} color="#FF7043" trigger={rewardTrigger} />
              <HeartEffect trigger={rewardTrigger} />
              <PetDisplay size={300} isHappy={isHappy || showCelebration} />
            </View>
          </View>

          {/* ── Instruction ─────────────────────────────────── */}
          <View style={styles.instructionWrap}>
            <Text style={styles.instruction}>
              {isHappy ? '😋 Nom nom nom!' : '🍽️  Drag food onto your pet!'}
            </Text>
          </View>

          {/* ── Draggable food items ─────────────────────────── */}
          <View style={styles.foodRow}>
            {FOODS.map(f => (
              <DraggableFood
                key={f.id}
                emoji={f.emoji}
                name={f.name}
                color={f.color}
                shade={f.shade}
                onDropOnPet={(x, y) => handleDropOnPet(x, y, f.amount)}
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
    paddingHorizontal: 10,
    paddingTop: 25,
  },
  backBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.91)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  hud: {
    backgroundColor: 'rgba(0, 0, 0, 0.91)',
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

  instructionWrap: { alignItems: 'center', marginVertical: 8 },
  instruction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 10,
  },

  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 12,
    paddingBottom: 22,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
    overflow: 'visible',
  },
  foodCard: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 88,
    borderBottomWidth: 4,
    elevation: 8,
  },
  foodEmoji: { fontSize: 32, marginBottom: 3 },
  foodLabel: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
