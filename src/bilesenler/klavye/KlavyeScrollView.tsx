import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  findNodeHandle,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ScrollViewProps,
  type StyleProp,
  type TextInputFocusEventData,
  type ViewStyle,
} from 'react-native';
import { useKlavyeYuksekligi } from './useKlavyeYuksekligi';
import { KlavyeUstY } from './KlavyeKonum';

type Props = ScrollViewProps & {
  ekstraPad?: number;
};

export type KlavyeScrollHandle = {
  scrollTo: ScrollView['scrollTo'];
  scrollToEnd: ScrollView['scrollToEnd'];
  getScrollY: () => number;
  getNode: () => ScrollView | null;
};

type Olculebilir = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

/**
 * Form ScrollView — klavye input’u örtmesin.
 * Her iki platformda da ölçülen klavye kadar alt boşluk + odak kaydırma.
 */
export const KlavyeScrollView = forwardRef<KlavyeScrollHandle, Props>(
  function KlavyeScrollView(
    { contentContainerStyle, ekstraPad = 40, style, onScroll, ...rest },
    ref,
  ) {
    const { yukseklik, acik } = useKlavyeYuksekligi(0);
    const icRef = useRef<ScrollView>(null);
    const scrollY = useRef(0);

    useImperativeHandle(ref, () => ({
      scrollTo: (opts) => icRef.current?.scrollTo(opts),
      scrollToEnd: (opts) => icRef.current?.scrollToEnd(opts),
      getScrollY: () => scrollY.current,
      getNode: () => icRef.current,
    }));

    const icerikStil = useMemo(() => {
      const flat = StyleSheet.flatten(contentContainerStyle) as
        | ViewStyle
        | undefined;
      const taban =
        typeof flat?.paddingBottom === 'number' ? flat.paddingBottom : 0;
      const ekstra =
        acik && yukseklik > 0 ? Math.max(ekstraPad, yukseklik + 12) : 0;
      return [
        contentContainerStyle,
        ekstra > 0 ? { paddingBottom: taban + ekstra } : null,
      ] as StyleProp<ViewStyle>;
    }, [acik, contentContainerStyle, ekstraPad, yukseklik]);

    const scrollIsler = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      },
      [onScroll],
    );

    return (
      <ScrollView
        ref={icRef}
        style={style}
        contentContainerStyle={icerikStil}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
        scrollEventThrottle={16}
        onScroll={scrollIsler}
        {...rest}
      />
    );
  },
);

type KaydirOpts = {
  animated?: boolean;
  delayMs?: number;
  /** Klavyenin üstünde bırakılacak boşluk */
  ustBosluk?: number;
  alan?: Olculebilir | null;
};

type ScrollLike = ScrollView | KlavyeScrollHandle | null | undefined;

function scrollYAl(scroll: ScrollLike): number {
  if (!scroll) return 0;
  if ('getScrollY' in scroll && typeof scroll.getScrollY === 'function') {
    return scroll.getScrollY();
  }
  return 0;
}

function scrollToY(scroll: ScrollLike, y: number, animated: boolean) {
  if (!scroll) return;
  scroll.scrollTo({ y: Math.max(0, y), animated });
}

/** Odaklı input’u klavyenin hemen üstüne getir */
export function KlavyeAlanaKaydir(scroll: ScrollLike, opts?: KaydirOpts) {
  if (!scroll) return;
  const delay = opts?.delayMs ?? (Platform.OS === 'ios' ? 60 : 100);
  const animated = opts?.animated !== false;
  const ustBosluk = opts?.ustBosluk ?? 36;

  const kaydir = () => {
    const alan = opts?.alan;
    const metrics = Keyboard.metrics();
    const etkinUst =
      metrics && metrics.screenY > 0 ? metrics.screenY : KlavyeUstY();

    if (alan?.measureInWindow) {
      alan.measureInWindow((_x, y, _w, h) => {
        const alanAlt = y + h;
        const hedefAlt = etkinUst - ustBosluk;
        const fazla = alanAlt - hedefAlt;
        if (fazla > 4) {
          scrollToY(scroll, scrollYAl(scroll) + fazla, animated);
        }
      });
      return;
    }

    scroll.scrollToEnd?.({ animated });
  };

  setTimeout(kaydir, delay);
  setTimeout(kaydir, delay + 140);
  setTimeout(kaydir, delay + 300);
}

/** TextInput onFocus → hedefi klavye üstüne kaydır */
export function KlavyeFocusKaydir(
  scroll: ScrollLike,
  e?: NativeSyntheticEvent<TextInputFocusEventData>,
  opts?: Omit<KaydirOpts, 'alan'>,
) {
  const nativeTarget = e?.nativeEvent?.target;
  let hedef: Olculebilir | null =
    (e?.target as unknown as Olculebilir) ?? null;

  if (
    (!hedef || typeof hedef.measureInWindow !== 'function') &&
    typeof nativeTarget === 'number'
  ) {
    hedef = {
      measureInWindow: (cb) => UIManager.measureInWindow(nativeTarget, cb),
    };
  }

  KlavyeAlanaKaydir(scroll, { ...opts, alan: hedef });
}

/** Ref ile TextInput — en güvenilir ölçüm */
export function KlavyeRefIleKaydir(
  scroll: ScrollLike,
  inputRef: React.RefObject<Olculebilir | null>,
  opts?: Omit<KaydirOpts, 'alan'>,
) {
  const node = inputRef.current;
  if (node && typeof node.measureInWindow === 'function') {
    KlavyeAlanaKaydir(scroll, { ...opts, alan: node });
    return;
  }
  const handle = findNodeHandle(node as never);
  if (handle != null) {
    KlavyeAlanaKaydir(scroll, {
      ...opts,
      alan: {
        measureInWindow: (cb) => UIManager.measureInWindow(handle, cb),
      },
    });
    return;
  }
  KlavyeAlanaKaydir(scroll, opts);
}
