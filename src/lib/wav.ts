// Client-side WebM/Opus → WAV conversion. Sarvam's REST endpoint rejects
// webm ("Invalid file type: audio/webm;codecs=opus"), and Chrome's
// MediaRecorder can't produce anything Sarvam accepts — so we decode the
// recording in the browser and re-encode as 16kHz mono PCM WAV, which is also
// Sarvam's optimal input format.

const TARGET_RATE = 16000;

export async function blobToWav(blob: Blob): Promise<Blob> {
  const raw = await blob.arrayBuffer();

  // decode at native rate first — Safari's decodeAudioData dislikes resampling
  const probe = new AudioContext();
  const decoded = await probe.decodeAudioData(raw.slice(0));
  void probe.close();

  // mix to mono + resample to 16kHz via OfflineAudioContext
  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const pcm = rendered.getChannelData(0);

  // encode 16-bit PCM WAV
  const dataBytes = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);
  let off = 44;
  for (let i = 0; i < pcm.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
