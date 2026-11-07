// Startup guard: the engine may only start when every file of the active selection
// exists (and the local merged model still has a valid merge proof).
import { resolveActive } from './model-selection.mjs';

try {
  const active = resolveActive();
  console.log(`Modelos listos: ${active.modelLabel}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
