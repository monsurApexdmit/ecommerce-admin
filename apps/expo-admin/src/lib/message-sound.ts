import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const SAMPLE_RATE = 22050;
const DURATION_MS = 180;
const FREQUENCY = 880;
const VOLUME = 0.22;

let audioPrepared = false;
let soundUri: string | null = null;
let lastPlayedMessageId: number | null = null;
let lastPlayedAt = 0;

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;
    const triple = (byte1 << 16) | (byte2 << 8) | byte3;

    output += chars[(triple >> 18) & 0x3f];
    output += chars[(triple >> 12) & 0x3f];
    output += index + 1 < bytes.length ? chars[(triple >> 6) & 0x3f] : "=";
    output += index + 2 < bytes.length ? chars[triple & 0x3f] : "=";
  }

  return output;
}

function createBeepDataUri() {
  const sampleCount = Math.floor((SAMPLE_RATE * DURATION_MS) / 1000);
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    const envelope = Math.exp(-5 * progress);
    const sample = Math.sin((2 * Math.PI * FREQUENCY * index) / SAMPLE_RATE) * envelope * VOLUME;
    view.setInt16(44 + (index * 2), Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

async function ensureAudioPrepared() {
  if (audioPrepared) return;

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "duckOthers",
  });

  audioPrepared = true;
}

function cleanupPlayer(player: AudioPlayer) {
  try {
    player.remove();
  } catch {
    // no-op
  }
}

export async function playIncomingSupportMessageSound(messageId?: number) {
  const now = Date.now();

  if (messageId != null && lastPlayedMessageId === messageId && now - lastPlayedAt < 1500) {
    return;
  }

  lastPlayedMessageId = messageId ?? null;
  lastPlayedAt = now;

  try {
    await ensureAudioPrepared();
    soundUri ??= createBeepDataUri();

    const player = createAudioPlayer({ uri: soundUri }, { updateInterval: 50 });
    player.volume = 1;

    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        cleanupPlayer(player);
      }
    });

    player.play();

    setTimeout(() => {
      subscription.remove();
      cleanupPlayer(player);
    }, 1500);
  } catch (error) {
    console.warn("Failed to play incoming support message sound.", error);
  }
}
