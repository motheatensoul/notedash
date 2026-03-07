/**
 * CSS custom property overrides for a full-palette theme.
 * Keys are CSS variable names without the `--` prefix.
 * All values should be valid CSS color expressions (preferably OKLCH).
 */
export interface PaletteThemeVars {
  background?: string;
  foreground?: string;
  card?: string;
  'card-foreground'?: string;
  popover?: string;
  'popover-foreground'?: string;
  primary?: string;
  'primary-foreground'?: string;
  secondary?: string;
  'secondary-foreground'?: string;
  muted?: string;
  'muted-foreground'?: string;
  accent?: string;
  'accent-foreground'?: string;
  destructive?: string;
  border?: string;
  input?: string;
  ring?: string;
  'nd-bg-1'?: string;
  'nd-bg-2'?: string;
}

/**
 * Describes a full-palette color theme entry in the registry.
 */
export interface PaletteTheme {
  /** Display label shown in the appearance settings UI. */
  label: string;
  /** Short description shown below the selector. */
  description: string;
  /**
   * Palette rendering mode:
   * - `'dark'`: Always-dark palette, ignores system light/dark mode.
   * - `'light'`: Always-light palette, ignores system light/dark mode.
   * - `'auto'`: Accent-only tint that respects system mode (reserved for future use).
   */
  mode: 'dark' | 'light' | 'auto';
  /** Map of CSS variable names (without `--`) to their replacement values. */
  vars: PaletteThemeVars;
}

/**
 * Registry of all built-in full-palette themes.
 *
 * To add a new palette: insert a new key/value pair here.
 * No other files need to change.
 *
 * OKLCH values are derived from official hex specifications for each theme.
 */
