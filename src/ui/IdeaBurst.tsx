import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const PARTICLES = 24;
const DISTANCES = [84, 116, 150];

// "Ide meledak": cincin + partikel memancar sekali dari tombol rekam. `trigger` naik = mainkan lagi.
export function IdeaBurst({ trigger, size }: { trigger: number; size: number }) {
  const { c } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [groups] = useState(() => DISTANCES.map(() => new Animated.Value(0)));
  const [rings] = useState(() => [new Animated.Value(0), new Animated.Value(0)]);
  const colors = [c.shieldBlue, '#5aa9f5', '#e6f3fe', '#ffffff'];

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (trigger === 0 || reduceMotion) return;
    [...groups, ...rings].forEach((v) => v.setValue(0));
    Animated.parallel([
      ...groups.map((v, i) =>
        Animated.timing(v, { toValue: 1, duration: 900, delay: i * 45, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ),
      ...rings.map((v, i) =>
        Animated.timing(v, { toValue: 1, duration: 800, delay: i * 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ),
    ]).start();
  }, [trigger, reduceMotion, groups, rings]);

  if (trigger === 0 || reduceMotion) return null;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.origin}>
      {rings.map((v, i) => (
        <Animated.View
          key={`ring-${i}`}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              left: -size / 2,
              top: -size / 2,
              borderColor: i === 0 ? c.shieldBlue : '#5aa9f5',
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
            },
          ]}
        />
      ))}
      {Array.from({ length: PARTICLES }, (_, i) => {
        const group = i % 3;
        const progress = groups[group];
        const angle = ((i * 15 + (i % 2) * 7) * Math.PI) / 180;
        const dist = DISTANCES[group];
        const dot = 4 + (i % 4) * 2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: dot,
                height: dot,
                left: -dot / 2,
                top: -dot / 2,
                backgroundColor: colors[i % colors.length],
                opacity: progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
  ring: { position: 'absolute', borderRadius: 9999, borderWidth: 2 },
  dot: { position: 'absolute', borderRadius: 9999 },
});
