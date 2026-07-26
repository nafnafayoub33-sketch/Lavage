/**
 * src/ui/theme.ts
 * One design, two schemes. The user picks: system / light / dark.
 * No screen may hardcode a color, a font size or a spacing value.
 */
import type { TextStyle } from 'react-native';

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

const dark = {
  bg: '#0B0C0E',
  surface: '#141619',
  raised: '#1B1E22',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',

  text: '#F5F6F7',
  textMuted: '#9AA3AB',
  textFaint: '#616A72',

  /** primary button: the text colour, inverted */
  primary: '#F5F6F7',
  onPrimary: '#0B0C0E',

  ok: '#3FB27F',
  warn: '#E0A93A',
  bad: '#E0574A',
} as const;

const light = {
  bg: '#FFFFFF',
  surface: '#FAFAFB',
  raised: '#F1F2F4',
  line: 'rgba(11,12,14,0.10)',
  lineStrong: 'rgba(11,12,14,0.20)',

  text: '#0B0C0E',
  textMuted: '#5F6B73',
  textFaint: '#8B959C',

  primary: '#0B0C0E',
  onPrimary: '#FFFFFF',

  /** darkened so contrast holds on white */
  ok: '#1F9D6B',
  warn: '#B77A0B',
  bad: '#C93B2F',
} as const;

export type ColorScheme = 'light' | 'dark';
/**
 * `dark` fixes the key set; the values are plain strings so `light` — which
 * holds different literals — is assignable to the same type.
 */
export type Colors = Readonly<Record<keyof typeof dark, string>>;

export const schemes: Record<ColorScheme, Colors> = { dark, light };

/** Queue state is product logic — never pick these colours by hand in a screen. */
export const queueColor = (c: Colors) => ({
  free: c.ok,   // wait < 15 min
  busy: c.warn, // 15-40 min
  full: c.bad,  // > 40 min or closed
});

export type QueueState = keyof ReturnType<typeof queueColor>;

/* ------------------------------------------------------------------ */
/* Type — one family, three languages                                  */
/* ------------------------------------------------------------------ */
/** npx expo install @expo-google-fonts/ibm-plex-sans-arabic */
export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const type = {
  ticket:   { fontFamily: fonts.semibold, fontSize: 64, lineHeight: 66, letterSpacing: -2 },
  counter:  { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28 },
  title:    { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 28 },
  subtitle: { fontFamily: fonts.medium,   fontSize: 15, lineHeight: 22 },
  body:     { fontFamily: fonts.regular,  fontSize: 14, lineHeight: 22 },
  label:    { fontFamily: fonts.regular,  fontSize: 13, lineHeight: 20 },
  caption:  { fontFamily: fonts.regular,  fontSize: 12, lineHeight: 18 },
} as const;

/** every number keeps latin digits, tabular, LTR — in all three languages */
export const numeric: TextStyle = {
  fontVariant: ['tabular-nums'],
  writingDirection: 'ltr',
};

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32, xxxl: 46 } as const;
export const radii = { sm: 8, md: 10, lg: 12, xl: 20, pill: 999 } as const;

/** owners tap these with wet hands */
export const hitSize = { min: 48, primary: 52 } as const;

/**
 * Motion budget — four cases, nothing else.
 *  press   : every tappable
 *  advance : the queue track, only when the position really changes
 *  enter   : list rows, once
 *  soon    : the amber ring, only at "you are next"
 */
export const motion = {
  press: { duration: 120, scale: 0.985 },
  advance: { duration: 1100 },
  enter: { duration: 450, stagger: 70, offsetY: 10 },
  soon: { duration: 2200 },
  easing: [0.22, 0.61, 0.36, 1] as const,
} as const;

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */
/**
 * usage:
 *   const { c, scheme } = useTheme();
 *   <View style={{ backgroundColor: c.bg }} />
 *
 * The stored preference wins over the system setting:
 *   'system' | 'light' | 'dark'  ->  AsyncStorage key 'app.scheme'
 */
export type SchemePreference = ColorScheme | 'system';

export function resolveScheme(pref: SchemePreference, system: ColorScheme | null): ColorScheme {
  if (pref === 'system') return system ?? 'dark';
  return pref;
}

export const theme = {
  schemes, queueColor, fonts, type, numeric, spacing, radii, hitSize, motion,
} as const;

export default theme;
