import adapter from '@sveltejs/adapter-static';

/**
 * Provides static SPA output for browser and Tauri targets.
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};

export default config;
