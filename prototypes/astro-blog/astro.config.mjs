import { defineConfig } from 'astro/config';
import pwaIntegration from './scripts/pwa-integration.mjs';

export default defineConfig({
  site: 'https://www.kukie.cn',
  integrations: [
    {
      name: 'legacy-url-redirects',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => injectRoute({
          pattern: '/_redirects', entrypoint: './src/endpoints/redirects.ts', prerender: true
        })
      }
    },
    pwaIntegration()
  ],
  publicDir: '../../static',
  trailingSlash: 'always',
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
  devToolbar: { enabled: false },
  server: { port: 8085 },
  vite: { server: { strictPort: true }, preview: { strictPort: true } },
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: true }
  }
});
