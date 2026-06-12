import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
} from 'react-native';

export type RoomType =
  | 'living'
  | 'kitchen'
  | 'bathroom'
  | 'bedroom';

interface RoomBackgroundProps {
  room: RoomType;
  children: React.ReactNode;
}

const backgrounds = {
  living: require('../assets/backgrounds/home_bg.png'),
  kitchen: require('../assets/backgrounds/kitchen_bg.png'),
  bathroom: require('../assets/backgrounds/bathroom_bg.png'),
  bedroom: require('../assets/backgrounds/bedroom_bg.png'),
};

export function RoomBackground({
  room,
  children,
}: RoomBackgroundProps): React.JSX.Element {
  return (
    <ImageBackground
      source={backgrounds[room]}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        {children}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  overlay: {
    flex: 1,
  },
});

export default RoomBackground;