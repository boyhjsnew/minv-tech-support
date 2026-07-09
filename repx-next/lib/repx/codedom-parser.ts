import {
  JPEG_SIGNATURE,
  PNG_IEND,
  PNG_SIGNATURE,
  base64ByteLength,
  decodeBase64,
  encodeBase64,
  indexOfBytes,
  utf16leBytes,
} from './binary';
import { RepxExtractedImage } from './types';

export interface CodeDomMeta {
  devExpressVersion: string | null;
  pictureBoxNames: string[];
  resourceKeys: string[];
}

export function isCodeDomRepx(content: string): boolean {
  return (
    content.includes('<XRTypeInfo>') ||
    content.includes('namespace XtraReportSerialization') ||
    content.includes('DevExpress.XtraReports.UI.XtraReport')
  );
}

export function parseCodeDomRepx(content: string): {
  meta: CodeDomMeta;
  images: RepxExtractedImage[];
} {
  const meta = extractCodeDomMeta(content);
  const resourceBuffer = extractResourceBuffer(content);
  const binaryImages = resourceBuffer
    ? extractImagesFromResourceBinary(resourceBuffer, meta.resourceKeys)
    : extractImagesFromText(content, meta.resourceKeys);

  const boundPictureBoxes = meta.pictureBoxNames
    .filter(
      (name) =>
        !binaryImages.some(
          (img) =>
            img.name === name ||
            img.resourceKey === `${name}.Image` ||
            img.name.startsWith(name),
        ),
    )
    .map((name) => ({
      name,
      controlType: 'XRPictureBox',
      source: 'bound' as const,
      mimeType: null,
      base64: null,
      dataUrl: null,
      imageUrl: null,
      expression: null,
      sizeBytes: null,
      resourceKey: null,
    }));

  return {
    meta,
    images: [...binaryImages, ...boundPictureBoxes],
  };
}

function extractCodeDomMeta(content: string): CodeDomMeta {
  const versionMatch = content.match(
    /<AssemblyFullName>DevExpress\.XtraReports\.v([^,<]+)/,
  );
  const pictureBoxNames = [
    ...content.matchAll(
      /private\s+DevExpress\.XtraReports\.UI\.XRPictureBox\s+(\w+)\s*;/g,
    ),
  ].map((match) => match[1]);

  const resourceKeys = [
    ...content.matchAll(/resources\.GetObject\("([^"]+\.Image)"\)/g),
  ].map((match) => match[1]);

  return {
    devExpressVersion: versionMatch?.[1] ?? null,
    pictureBoxNames: [...new Set(pictureBoxNames)],
    resourceKeys: [...new Set(resourceKeys)],
  };
}

function extractResourceBuffer(content: string): Uint8Array | null {
  const match = content.match(
    /<Resource Name="([^"]+)">\s*([\s\S]*?)<\/Resource>/,
  );
  if (!match) return null;

  const base64 = match[2]
    .replace(/^\/\/\/ ?/gm, '')
    .replace(/\s+/g, '');

  if (!base64) return null;

  try {
    return decodeBase64(base64);
  } catch {
    return null;
  }
}

function extractImagesFromResourceBinary(
  buffer: Uint8Array,
  resourceKeys: string[],
): RepxExtractedImage[] {
  const pngChunks = extractBinaryImages(buffer);
  const keysInOrder = findResourceKeysInBinary(buffer, resourceKeys);
  const mapped = mapKeysToImages(keysInOrder, pngChunks);

  return mapped.map((item) => ({
    name: item.displayName,
    controlType: 'XRPictureBox',
    source: 'embedded' as const,
    mimeType: item.mimeType,
    base64: item.base64,
    dataUrl: item.dataUrl,
    imageUrl: null,
    expression: null,
    sizeBytes: item.sizeBytes,
    resourceKey: item.resourceKey,
  }));
}

function extractImagesFromText(
  content: string,
  resourceKeys: string[],
): RepxExtractedImage[] {
  const pngRegex = /iVBORw0KGgo[A-Za-z0-9+/=]+/g;
  const jpgRegex = /\/9j\/[A-Za-z0-9+/=]+/g;
  const matches = [
    ...(content.match(pngRegex) ?? []),
    ...(content.match(jpgRegex) ?? []),
  ];

  return matches.map((base64, index) => {
    const mimeType = detectMimeFromBase64(base64);
    const resourceKey = resourceKeys[index] ?? null;
    const displayName = resourceKey
      ? resourceKey.replace(/\.Image$/, '')
      : `embedded-image-${index + 1}`;

    return {
      name: displayName,
      controlType: 'XRPictureBox',
      source: 'embedded' as const,
      mimeType,
      base64,
      dataUrl: mimeType ? `data:${mimeType};base64,${base64}` : null,
      imageUrl: null,
      expression: null,
      sizeBytes: base64ByteLength(base64),
      resourceKey,
    };
  });
}

