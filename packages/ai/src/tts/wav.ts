// A WAV file from mono 16-bit PCM (the per-scene audio the render mixes). Header: RIFF, `fmt ` (PCM,
// 1 channel) and `data`. Pure, no ffmpeg needed.

export function wavFromPcm(pcm: Int16Array, sampleRate: number): Buffer {
  const dataBytes = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // size of the fmt chunk
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // bytes per second
  buffer.writeUInt16LE(2, 32); // bytes per sample frame
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < pcm.length; i++) buffer.writeInt16LE(pcm[i] ?? 0, 44 + i * 2);
  return buffer;
}
