import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EMOJIS = ['❤️', '🌸', '✨', '⭐'];

interface ParticleData {
  id: number;
  emoji: string;
  x: number;
  yAnim: Animated.Value;
  xAnim: Animated.Value;
  rotAnim: Animated.Value;
  scaleAnim: Animated.Value;
}

export function CelebrationRain({ active }: { active: boolean }): React.JSX.Element | null {
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const idCounter = useRef(0);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const interval = setInterval(() => {
      if (!activeRef.current) return;

      const id = idCounter.current++;
      const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const startX = Math.random() * SCREEN_WIDTH;
      const yAnim = new Animated.Value(-50);
      const xAnim = new Animated.Value(0);
      const rotAnim = new Animated.Value(0);
      const scaleAnim = new Animated.Value(0.5 + Math.random() * 0.8);

      const newParticle: ParticleData = {
        id,
        emoji,
        x: startX,
        yAnim,
        xAnim,
        rotAnim,
        scaleAnim,
      };

      setParticles((prev) => [...prev, newParticle]);

      Animated.parallel([
        Animated.timing(yAnim, {
          toValue: SCREEN_HEIGHT + 50,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(xAnim, {
          toValue: (Math.random() - 0.5) * 80,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(rotAnim, {
          toValue: (Math.random() - 0.5) * 360,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      });
    }, 150);

    return () => clearInterval(interval);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => {
        const rotate = p.rotAnim.interpolate({
          inputRange: [-360, 360],
          outputRange: ['-360deg', '360deg'],
        });

        return (
          <Animated.Text
            key={p.id}
            style={[
              styles.particle,
              {
                left: p.x,
                transform: [
                  { translateY: p.yAnim },
                  { translateX: p.xAnim },
                  { rotate },
                  { scale: p.scaleAnim },
                ],
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    fontSize: 24,
    zIndex: 999,
  },
});

export default CelebrationRain;
