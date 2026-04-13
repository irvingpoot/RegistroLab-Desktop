// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from "@astrojs/node";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()], 
    ssr: {
      noExternal: ['@supabase/supabase-js'], 
    },
  },
  output: "server",
  adapter: node({
    mode: "standalone"
  }),
  server: {
    port: 4321,
    host: true
  }
});