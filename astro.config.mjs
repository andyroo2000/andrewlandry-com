// @ts-check
import { defineConfig } from 'astro/config';
import { tripMedia } from './dev/trip-media.mjs';

// https://astro.build/config
export default defineConfig({ vite: { plugins: [tripMedia()] } });
