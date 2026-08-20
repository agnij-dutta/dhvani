import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceWaveDrift,
  getWavePlaybackSpeed,
  shouldRenderWave,
} from "./engine";
import { FRAG } from "./shaders";

test("idle keeps rendering while active energy settles", () => {
  assert.equal(
    shouldRenderWave(
      "idle",
      false,
      0.42,
      0.31,
      { low: 0.4, mid: 0.3, high: 0.2, level: 0.5 },
    ),
    true,
  );
});

test("idle continues rendering a subtle breathing signal", () => {
  assert.equal(
    shouldRenderWave(
      "idle",
      false,
      0,
      0,
      { low: 0, mid: 0, high: 0, level: 0 },
    ),
    true,
  );
});

test("reduced motion never starts the autonomous renderer", () => {
  assert.equal(
    shouldRenderWave(
      "thinking",
      true,
      0.8,
      0.8,
      { low: 0.5, mid: 0.5, high: 0.5, level: 0.6 },
    ),
    false,
  );
});

test("every spatial phase term travels right-to-left", () => {
  assert.match(FRAG, /uniform float uDrift;/);
  assert.match(FRAG, /float drift = uDrift;/);
  assert.match(FRAG, /sin\(x \* 1\.1 \+ drift\)/);
  assert.match(FRAG, /sin\(x \* 2\.53 \+ drift \* 1\.6 \+ 1\.7\)/);
  assert.match(FRAG, /sin\(x \* 0\.42 \+ drift \* 0\.6\)/);
  assert.doesNotMatch(FRAG, /sin\(x[^;\n]*- drift/);
  assert.doesNotMatch(FRAG, /uTime \* mix\(0\.9, 2\.1, wake\)/);
  assert.match(FRAG, /float phase = lane \* 1\.4;/);
  assert.doesNotMatch(FRAG, /float phase = mix\(-spread, spread/);
});

test("falling wake energy cannot reverse the spatial clock", () => {
  let drift = 12;

  for (const wake of [1, 0.76, 0.4, 0.12, 0]) {
    const next = advanceWaveDrift(drift, 1 / 60, 1, wake);
    assert.ok(next > drift);
    drift = next;
  }
});

test("articulated speech moves the wave clock faster than a steady voice", () => {
  const measuredPace = getWavePlaybackSpeed({
    low: 0.4,
    mid: 0.46,
    high: 0.3,
    level: 0.48,
    cadence: 0.76,
  });
  const steadyPace = getWavePlaybackSpeed({
    low: 0.4,
    mid: 0.46,
    high: 0.3,
    level: 0.48,
    cadence: 0.08,
  });

  assert.ok(measuredPace > steadyPace);
});
