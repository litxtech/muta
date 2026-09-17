/**
 * AnimatedNumber — reusable count-up motoru.
 * Kullanıcı dokunarak skip edebilir; skip'te final değer anında gösterilir.
 */

import React, {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, Text, type StyleProp, type TextStyle } from 'react-native';

export type AnimatedNumberHandle = {
  /** Count-up'ı bitir; final değeri anında göster */
  skip(): void;
};

type Props = {
  value: number;
  durationMs: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
  onDone?: () => void;
  skipOnPress?: boolean;
};

const TICK_MS = 20;

function AnimatedNumberInner(
  { value, durationMs, style, prefix = '', suffix = '', onDone, skipOnPress = true }: Props,
  ref: React.Ref<AnimatedNumberHandle>,
) {
  const [shown, setShown] = useState(0);
  const doneRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setShown(value);
    onDoneRef.current?.();
  };

  useImperativeHandle(ref, () => ({ skip: finish }));

  useEffect(() => {
    doneRef.current = false;
    setShown(0);
    if (value <= 0 || durationMs <= TICK_MS) {
      finish();
      return;
    }
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 2);
      setShown(Math.floor(value * eased));
      if (t >= 1) finish();
    }, TICK_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  const content = (
    <Text style={style}>
      {prefix}
      {Math.floor(shown).toLocaleString('tr-TR')}
      {suffix}
    </Text>
  );

  if (!skipOnPress) return content;
  return <Pressable onPress={finish}>{content}</Pressable>;
}

export const AnimatedNumber = memo(forwardRef(AnimatedNumberInner));
