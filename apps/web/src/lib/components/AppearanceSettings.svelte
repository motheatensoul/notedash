<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { PALETTE_THEMES } from '$lib/themes/registry';
  import type { AppearanceSettings, ThemeMode } from '$lib/settings/appearance-settings';

  interface AppearanceSettingsEvents {
    save: void;
    reset: void;
  }

  interface ThemeModeOption {
    value: ThemeMode;
    label: string;
    description: string;
  }

  interface AccentThemeOption {
    value: string;
    label: string;
    description: string;
  }

  const dispatch = createEventDispatcher<AppearanceSettingsEvents>();

  export let draft: AppearanceSettings;
  export let statusMessage = '';

  const themeModeOptions: ReadonlyArray<ThemeModeOption> = [
    {
      value: 'system',
      label: 'System',
      description: 'Follow your OS preference (uses portal detection on Linux desktop).'
    },
    {
      value: 'light',
      label: 'Light',
      description: 'Always use the light interface.'
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Always use the dark interface.'
    }
  ];

  const accentThemeOptions: ReadonlyArray<AccentThemeOption> = [
    {
      value: 'default',
      label: 'Default',
      description: 'Neutral slate accents for a balanced dashboard.'
    },
    {
      value: 'ocean',
      label: 'Ocean',
      description: 'Cool blue-cyan accents with crisp contrast.'
    },
    {
      value: 'forest',
      label: 'Forest',
      description: 'Calm green accents tuned for long sessions.'
    },
    {
      value: 'sunset',
      label: 'Sunset',
      description: 'Warm amber accents with energetic highlights.'
    }
  ];

  /** Palette themes grouped by family for the select UI. */
  const catppuccinPalettes = Object.entries(PALETTE_THEMES)
    .filter(([key]) => key.startsWith('catppuccin'))
    .sort(([a], [b]) => a.localeCompare(b));

  const gruvboxPalettes = Object.entries(PALETTE_THEMES)
    .filter(([key]) => key.startsWith('gruvbox'))
    .sort(([a], [b]) => a.localeCompare(b));

  const rosePinePalettes = Object.entries(PALETTE_THEMES)
    .filter(([key]) => key.startsWith('rose-pine'))
    .sort(([a], [b]) => a.localeCompare(b));

  const solarizedPalettes = Object.entries(PALETTE_THEMES)
    .filter(([key]) => key.startsWith('solarized'))
    .sort(([a], [b]) => a.localeCompare(b));

  const editorPalettes = Object.entries(PALETTE_THEMES)
    .filter(
      ([key]) =>
        !key.startsWith('catppuccin') &&
        !key.startsWith('gruvbox') &&
        !key.startsWith('rose-pine') &&
        !key.startsWith('solarized')
    )
    .sort(([a], [b]) => a.localeCompare(b));

  $: selectedThemeModeLabel =
    themeModeOptions.find((option) => option.value === draft.themeMode)?.label ?? 'System';

  $: selectedThemeModeDescription =
    themeModeOptions.find((option) => option.value === draft.themeMode)?.description ?? '';

  $: selectedColorThemeLabel = resolveColorThemeLabel(draft.colorTheme);

  $: selectedColorThemeDescription = resolveColorThemeDescription(draft.colorTheme);

  /**
   * Resolves the display label for the currently selected color theme.
   */
  function resolveColorThemeLabel(theme: string): string {
    const accent = accentThemeOptions.find((o) => o.value === theme);
    if (accent) return accent.label;
    if (theme in PALETTE_THEMES) return PALETTE_THEMES[theme].label;
    if (theme === 'custom') return 'Custom';
    return 'Default';
  }

  /**
   * Resolves the description for the currently selected color theme.
   */
  function resolveColorThemeDescription(theme: string): string {
    const accent = accentThemeOptions.find((o) => o.value === theme);
    if (accent) return accent.description;
    if (theme in PALETTE_THEMES) return PALETTE_THEMES[theme].description;
    if (theme === 'custom') return 'Paste a shadcn-svelte :root { ... } theme block below.';
    return '';
  }

  /**
   * Emits a save event for persisting appearance preferences.
   */
  function handleSave(): void {
    dispatch('save');
  }

  /**
   * Emits a reset event to restore saved appearance preferences in the draft.
   */
  function handleReset(): void {
    dispatch('reset');
  }
</script>

