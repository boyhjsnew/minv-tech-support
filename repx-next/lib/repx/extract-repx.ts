import { XMLParser } from 'fast-xml-parser';
import { base64ByteLength, encodeBase64 } from './binary';
import { isCodeDomRepx, parseCodeDomRepx } from './codedom-parser';
import {
  RepxExtractedImage,
  RepxExtractResult,
  RepxImageSourceType,
} from './types';

type XmlNode = Record<string, unknown>;
type RepxFormat = RepxExtractResult['format'];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
});

export async function extractRepxFromFile(file: File): Promise<RepxExtractResult> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  return extractRepxFromBytes(buffer, file.name);
}

export async function extractRepxFromBytes(
  buffer: Uint8Array,
  fileName = 'upload.repx',
): Promise<RepxExtractResult> {
  const format = detectFormat(buffer);
  const text = new TextDecoder('utf-8').decode(buffer);

  if (format === 'codedom' || isCodeDomRepx(text)) {
    const codedom = parseCodeDomRepx(text);
    return buildResult(fileName, 'codedom', codedom.images, {
      codedomMeta: codedom.meta,
    });
  }

  const xmlSources =
    format === 'zip' ? await extractSourcesFromZip(buffer) : [text];

  const images: RepxExtractedImage[] = [];
  for (const xml of xmlSources) {
    images.push(...extractImagesFromXml(xml));
  }

  return buildResult(fileName, format === 'zip' ? 'zip' : 'xml', images, {
    xmlSources: xmlSources.map((_, index) => `source-${index + 1}`),
  });
}

function buildResult(
  fileName: string,
  format: RepxFormat,
  images: RepxExtractedImage[],
  extra: Partial<RepxExtractResult> = {},
): RepxExtractResult {
  const boundPictureBoxes = images.filter((img) => img.source === 'bound');
  const embeddedCount = images.filter((img) => img.source === 'embedded').length;
  const boundCount = boundPictureBoxes.length;
  const urlCount = images.filter((img) => img.source === 'url').length;

  return {
    fileName,
    format,
    xmlSources: extra.xmlSources ?? [],
    images,
    boundPictureBoxes,
    codedomMeta: extra.codedomMeta,
    summary: {
      totalPictureBoxes: images.length,
      embeddedCount,
      boundCount,
      urlCount,
    },
  };
}

function detectFormat(buffer: Uint8Array): RepxFormat {
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return 'zip';
  }

  const head = new TextDecoder('utf-8').decode(
    buffer.subarray(0, Math.min(buffer.length, 200)),
  );
  if (
    head.includes('<XRTypeInfo>') ||
    head.includes('namespace XtraReportSerialization')
  ) {
    return 'codedom';
  }

  return 'xml';
}

async function extractSourcesFromZip(buffer: Uint8Array): Promise<string[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles: string[] = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const lowerName = entry.name.toLowerCase();
    if (!lowerName.endsWith('.repx') && !lowerName.endsWith('.xml')) {
      continue;
    }
    const content = await entry.async('string');
    if (
      content.includes('XtraReportsLayoutSerializer') ||
      isCodeDomRepx(content)
    ) {
      xmlFiles.push(content);
    }
  }

  if (!xmlFiles.length) {
    throw new Error(
      'File ZIP không chứa layout REPX hợp lệ (XML hoặc CodeDOM).',
    );
  }

  return xmlFiles;
}

