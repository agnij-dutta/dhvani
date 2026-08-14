// Run at build time (see render.yaml) so the ONNX embedder weights are baked
// into the deploy instead of downloaded on first request after every restart.
import { warmup } from "../src/lib/embedder";

const t0 = performance.now();
warmup().then(() => {
  console.log(`embedder prefetched + warm in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(0);
});
