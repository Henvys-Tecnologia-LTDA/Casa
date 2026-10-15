import { Easing, FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown, ZoomIn } from 'react-native-reanimated';

// Movimento do app: curto e sem quique. Tudo desacelera até parar no lugar, sem passar do ponto.
// Só tempo + curva, nada de mola: no Reanimated 4 a mola padrão tem massa 4 e rigidez 900, então um
// `springify().damping(10)` pensado para a mola antiga vira um quique enorme no celular (no navegador
// a mola é aproximada por CSS e quase não aparece).

// Curvas em bézier (ease-out e ease-in cúbicos): o navegador só entende curvas assim; Easing.out(...)
// lá vira linear.
export const EASE = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_IN = Easing.bezier(0.32, 0, 0.67, 0);
export const DUR = { fast: 140, base: 200, slow: 280 };

/** Config de withTiming no padrão do app. */
export const ease = (duration = DUR.base) => ({ duration, easing: EASE });

const rise = (px: number): { transform: [{ translateY: number }] } => ({ transform: [{ translateY: px }] });

// Seções da tela: sobem um pouco e aparecem, uma logo depois da outra.
export const sectionIn = (i: number) =>
  FadeInDown.duration(DUR.slow).delay(Math.min(i, 6) * 40).easing(EASE).withInitialValues(rise(12));
export const fabIn = FadeInDown.duration(DUR.base).delay(120).easing(EASE).withInitialValues(rise(12));

// Janelas: o fundo escurece e a janela sobe até encostar embaixo, sem passar.
export const backdropIn = FadeIn.duration(DUR.base);
export const backdropOut = FadeOut.duration(DUR.fast);
export const sheetIn = SlideInDown.duration(DUR.slow).easing(EASE);
export const sheetOut = SlideOutDown.duration(DUR.base).easing(EASE_IN);
export const dialogIn = FadeInDown.duration(DUR.base).easing(EASE).withInitialValues(rise(8));
export const dialogOut = FadeOut.duration(DUR.fast);

// Visto do checkbox.
export const checkIn = ZoomIn.duration(DUR.fast).easing(EASE).withInitialValues({ transform: [{ scale: 0.5 }] });
