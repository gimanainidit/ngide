import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { shieldStripe } from '../theme/tokens';

const STOPS = [0, 0.28, 0.55, 0.78, 1];

// Penanda brand: pita gradasi perisai (navy → indigo → biru → biru perisai → tint).
export function ShieldStripe({ height = 4 }: { height?: number }) {
  return (
    <Svg width="100%" height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="ngide-stripe" x1="0" y1="0" x2="1" y2="0">
          {shieldStripe.map((color, i) => (
            <Stop key={color} offset={STOPS[i]} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill="url(#ngide-stripe)" />
    </Svg>
  );
}
