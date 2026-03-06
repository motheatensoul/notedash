import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Defines Vite configuration for the Notedash web frontend.
 */
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
});