function extractImagesFromXml(xmlContent: string): RepxExtractedImage[] {
  const trimmed = xmlContent.trim();
  if (!trimmed.includes('XtraReportsLayoutSerializer')) {
    if (isCodeDomRepx(trimmed)) {
      return parseCodeDomRepx(trimmed).images;
    }
    throw new Error(
      'Nội dung không phải file REPX hợp lệ (XML hoặc CodeDOM DevExpress).',
    );
  }

  const doc = xmlParser.parse(trimmed) as XmlNode;
  const pictureBoxes: RepxExtractedImage[] = [];

  walkNodes(doc, (node) => {
    const controlType = String(node.ControlType ?? '');
    if (!controlType.includes('XRPictureBox')) return;

    const name = String(node.Name ?? 'xrPictureBox');
    const imageSource = node.ImageSource ? String(node.ImageSource) : null;
    const imageUrl = node.ImageUrl ? String(node.ImageUrl) : null;
    const expression = getImageExpression(node);

    if (imageSource) {
      const parsed = parseImageSource(imageSource);
      pictureBoxes.push({
        name,
        controlType,
        source: parsed.source,
        mimeType: parsed.mimeType,
        base64: parsed.base64,
        dataUrl: parsed.dataUrl,
        imageUrl: null,
        expression,
        sizeBytes: parsed.base64 ? base64ByteLength(parsed.base64) : null,
      });
      return;
    }

    if (imageUrl) {
      pictureBoxes.push({
        name,
        controlType,
        source: 'url',
        mimeType: null,
        base64: null,
        dataUrl: null,
        imageUrl,
        expression,
        sizeBytes: null,
      });
      return;
    }

    if (expression) {
      pictureBoxes.push({
        name,
        controlType,
        source: 'bound',
        mimeType: null,
        base64: null,
        dataUrl: null,
        imageUrl: null,
        expression,
        sizeBytes: null,
      });
    }
  });

  return pictureBoxes;
}

function walkNodes(value: unknown, visit: (node: XmlNode) => void): void {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((item) => walkNodes(item, visit));
    return;
  }

  if (typeof value !== 'object') return;

  const node = value as XmlNode;
  if (node.ControlType) {
    visit(node);
  }

  for (const child of Object.values(node)) {
    walkNodes(child, visit);
  }
}

function getImageExpression(node: XmlNode): string | null {
  const bindings = node.ExpressionBindings;
  if (!bindings || typeof bindings !== 'object') return null;

  const bindingObj = bindings as XmlNode;
  const items = Object.entries(bindingObj)
    .filter(([key]) => /^Item\d*$/i.test(key) || key === 'Item')
    .map(([, value]) => value);

  for (const item of items) {
    const binding = item as XmlNode;
    const propertyName = String(binding.PropertyName ?? '');
    if (
      propertyName === 'ImageSource' ||
      propertyName === 'Image' ||
      propertyName === 'ImageUrl'
    ) {
      return String(binding.Expression ?? '');
    }
  }

  return null;
}

function parseImageSource(imageSource: string): {
  source: RepxImageSourceType;
  mimeType: string | null;
  base64: string | null;
  dataUrl: string | null;
} {
  const trimmed = imageSource.trim();

  if (trimmed.startsWith('img,')) {
    const base64 = trimmed.slice(4);
    const mimeType = detectMimeFromBase64(base64);
    return {
      source: 'embedded',
      mimeType,
      base64,
      dataUrl: mimeType ? `data:${mimeType};base64,${base64}` : null,
    };
  }

  if (trimmed.startsWith('svg,')) {
    const svgContent = trimmed.slice(4);
    const base64 = encodeBase64(new TextEncoder().encode(svgContent));
    return {
      source: 'embedded',
      mimeType: 'image/svg+xml',
      base64,
      dataUrl: `data:image/svg+xml;base64,${base64}`,
    };
  }

  if (looksLikeBase64(trimmed)) {
    const mimeType = detectMimeFromBase64(trimmed);
    return {
      source: 'embedded',
      mimeType,
      base64: trimmed,
      dataUrl: mimeType ? `data:${mimeType};base64,${trimmed}` : null,
    };
  }

  return {
    source: 'bound',
    mimeType: null,
    base64: null,
    dataUrl: null,
  };
}

function looksLikeBase64(value: string): boolean {
  if (value.length < 32) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function detectMimeFromBase64(base64: string): string | null {
  const head = base64.slice(0, 16);
  if (head.startsWith('iVBORw0KG')) return 'image/png';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  if (head.startsWith('UklGR')) return 'image/webp';
  if (head.startsWith('PHN2Zy') || head.startsWith('PD94bW')) {
    return 'image/svg+xml';
  }
  return 'application/octet-stream';
}
