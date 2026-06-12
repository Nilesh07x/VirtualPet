/**
 * AppNavigator
 *
 * Custom screen switcher. Transition: pure crossfade (no slide) so there is
 * never a white flash between screens. The root background is black so any
 * brief opacity gap shows dark, not white.
 *
 * Also hosts:
 *  - Asset preload effect so all images are warm-cached once.
 *  - SoundManager.init() so all sounds are loaded before first interaction.
 *  - Mute state sync: whenever Redux isMuted changes, SoundManager is updated.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import { usePetDecay, useAppSelector } from '../hooks';
import { selectIsMuted } from '../redux/settingsSlice';
import CleanScreen from '../screens/CleanScreen';
import FeedScreen from '../screens/FeedScreen';
import HomeScreen from '../screens/HomeScreen';
import SleepScreen from '../screens/SleepScreen';
import SoundManager from '../utils/SoundManager';

// ---------------------------------------------------------------------------
// Asset preloading — require() at module level caches them in the bundle.
// Explicit prefetch warms the native image decoder before first render.
// ---------------------------------------------------------------------------
const PRELOAD_IMAGES = [
  require('../assets/backgrounds/home_bg.png'),
  require('../assets/backgrounds/kitchen_bg.png'),
  require('../assets/backgrounds/bathroom_bg.png'),
  require('../assets/backgrounds/bedroom_bg.png'),
  require('../assets/pets/pet_neutral.png'),
  require('../assets/pets/pet_happy.png'),
  require('../assets/pets/pet_sad.png'),
  require('../assets/pets/pet_eating.png'),
  require('../assets/pets/pet_sleeping.png'),
  require('../assets/pets/pet_max_happy.png'),
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScreenName = 'Home' | 'Feed' | 'Clean' | 'Sleep';

// ---------------------------------------------------------------------------
// Navigator
// ---------------------------------------------------------------------------

export function AppNavigator(): React.JSX.Element {
  usePetDecay();

  const [screen, setScreen] = useState<ScreenName>('Home');
  const [ready, setReady] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // Keep SoundManager in sync with Redux mute state
  const isMuted = useAppSelector(selectIsMuted);
  useEffect(() => {
    SoundManager.setMuted(isMuted);
  }, [isMuted]);

  // ── Preload all assets + init sounds on first mount ───────────────────────
  useEffect(() => {
    // Initialise sounds immediately (non-blocking)
    SoundManager.init();

    const prefetches = PRELOAD_IMAGES.map((src) => {
      const uri = Image.resolveAssetSource(src).uri;
      return Image.prefetch(uri).catch(() => {/* ignore errors */ });
    });
    Promise.all(prefetches).finally(() => {
      setReady(true);
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigate with pure crossfade ─────────────────────────────────────────
  const navigateTo = useCallback(
    (next: ScreenName) => {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setScreen(next);
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    },
    [fade],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const renderScreen = (): React.JSX.Element => {
    switch (screen) {
      case 'Feed': return <FeedScreen onNavigate={navigateTo} />;
      case 'Clean': return <CleanScreen onNavigate={navigateTo} />;
      case 'Sleep': return <SleepScreen onNavigate={navigateTo} />;
      default: return <HomeScreen onNavigate={navigateTo} />;
    }
  };

  return (
    <View style={styles.root}>
      {/* Dark backdrop prevents white flash during transitions */}
      <View style={styles.backdrop} />
      <Animated.View style={[styles.screen, { opacity: ready ? fade : 0 }]}>
        {renderScreen()}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#111' },
  screen: { flex: 1 },
});

export default AppNavigator;
