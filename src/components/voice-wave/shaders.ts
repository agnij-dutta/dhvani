export const VERT = `#version 300 es
void main(){
  vec2 v = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

export const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uDrift;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uLevel;
uniform float uPresence;
uniform float uWake;
uniform float uWakeLag;
uniform float uAmplitude;
uniform float uSpread;
uniform float uDetail;
uniform float uBrightness;
uniform float uReflection;
uniform vec3  uPaper;

out vec4 outColor;

const float PI = 3.14159265359;

vec3 spectral4(int s){
  vec3 c0 = vec3(0.26, 0.18, 1.00);
  vec3 c1 = vec3(0.74, 0.17, 0.96);
  vec3 c2 = vec3(1.00, 0.22, 0.52);
  vec3 c3 = vec3(1.00, 0.66, 0.22);
  return s == 0 ? c0 : s == 1 ? c1 : s == 2 ? c2 : c3;
}

float waveY(float x, float amp, float env, float drift, float harm){
  // Positive time phase and positive x frequency move every layer toward -x.
  float fundamental = sin(x * 1.1 + drift);
  float partial = sin(x * 2.53 + drift * 1.6 + 1.7);
  float tilt = 1.0 + 0.14 * sin(x * 0.42 + drift * 0.6);
  return amp * env * tilt * (fundamental + harm * partial);
}

float thicknessAt(float xN, float mid){
  float taper = 1.0 - 0.55 * clamp(abs(xN) * 0.75, 0.0, 1.0);
  return (0.020 + 0.016 * taper) * (1.0 + 0.35 * mid);
}

vec3 ribbon(vec2 p, float aspect, float amp, float spread, float drift,
            float harm, float mid, float level, float soften, float brightness){
  float xN = p.x / max(aspect, 1.0);
  float env = cos(PI * 0.5 * min(abs(0.92 * xN), 1.0));
  env *= env;

  float thick = thicknessAt(xN, mid) * soften;
  float soft = (0.020 + 0.012 * mid) * soften;
  float inten = 0.019 * (1.0 + 0.7 * level) * brightness;
  float yMain = waveY(p.x, amp, env, drift, harm);

  vec3 num = vec3(0.0);
  vec3 den = vec3(0.0);
  for (int s = 0; s < 4; s++){
    vec3 hue = spectral4(s);
    den += hue;

    float lane = mix(-1.0, 1.0, float(s) / 3.0);
    float phase = lane * 1.4;
    float spectralLift = lane * 0.014 * spread * env;
    float yLine =
      waveY(p.x, amp + 0.03 * mid, env, drift + phase, harm) + spectralLift;
    float d = abs(p.y - yLine);
    float line = inten / (sqrt(d * d + soft * soft) + thick);
    line *= exp(-d * d);

    float lo = min(yMain, yLine);
    float hi = max(yMain, yLine);
    float dBand = max(0.0, max(p.y - hi, lo - p.y));
    float band = 4.9 * inten * exp(-dBand / (0.08 * soften));
    num += hue * (line + band);
  }

  float denSum = (den.r + den.g + den.b) / 3.0;
  vec3 col = num / max(denSum, 1e-5);
  float dMain = abs(p.y - yMain);
  col += 0.42 * inten / (sqrt(dMain * dMain + soft * soft) + thick);
  return col;
}

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main(){
  vec2 resolution = uRes;
  float aspect = resolution.x / resolution.y;
  vec2 p = (gl_FragCoord.xy + 0.5) * 2.0 / resolution - 1.0;
  p.x *= aspect;
  float yScreen = p.y;
  p /= 0.62;

  float wake = clamp(uWake, 0.0, 1.0);
  // A slow, fuller breath keeps the resting wave visibly alive without reading as speech.
  float idle = 0.034 + 0.012 * sin(uTime * 0.36 + 0.7);
  float amp = mix(idle, 0.20 + 0.34 * uLow, wake) * uPresence * uAmplitude;
  float lag = clamp(uWakeLag, 0.0, 1.0);
  float spread = mix(0.55, 2.2 + 1.6 * uHigh + 0.6 * uMid, lag)
    * uPresence * uSpread;
  float harm = mix(0.10, 0.34 + 0.22 * uHigh, wake) * uDetail;

  float xN = p.x / max(aspect, 1.0);
  float drift = uDrift;
  float ends = exp(-pow(xN * 1.55, 2.0));
  vec3 col = ribbon(
    p,
    aspect,
    amp,
    spread,
    drift,
    harm,
    uMid,
    uLevel,
    1.0,
    uBrightness
  );

  const float SURFACE = 0.50;
  vec2 reflectedPoint = vec2(p.x, 2.0 * SURFACE - p.y);
  vec3 reflection = ribbon(
    reflectedPoint,
    aspect,
    amp * 0.86,
    spread,
    drift,
    harm,
    uMid,
    uLevel,
    2.1,
    uBrightness
  );
  float underSurface = smoothstep(0.0, 0.16, p.y - SURFACE);
  float depth = clamp((p.y - SURFACE) / 0.95, 0.0, 1.0);
  col += reflection * uReflection * underSurface * (1.0 - depth) * (1.0 - depth);
  col = pow(max(col, 0.0), vec3(1.45));

  float above = smoothstep(1.0, 0.34, -yScreen);
  float below = smoothstep(1.06, 0.52, yScreen);
  float edge = yScreen < 0.0 ? above : below;
  col *= edge * ends * uPresence;

  float density = clamp(max(max(col.r, col.g), col.b) * 1.9, 0.0, 1.0);
  vec3 hue = col / max(max(max(col.r, col.g), col.b), 1e-6);
  vec3 outputColor = uPaper * (1.0 - density * (1.0 - hue * 0.55));
  outputColor = clamp(outputColor, 0.0, 1.0);

  float grain = hash21(gl_FragCoord.xy * 0.75 + fract(uTime) * 91.7);
  vec3 softLight = outputColor * (1.0 - 2.0 * (grain - 0.5) * outputColor)
    + (2.0 * (grain - 0.5)) * sqrt(max(outputColor, 0.0));
  outputColor = mix(outputColor, clamp(softLight, 0.0, 1.0), 0.055);

  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  outputColor += (noise - 0.5) / 255.0;
  outColor = vec4(outputColor, 1.0);
}`;