<Card.Root class="bg-card/95 shadow-sm backdrop-blur-sm">
  <Card.Header class="space-y-1 pb-3">
    <Card.Title class="text-base">Appearance</Card.Title>
    <Card.Description>
      Choose theme mode and color palette for the dashboard shell.
    </Card.Description>
  </Card.Header>

  <Card.Content class="space-y-4">
    <div class="space-y-2">
      <Label for="appearance-theme-mode">Theme mode</Label>
      <Select.Root type="single" bind:value={draft.themeMode}>
        <Select.Trigger id="appearance-theme-mode" class="w-full bg-background">
          {selectedThemeModeLabel}
        </Select.Trigger>
        <Select.Content>
          {#each themeModeOptions as option (option.value)}
            <Select.Item value={option.value} label={option.label} />
          {/each}
        </Select.Content>
      </Select.Root>
      <p class="text-xs text-muted-foreground">{selectedThemeModeDescription}</p>
    </div>

    <div class="space-y-2">
      <Label for="appearance-color-theme">Color theme</Label>
      <Select.Root type="single" bind:value={draft.colorTheme}>
        <Select.Trigger id="appearance-color-theme" class="w-full bg-background">
          {selectedColorThemeLabel}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            <Select.GroupHeading>Accent themes</Select.GroupHeading>
            {#each accentThemeOptions as option (option.value)}
              <Select.Item value={option.value} label={option.label} />
            {/each}
          </Select.Group>

          <Select.Separator />

          <Select.Group>
            <Select.GroupHeading>Catppuccin</Select.GroupHeading>
            {#each catppuccinPalettes as [key, palette] (key)}
              <Select.Item value={key} label={palette.label} />
            {/each}
          </Select.Group>

          <Select.Separator />

          <Select.Group>
            <Select.GroupHeading>Gruvbox</Select.GroupHeading>
            {#each gruvboxPalettes as [key, palette] (key)}
              <Select.Item value={key} label={palette.label} />
            {/each}
          </Select.Group>

          <Select.Separator />

          <Select.Group>
            <Select.GroupHeading>Rosé Pine</Select.GroupHeading>
            {#each rosePinePalettes as [key, palette] (key)}
              <Select.Item value={key} label={palette.label} />
            {/each}
          </Select.Group>

          <Select.Separator />

          <Select.Group>
            <Select.GroupHeading>Solarized</Select.GroupHeading>
            {#each solarizedPalettes as [key, palette] (key)}
              <Select.Item value={key} label={palette.label} />
            {/each}
          </Select.Group>

          <Select.Separator />

          <Select.Group>
            <Select.GroupHeading>Editor themes</Select.GroupHeading>
            {#each editorPalettes as [key, palette] (key)}
              <Select.Item value={key} label={palette.label} />
            {/each}
          </Select.Group>

          <Select.Separator />

          <Select.Item value="custom" label="Custom" />
        </Select.Content>
      </Select.Root>
      <p class="text-xs text-muted-foreground">{selectedColorThemeDescription}</p>
    </div>

    {#if draft.colorTheme === 'custom'}
      <div class="space-y-2">
        <Label for="appearance-custom-css">Custom theme CSS</Label>
        <textarea
          id="appearance-custom-css"
          rows={8}
          placeholder={`:root {\n  --background: oklch(...)\n  --foreground: oklch(...)\n  /* ... */\n}`}
          class="custom-css-textarea"
          bind:value={draft.customThemeCss}
        ></textarea>
        <p class="text-xs text-muted-foreground">
          Paste a <code>:root &#123; ... &#125;</code> CSS block. Community themes at
          <strong>shadcn-svelte.com/themes</strong>.
        </p>
      </div>
    {/if}

    {#if statusMessage}
      <p class="text-xs text-muted-foreground">{statusMessage}</p>
    {/if}
  </Card.Content>

  <Card.Footer class="flex flex-wrap justify-end gap-2 border-t pt-4">
    <Button type="button" variant="outline" onclick={handleReset}>Reset Draft</Button>
    <Button type="button" onclick={handleSave}>Save Appearance</Button>
  </Card.Footer>
</Card.Root>

<style>
  .custom-css-textarea {
    width: 100%;
    resize: vertical;
    font-family: var(--font-mono, monospace);
    font-size: 0.78rem;
    line-height: 1.5;
    padding: 0.5rem 0.65rem;
    border-radius: var(--radius);
    border: 1px solid oklch(var(--border));
    background: oklch(var(--background));
    color: oklch(var(--foreground));
    outline: none;
    transition: border-color 120ms ease;
  }

  .custom-css-textarea:focus {
    border-color: oklch(var(--ring));
  }
</style>
