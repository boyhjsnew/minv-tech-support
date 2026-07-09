export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
export const PNG_IEND = new Uint8Array([
  0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
export const JPEG_SIGNATURE = new Uint8Array([0xff, 0xd8, 0xff]);

export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ByteLength(base64: string): number {
  const normalized = base64.replace(/\s/g, '');
  const padding = normalized.endsWith('==')
    ? 2
    : normalized.endsWith('=')
      ? 1
      : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function indexOfBytes(
  haystack: Uint8Array,
  needle: Uint8Array,
  from = 0,
): number {
  if (!needle.length || haystack.length < needle.length) return -1;

  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }

  return -1;
}

export function utf16leBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length * 2);
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = code >> 8;
  }
  return bytes;
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
