<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import type { AppearanceSettings, ColorTheme, ThemeMode } from '$lib/settings/appearance-settings';

  interface AppearanceSettingsEvents {
    save: void;
    reset: void;
  }

  interface ThemeModeOption {
    value: ThemeMode;
    label: string;
    description: string;
  }

  interface ColorThemeOption {
    value: ColorTheme;
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

  const colorThemeOptions: ReadonlyArray<ColorThemeOption> = [
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

  $: selectedThemeModeLabel =
    themeModeOptions.find((option) => option.value === draft.themeMode)?.label ?? 'System';

  $: selectedThemeModeDescription =
    themeModeOptions.find((option) => option.value === draft.themeMode)?.description ?? '';

  $: selectedColorThemeLabel =
    colorThemeOptions.find((option) => option.value === draft.colorTheme)?.label ?? 'Default';

  $: selectedColorThemeDescription =
    colorThemeOptions.find((option) => option.value === draft.colorTheme)?.description ?? '';

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
      Choose theme mode and color accents for the dashboard shell.
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
          {#each colorThemeOptions as option (option.value)}
            <Select.Item value={option.value} label={option.label} />
          {/each}
        </Select.Content>
      </Select.Root>
      <p class="text-xs text-muted-foreground">{selectedColorThemeDescription}</p>
    </div>

    {#if statusMessage}
      <p class="text-xs text-muted-foreground">{statusMessage}</p>
    {/if}
  </Card.Content>

  <Card.Footer class="flex flex-wrap justify-end gap-2 border-t pt-4">
    <Button type="button" variant="outline" onclick={handleReset}>Reset Draft</Button>
    <Button type="button" onclick={handleSave}>Save Appearance</Button>
  </Card.Footer>
</Card.Root>
