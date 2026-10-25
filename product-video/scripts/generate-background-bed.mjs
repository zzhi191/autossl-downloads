import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, resolve} from "node:path";

const sampleRate = 48_000;
const durationSeconds = 15;
const channels = 2;
const totalSamples = sampleRate * durationSeconds;
const output = resolve("public/autossl-background.wav");
const data = Buffer.alloc(totalSamples * channels * 2);
const notes = [110, 123.47, 146.83, 130.81, 110];

for (let sample = 0; sample < totalSamples; sample += 1) {
  const time = sample / sampleRate;
  const note = notes[Math.min(Math.floor(time / 3), notes.length - 1)];
  const fadeIn = Math.min(time / 0.8, 1);
  const fadeOut = Math.min((durationSeconds - time) / 1.1, 1);
  const pulse = 0.72 + Math.sin(time * Math.PI * 2 / 3) * 0.12;
  const tone = (
    Math.sin(Math.PI * 2 * note * time) * 0.44 +
    Math.sin(Math.PI * 2 * note * 1.5 * time) * 0.18 +
    Math.sin(Math.PI * 2 * note * 2 * time) * 0.07
  ) * 0.12 * fadeIn * fadeOut * pulse;
  const value = Math.round(Math.max(-1, Math.min(1, tone)) * 0x7fff);
  data.writeInt16LE(value, (sample * channels) * 2);
  data.writeInt16LE(value, (sample * channels + 1) * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(channels, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * channels * 2, 28);
header.writeUInt16LE(channels * 2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, Buffer.concat([header, data]));
console.log(`Wrote ${output}`);