function findResourceKeysInBinary(
  buffer: Uint8Array,
  resourceKeys: string[],
): string[] {
  const firstImageOffset = findFirstImageOffset(buffer);
  const scanLimit = firstImageOffset > 0 ? firstImageOffset : buffer.length;
  const scanArea = buffer.subarray(0, scanLimit);

  const found = resourceKeys
    .map((key) => ({
      key,
      offset: indexOfBytes(scanArea, utf16leBytes(key)),
    }))
    .filter((item) => item.offset >= 0)
    .sort((a, b) => a.offset - b.offset)
    .map((item) => item.key);

  return found.length ? found : resourceKeys;
}

function findFirstImageOffset(buffer: Uint8Array): number {
  const png = indexOfBytes(buffer, PNG_SIGNATURE);
  const jpg = indexOfBytes(buffer, JPEG_SIGNATURE);
  if (png === -1) return jpg;
  if (jpg === -1) return png;
  return Math.min(png, jpg);
}

function extractBinaryImages(
  buffer: Uint8Array,
): Array<{
  mimeType: string;
  base64: string;
  dataUrl: string;
  sizeBytes: number;
  offset: number;
}> {
  const images: Array<{
    mimeType: string;
    base64: string;
    dataUrl: string;
    sizeBytes: number;
    offset: number;
  }> = [];

  let position = 0;
  while (position < buffer.length) {
    const pngStart = indexOfBytes(buffer, PNG_SIGNATURE, position);
    const jpgStart = indexOfBytes(buffer, JPEG_SIGNATURE, position);

    let start = -1;
    let mimeType = 'image/png';

    if (pngStart === -1 && jpgStart === -1) break;
    if (pngStart === -1 || (jpgStart !== -1 && jpgStart < pngStart)) {
      start = jpgStart;
      mimeType = 'image/jpeg';
    } else {
      start = pngStart;
      mimeType = 'image/png';
    }

    const chunk =
      mimeType === 'image/png'
        ? extractPngChunk(buffer, start)
        : extractJpegChunk(buffer, start);

    if (!chunk) break;

    const base64 = encodeBase64(chunk);
    images.push({
      mimeType,
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      sizeBytes: chunk.length,
      offset: start,
    });

    position = start + chunk.length;
  }

  return images;
}

function extractPngChunk(buffer: Uint8Array, start: number): Uint8Array | null {
  const end = indexOfBytes(buffer, PNG_IEND, start);
  if (end === -1) return null;
  return buffer.subarray(start, end + PNG_IEND.length);
}

function extractJpegChunk(buffer: Uint8Array, start: number): Uint8Array | null {
  let end = start + 3;
  while (end < buffer.length - 1) {
    if (buffer[end] === 0xff && buffer[end + 1] === 0xd9) {
      return buffer.subarray(start, end + 2);
    }
    end += 1;
  }
  return null;
}

function mapKeysToImages(
  resourceKeys: string[],
  images: Array<{
    mimeType: string;
    base64: string;
    dataUrl: string;
    sizeBytes: number;
    offset: number;
  }>,
): Array<{
  resourceKey: string | null;
  displayName: string;
  mimeType: string;
  base64: string;
  dataUrl: string;
  sizeBytes: number;
}> {
  const sortedImages = [...images].sort((a, b) => a.offset - b.offset);

  if (!resourceKeys.length) {
    return sortedImages.map((image, index) => ({
      resourceKey: null,
      displayName: `embedded-image-${index + 1}`,
      ...image,
    }));
  }

  if (resourceKeys.length === sortedImages.length) {
    return sortedImages.map((image, index) => ({
      resourceKey: resourceKeys[index],
      displayName: resourceKeys[index].replace(/\.Image$/, ''),
      ...image,
    }));
  }

  return sortedImages.map((image, index) => {
    const resourceKey = resourceKeys[index] ?? null;
    return {
      resourceKey,
      displayName: resourceKey
        ? resourceKey.replace(/\.Image$/, '')
        : `embedded-image-${index + 1}`,
      ...image,
    };
  });
}

function detectMimeFromBase64(base64: string): string {
  const head = base64.slice(0, 16);
  if (head.startsWith('iVBORw0KG')) return 'image/png';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  if (head.startsWith('UklGR')) return 'image/webp';
  return 'application/octet-stream';
}