export const PALETTE_THEMES: Record<string, PaletteTheme> = {
  'catppuccin-latte': {
    label: 'Catppuccin Latte',
    description: 'Warm, soothing light theme with pastel accents.',
    mode: 'light',
    vars: {
      background: 'oklch(0.961 0.007 286)',       // #eff1f5 base
      foreground: 'oklch(0.298 0.024 264)',        // #4c4f69 text
      card: 'oklch(0.944 0.008 272)',              // #e6e9ef mantle
      'card-foreground': 'oklch(0.298 0.024 264)',
      popover: 'oklch(0.930 0.009 258)',           // #dce0e8 crust
      'popover-foreground': 'oklch(0.298 0.024 264)',
      primary: 'oklch(0.570 0.135 258)',           // #1e66f5 blue
      'primary-foreground': 'oklch(0.961 0.007 286)',
      secondary: 'oklch(0.944 0.008 272)',
      'secondary-foreground': 'oklch(0.298 0.024 264)',
      muted: 'oklch(0.930 0.009 258)',
      'muted-foreground': 'oklch(0.491 0.020 264)', // #6c6f85 subtext0
      accent: 'oklch(0.578 0.152 326)',             // #ea76cb pink
      'accent-foreground': 'oklch(0.961 0.007 286)',
      destructive: 'oklch(0.590 0.212 22)',         // #d20f39 red
      border: 'oklch(0.875 0.013 274)',             // #ccd0da surface2
      input: 'oklch(0.875 0.013 274)',
      ring: 'oklch(0.570 0.135 258)',
      'nd-bg-1': 'oklch(0.930 0.009 258)',
      'nd-bg-2': 'oklch(0.944 0.008 272)'
    }
  },

  'catppuccin-frappe': {
    label: 'Catppuccin Frappé',
    description: 'Muted dark theme with cool blue-grey tones.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.291 0.018 266)',        // #303446 base
      foreground: 'oklch(0.864 0.011 263)',        // #c6d0f5 text
      card: 'oklch(0.268 0.017 268)',              // #292c3c mantle
      'card-foreground': 'oklch(0.864 0.011 263)',
      popover: 'oklch(0.248 0.015 266)',           // #232634 crust
      'popover-foreground': 'oklch(0.864 0.011 263)',
      primary: 'oklch(0.681 0.127 262)',           // #8caaee blue
      'primary-foreground': 'oklch(0.248 0.015 266)',
      secondary: 'oklch(0.350 0.020 266)',         // #414559 surface1
      'secondary-foreground': 'oklch(0.864 0.011 263)',
      muted: 'oklch(0.320 0.019 267)',             // #3b3f52 surface0
      'muted-foreground': 'oklch(0.720 0.018 264)', // #a5adce subtext1
      accent: 'oklch(0.700 0.140 334)',            // #f4b8e4 pink
      'accent-foreground': 'oklch(0.248 0.015 266)',
      destructive: 'oklch(0.647 0.210 22)',        // #e78284 red
      border: 'oklch(0.380 0.021 264)',            // #51576d surface2
      input: 'oklch(0.380 0.021 264)',
      ring: 'oklch(0.681 0.127 262)',
      'nd-bg-1': 'oklch(0.248 0.015 266)',
      'nd-bg-2': 'oklch(0.268 0.017 268)'
    }
  },

  'catppuccin-macchiato': {
    label: 'Catppuccin Macchiato',
    description: 'Rich dark theme with deep ocean tones.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.260 0.022 260)',        // #24273a base
      foreground: 'oklch(0.864 0.013 257)',        // #cad3f5 text
      card: 'oklch(0.238 0.020 261)',              // #1e2030 mantle
      'card-foreground': 'oklch(0.864 0.013 257)',
      popover: 'oklch(0.219 0.018 261)',           // #181926 crust
      'popover-foreground': 'oklch(0.864 0.013 257)',
      primary: 'oklch(0.671 0.124 258)',           // #8aadf4 blue
      'primary-foreground': 'oklch(0.219 0.018 261)',
      secondary: 'oklch(0.316 0.023 261)',         // #363a4f surface1
      'secondary-foreground': 'oklch(0.864 0.013 257)',
      muted: 'oklch(0.290 0.021 261)',             // #2f3347 surface0
      'muted-foreground': 'oklch(0.719 0.019 259)', // #a5adcb subtext1
      accent: 'oklch(0.696 0.138 334)',            // #f5bde6 pink
      'accent-foreground': 'oklch(0.219 0.018 261)',
      destructive: 'oklch(0.647 0.210 22)',        // #ed8796 red
      border: 'oklch(0.357 0.024 260)',            // #494d64 surface2
      input: 'oklch(0.357 0.024 260)',
      ring: 'oklch(0.671 0.124 258)',
      'nd-bg-1': 'oklch(0.219 0.018 261)',
      'nd-bg-2': 'oklch(0.238 0.020 261)'
    }
  },

  'catppuccin-mocha': {
    label: 'Catppuccin Mocha',
    description: 'Deep, cozy dark theme — the most popular Catppuccin flavour.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.238 0.018 264)',        // #1e1e2e base
      foreground: 'oklch(0.864 0.014 256)',        // #cdd6f4 text
      card: 'oklch(0.218 0.017 265)',              // #181825 mantle
      'card-foreground': 'oklch(0.864 0.014 256)',
      popover: 'oklch(0.200 0.015 265)',           // #11111b crust
      'popover-foreground': 'oklch(0.864 0.014 256)',
      primary: 'oklch(0.669 0.122 256)',           // #89b4fa blue
      'primary-foreground': 'oklch(0.200 0.015 265)',
      secondary: 'oklch(0.299 0.020 264)',         // #313244 surface1
      'secondary-foreground': 'oklch(0.864 0.014 256)',
      muted: 'oklch(0.270 0.018 264)',             // #27273f surface0 (approx)
      'muted-foreground': 'oklch(0.718 0.020 256)', // #a6adc8 subtext1
      accent: 'oklch(0.693 0.138 332)',            // #f5c2e7 pink
      'accent-foreground': 'oklch(0.200 0.015 265)',
      destructive: 'oklch(0.647 0.210 22)',        // #f38ba8 red
      border: 'oklch(0.350 0.022 263)',            // #45475a surface2
      input: 'oklch(0.350 0.022 263)',
      ring: 'oklch(0.669 0.122 256)',
      'nd-bg-1': 'oklch(0.200 0.015 265)',
      'nd-bg-2': 'oklch(0.218 0.017 265)'
    }
  },

  dracula: {
    label: 'Dracula',
    description: 'Classic dark purple vampire theme with vivid accents.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.255 0.024 267)',        // #282a36
      foreground: 'oklch(0.972 0.004 97)',         // #f8f8f2
      card: 'oklch(0.296 0.026 265)',              // #343746 (surface)
      'card-foreground': 'oklch(0.972 0.004 97)',
      popover: 'oklch(0.210 0.020 264)',           // #21222c
      'popover-foreground': 'oklch(0.972 0.004 97)',
      primary: 'oklch(0.726 0.163 291)',           // #bd93f9 purple
      'primary-foreground': 'oklch(0.255 0.024 267)',
      secondary: 'oklch(0.862 0.100 205)',         // #8be9fd cyan
      'secondary-foreground': 'oklch(0.255 0.024 267)',
      muted: 'oklch(0.366 0.028 264)',             // #44475a
      'muted-foreground': 'oklch(0.527 0.077 259)', // #6272a4
      accent: 'oklch(0.714 0.202 338)',            // #ff79c6 pink
      'accent-foreground': 'oklch(0.255 0.024 267)',
      destructive: 'oklch(0.649 0.213 22)',        // #ff5555
      border: 'oklch(0.366 0.028 264)',
      input: 'oklch(0.366 0.028 264)',
      ring: 'oklch(0.726 0.163 291)',
      'nd-bg-1': 'oklch(0.210 0.020 264)',
      'nd-bg-2': 'oklch(0.230 0.022 267)'
    }
  },

  nord: {
    label: 'Nord',
    description: 'Arctic, north-bluish clean design.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.272 0.020 251)',        // #2e3440 nord0
      foreground: 'oklch(0.894 0.013 263)',        // #d8dee9 nord4
      card: 'oklch(0.310 0.023 253)',              // #3b4252 nord1
      'card-foreground': 'oklch(0.894 0.013 263)',
      popover: 'oklch(0.272 0.020 251)',
      'popover-foreground': 'oklch(0.956 0.006 265)', // #eceff4 nord6
      primary: 'oklch(0.572 0.073 237)',           // #5e81ac nord10 deep blue
      'primary-foreground': 'oklch(0.956 0.006 265)',
      secondary: 'oklch(0.777 0.069 214)',         // #88c0d0 nord8 cyan
      'secondary-foreground': 'oklch(0.272 0.020 251)',
      muted: 'oklch(0.345 0.026 254)',             // #434c5e nord2
      'muted-foreground': 'oklch(0.654 0.044 253)', // #616e88 nord3 subtext
      accent: 'oklch(0.763 0.064 197)',            // #8fbcbb nord7 teal
      'accent-foreground': 'oklch(0.272 0.020 251)',
      destructive: 'oklch(0.553 0.110 12)',        // #bf616a nord11
      border: 'oklch(0.432 0.031 250)',            // #4c566a nord3
      input: 'oklch(0.432 0.031 250)',
      ring: 'oklch(0.777 0.069 214)',
      'nd-bg-1': 'oklch(0.251 0.018 251)',
      'nd-bg-2': 'oklch(0.225 0.016 254)'
    }
  },

  'one-dark': {
    label: 'One Dark',
    description: 'Atom One Dark — the iconic dark editor palette.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.280 0.018 264)',        // #282c34
      foreground: 'oklch(0.868 0.009 252)',        // #abb2bf
      card: 'oklch(0.258 0.016 265)',              // #21252b
      'card-foreground': 'oklch(0.868 0.009 252)',
      popover: 'oklch(0.237 0.014 264)',           // #1d2026 (darker)
      'popover-foreground': 'oklch(0.868 0.009 252)',
      primary: 'oklch(0.674 0.116 249)',           // #61afef blue
      'primary-foreground': 'oklch(0.237 0.014 264)',
      secondary: 'oklch(0.743 0.136 160)',         // #98c379 green
      'secondary-foreground': 'oklch(0.237 0.014 264)',
      muted: 'oklch(0.318 0.019 264)',             // #3e4452
      'muted-foreground': 'oklch(0.600 0.012 258)', // #5c6370 comment
      accent: 'oklch(0.727 0.152 332)',            // #c678dd purple
      'accent-foreground': 'oklch(0.237 0.014 264)',
      destructive: 'oklch(0.638 0.182 22)',        // #e06c75 red
      border: 'oklch(0.358 0.020 264)',            // #4b5263
      input: 'oklch(0.358 0.020 264)',
      ring: 'oklch(0.674 0.116 249)',
      'nd-bg-1': 'oklch(0.237 0.014 264)',
      'nd-bg-2': 'oklch(0.258 0.016 265)'
    }
  },

  'gruvbox-dark': {
    label: 'Gruvbox Dark',
    description: 'Retro groove — warm earthy tones with high contrast.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.195 0.003 285)',        // #282828 bg0
      foreground: 'oklch(0.891 0.040 87)',         // #ebdbb2 fg1
      card: 'oklch(0.265 0.010 60)',               // #3c3836 bg1
      'card-foreground': 'oklch(0.891 0.040 87)',
      popover: 'oklch(0.170 0.002 285)',           // #1d2021 bg0_hard
      'popover-foreground': 'oklch(0.891 0.040 87)',
      primary: 'oklch(0.644 0.057 193)',           // #83a598 blue
      'primary-foreground': 'oklch(0.195 0.003 285)',
      secondary: 'oklch(0.337 0.012 60)',          // #504945 bg2
      'secondary-foreground': 'oklch(0.891 0.040 87)',
      muted: 'oklch(0.265 0.010 60)',              // #3c3836 bg1
      'muted-foreground': 'oklch(0.668 0.022 80)', // #a89984 fg4
      accent: 'oklch(0.673 0.111 349)',            // #d3869b purple
      'accent-foreground': 'oklch(0.195 0.003 285)',
      destructive: 'oklch(0.633 0.198 25)',        // #fb4934 red
      border: 'oklch(0.408 0.015 60)',             // #665c54 bg3
      input: 'oklch(0.408 0.015 60)',
      ring: 'oklch(0.644 0.057 193)',
      'nd-bg-1': 'oklch(0.170 0.002 285)',
      'nd-bg-2': 'oklch(0.195 0.003 285)'
    }
  },

  'gruvbox-light': {
    label: 'Gruvbox Light',
    description: 'Retro groove light — warm parchment with earthy accents.',
    mode: 'light',
    vars: {
      background: 'oklch(0.958 0.060 91)',         // #fbf1c7 bg0
      foreground: 'oklch(0.265 0.010 60)',         // #3c3836 fg1
      card: 'oklch(0.891 0.040 87)',               // #ebdbb2 bg1
      'card-foreground': 'oklch(0.265 0.010 60)',
      popover: 'oklch(0.975 0.070 94)',            // #f9f5d7 bg0_hard
      'popover-foreground': 'oklch(0.265 0.010 60)',
      primary: 'oklch(0.526 0.070 207)',           // #458588 blue
      'primary-foreground': 'oklch(0.975 0.070 94)',
      secondary: 'oklch(0.800 0.036 83)',          // #d5c4a1 bg2
      'secondary-foreground': 'oklch(0.265 0.010 60)',
      muted: 'oklch(0.891 0.040 87)',              // #ebdbb2 bg1
      'muted-foreground': 'oklch(0.490 0.017 65)', // #7c6f64 fg4
      accent: 'oklch(0.549 0.116 349)',            // #b16286 purple
      'accent-foreground': 'oklch(0.975 0.070 94)',
      destructive: 'oklch(0.405 0.166 27)',        // #9d0006 red
      border: 'oklch(0.744 0.030 79)',             // #bdae93 bg3
      input: 'oklch(0.744 0.030 79)',
      ring: 'oklch(0.526 0.070 207)',
      'nd-bg-1': 'oklch(0.975 0.070 94)',
      'nd-bg-2': 'oklch(0.958 0.060 91)'
    }
  },

  'tokyo-night': {
    label: 'Tokyo Night',
    description: 'Neon-lit midnight city — vivid blue-purple dark theme.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.178 0.030 267)',        // #1a1b26
      foreground: 'oklch(0.738 0.038 263)',        // #a9b1d6
      card: 'oklch(0.157 0.025 265)',              // #16161e bg_dark
      'card-foreground': 'oklch(0.738 0.038 263)',
      popover: 'oklch(0.138 0.020 265)',           // #13131a
      'popover-foreground': 'oklch(0.738 0.038 263)',
      primary: 'oklch(0.680 0.139 261)',           // #7aa2f7 blue
      'primary-foreground': 'oklch(0.138 0.020 265)',
      secondary: 'oklch(0.218 0.037 265)',         // #292e42 bg_highlight
      'secondary-foreground': 'oklch(0.738 0.038 263)',
      muted: 'oklch(0.218 0.037 265)',             // #292e42
      'muted-foreground': 'oklch(0.534 0.033 264)', // #787c99
      accent: 'oklch(0.733 0.133 295)',            // #bb9af7 purple
      'accent-foreground': 'oklch(0.138 0.020 265)',
      destructive: 'oklch(0.710 0.157 9)',         // #f7768e red
      border: 'oklch(0.280 0.042 265)',            // #3d59a1 dark blue border
      input: 'oklch(0.280 0.042 265)',
      ring: 'oklch(0.680 0.139 261)',
      'nd-bg-1': 'oklch(0.138 0.020 265)',
      'nd-bg-2': 'oklch(0.157 0.025 265)'
    }
  },

  'rose-pine': {
    label: 'Rosé Pine',
    description: 'All natural pine, faux fur and a bit of soho vibes.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.171 0.024 305)',        // #191724 base
      foreground: 'oklch(0.909 0.021 293)',        // #e0def4 text
      card: 'oklch(0.190 0.031 302)',              // #1f1d2e surface
      'card-foreground': 'oklch(0.909 0.021 293)',
      popover: 'oklch(0.152 0.020 305)',           // #14121f darker
      'popover-foreground': 'oklch(0.909 0.021 293)',
      primary: 'oklch(0.490 0.083 215)',           // #31748f pine
      'primary-foreground': 'oklch(0.909 0.021 293)',
      secondary: 'oklch(0.216 0.040 300)',         // #26233a overlay
      'secondary-foreground': 'oklch(0.909 0.021 293)',
      muted: 'oklch(0.216 0.040 300)',             // #26233a overlay
      'muted-foreground': 'oklch(0.618 0.040 289)', // #908caa subtle
      accent: 'oklch(0.752 0.090 302)',            // #c4a7e7 iris
      'accent-foreground': 'oklch(0.171 0.024 305)',
      destructive: 'oklch(0.682 0.149 356)',       // #eb6f92 love
      border: 'oklch(0.320 0.045 298)',            // #403d52 highlight med
      input: 'oklch(0.320 0.045 298)',
      ring: 'oklch(0.490 0.083 215)',
      'nd-bg-1': 'oklch(0.152 0.020 305)',
      'nd-bg-2': 'oklch(0.171 0.024 305)'
    }
  },

  'rose-pine-dawn': {
    label: 'Rosé Pine Dawn',
    description: 'Rosé Pine in warm morning light.',
    mode: 'light',
    vars: {
      background: 'oklch(0.965 0.022 91)',         // #faf4ed base
      foreground: 'oklch(0.381 0.054 295)',        // #575279 text
      card: 'oklch(0.983 0.016 94)',               // #fffaf3 surface
      'card-foreground': 'oklch(0.381 0.054 295)',
      popover: 'oklch(0.983 0.016 94)',            // #fffaf3 surface
      'popover-foreground': 'oklch(0.381 0.054 295)',
      primary: 'oklch(0.452 0.083 216)',           // #286983 pine
      'primary-foreground': 'oklch(0.983 0.016 94)',
      secondary: 'oklch(0.934 0.024 79)',          // #f2e9de overlay
      'secondary-foreground': 'oklch(0.381 0.054 295)',
      muted: 'oklch(0.934 0.024 79)',              // #f2e9de overlay
      'muted-foreground': 'oklch(0.530 0.040 291)', // #797593 subtle
      accent: 'oklch(0.543 0.084 300)',            // #907aa9 iris
      'accent-foreground': 'oklch(0.983 0.016 94)',
      destructive: 'oklch(0.540 0.121 355)',       // #b4637a love
      border: 'oklch(0.878 0.030 83)',             // #dfdad9 highlight med
      input: 'oklch(0.878 0.030 83)',
      ring: 'oklch(0.452 0.083 216)',
      'nd-bg-1': 'oklch(0.983 0.016 94)',
      'nd-bg-2': 'oklch(0.965 0.022 91)'
    }
  },

  'solarized-dark': {
    label: 'Solarized Dark',
    description: 'Precision color palette — the original dark terminal classic.',
    mode: 'dark',
    vars: {
      background: 'oklch(0.216 0.053 222)',        // #002b36 base03
      foreground: 'oklch(0.605 0.027 218)',        // #839496 base0
      card: 'oklch(0.249 0.050 220)',              // #073642 base02
      'card-foreground': 'oklch(0.605 0.027 218)',
      popover: 'oklch(0.190 0.048 222)',           // #00212b darker
      'popover-foreground': 'oklch(0.652 0.022 209)', // #93a1a1 base1
      primary: 'oklch(0.563 0.143 248)',           // #268bd2 blue
      'primary-foreground': 'oklch(0.216 0.053 222)',
      secondary: 'oklch(0.290 0.052 221)',         // #0d3640
      'secondary-foreground': 'oklch(0.605 0.027 218)',
      muted: 'oklch(0.249 0.050 220)',             // #073642 base02
      'muted-foreground': 'oklch(0.465 0.040 217)', // #586e75 base01
      accent: 'oklch(0.619 0.103 195)',            // #2aa198 cyan
      'accent-foreground': 'oklch(0.216 0.053 222)',
      destructive: 'oklch(0.551 0.192 24)',        // #dc322f red
      border: 'oklch(0.310 0.052 220)',            // #0f3c48
      input: 'oklch(0.310 0.052 220)',
      ring: 'oklch(0.563 0.143 248)',
      'nd-bg-1': 'oklch(0.190 0.048 222)',
      'nd-bg-2': 'oklch(0.216 0.053 222)'
    }
  },

  'solarized-light': {
    label: 'Solarized Light',
    description: 'Precision color palette — crisp warm-white daylight mode.',
    mode: 'light',
    vars: {
      background: 'oklch(0.975 0.033 94)',         // #fdf6e3 base3
      foreground: 'oklch(0.510 0.038 218)',        // #657b83 base00
      card: 'oklch(0.928 0.027 90)',               // #eee8d5 base2
      'card-foreground': 'oklch(0.510 0.038 218)',
      popover: 'oklch(0.928 0.027 90)',            // #eee8d5 base2
      'popover-foreground': 'oklch(0.465 0.040 217)', // #586e75 base01
      primary: 'oklch(0.563 0.143 248)',           // #268bd2 blue
      'primary-foreground': 'oklch(0.975 0.033 94)',
      secondary: 'oklch(0.886 0.025 87)',          // #e5dfc8
      'secondary-foreground': 'oklch(0.510 0.038 218)',
      muted: 'oklch(0.928 0.027 90)',              // #eee8d5 base2
      'muted-foreground': 'oklch(0.652 0.022 209)', // #93a1a1 base1
      accent: 'oklch(0.619 0.103 195)',            // #2aa198 cyan
      'accent-foreground': 'oklch(0.975 0.033 94)',
      destructive: 'oklch(0.551 0.192 24)',        // #dc322f red
      border: 'oklch(0.868 0.024 87)',             // #ddd8c2
      input: 'oklch(0.868 0.024 87)',
      ring: 'oklch(0.563 0.143 248)',
      'nd-bg-1': 'oklch(0.928 0.027 90)',
      'nd-bg-2': 'oklch(0.975 0.033 94)'
    }
  }
};
