import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const PNG_IEND = new Uint8Array([
  0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const JPEG_SIGNATURE = new Uint8Array([0xff, 0xd8, 0xff]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
});

export async function extractRepxFromFile(file) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  return extractRepxFromBytes(buffer, file.name);
}

async function extractRepxFromBytes(buffer, fileName = "upload.repx") {
  const format = detectFormat(buffer);
  const text = new TextDecoder("utf-8").decode(buffer);

  if (format === "codedom" || isCodeDomRepx(text)) {
    const codedom = parseCodeDomRepx(text);
    return buildResult(fileName, "codedom", codedom.images, {
      codedomMeta: codedom.meta,
    });
  }

  const xmlSources =
    format === "zip" ? await extractSourcesFromZip(buffer) : [text];

  const images = [];
  for (const xml of xmlSources) {
    images.push(...extractImagesFromXml(xml));
  }

  return buildResult(fileName, format === "zip" ? "zip" : "xml", images, {
    xmlSources: xmlSources.map((_, index) => `source-${index + 1}`),
  });
}

function buildResult(fileName, format, images, extra = {}) {
  const embeddedCount = images.filter((img) => img.source === "embedded").length;
  const boundCount = images.filter((img) => img.source === "bound").length;
  const urlCount = images.filter((img) => img.source === "url").length;

  return {
    fileName,
    format,
    xmlSources: extra.xmlSources || [],
    images,
    boundPictureBoxes: images.filter((img) => img.source === "bound"),
    codedomMeta: extra.codedomMeta,
    summary: {
      totalPictureBoxes: images.length,
      embeddedCount,
      boundCount,
      urlCount,
    },
  };
}

function detectFormat(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return "zip";
  }

  const head = new TextDecoder("utf-8").decode(
    buffer.subarray(0, Math.min(buffer.length, 200)),
  );

  if (
    head.includes("<XRTypeInfo>") ||
    head.includes("namespace XtraReportSerialization")
  ) {
    return "codedom";
  }

  return "xml";
}

async function extractSourcesFromZip(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const lowerName = entry.name.toLowerCase();
    if (!lowerName.endsWith(".repx") && !lowerName.endsWith(".xml")) continue;

    const content = await entry.async("string");
    if (
      content.includes("XtraReportsLayoutSerializer") ||
      isCodeDomRepx(content)
    ) {
      xmlFiles.push(content);
    }
  }

  if (!xmlFiles.length) {
    throw new Error("File ZIP không chứa layout REPX hợp lệ (XML hoặc CodeDOM).");
  }

  return xmlFiles;
}

function extractImagesFromXml(xmlContent) {
  const trimmed = xmlContent.trim();
  if (!trimmed.includes("XtraReportsLayoutSerializer")) {
    if (isCodeDomRepx(trimmed)) {
      return parseCodeDomRepx(trimmed).images;
    }
    throw new Error(
      "Nội dung không phải file REPX hợp lệ (XML hoặc CodeDOM DevExpress).",
    );
  }

  const doc = xmlParser.parse(trimmed);
  const pictureBoxes = [];

  walkNodes(doc, (node) => {
    const controlType = String(node.ControlType || "");
    if (!controlType.includes("XRPictureBox")) return;

    const name = String(node.Name || "xrPictureBox");
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
        source: "url",
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
        source: "bound",
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

function walkNodes(value, visit) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkNodes(item, visit));
    return;
  }
  if (typeof value !== "object") return;

  if (value.ControlType) {
    visit(value);
  }

  Object.values(value).forEach((child) => walkNodes(child, visit));
}

function getImageExpression(node) {
  const bindings = node.ExpressionBindings;
  if (!bindings || typeof bindings !== "object") return null;

  const items = Object.entries(bindings)
    .filter(([key]) => /^Item\d*$/i.test(key) || key === "Item")
    .map(([, value]) => value);

  for (const item of items) {
    const propertyName = String(item.PropertyName || "");
    if (
      propertyName === "ImageSource" ||
      propertyName === "Image" ||
      propertyName === "ImageUrl"
    ) {
      return String(item.Expression || "");
    }
  }

  return null;
}

function parseImageSource(imageSource) {
  const trimmed = imageSource.trim();

  if (trimmed.startsWith("img,")) {
    const base64 = trimmed.slice(4);
    const mimeType = detectMimeFromBase64(base64);
    return {
      source: "embedded",
      mimeType,
      base64,
      dataUrl: mimeType ? `data:${mimeType};base64,${base64}` : null,
    };
  }

  if (trimmed.startsWith("svg,")) {
    const svgContent = trimmed.slice(4);
    const base64 = encodeBase64(new TextEncoder().encode(svgContent));
    return {
      source: "embedded",
      mimeType: "image/svg+xml",
      base64,
      dataUrl: `data:image/svg+xml;base64,${base64}`,
    };
  }

  if (looksLikeBase64(trimmed)) {
    const mimeType = detectMimeFromBase64(trimmed);
    return {
      source: "embedded",
      mimeType,
      base64: trimmed,
      dataUrl: mimeType ? `data:${mimeType};base64,${trimmed}` : null,
    };
  }

  return {
    source: "bound",
    mimeType: null,
    base64: null,
    dataUrl: null,
  };
}

function looksLikeBase64(value) {
  if (value.length < 32) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function detectMimeFromBase64(base64) {
  const head = base64.slice(0, 16);
  if (head.startsWith("iVBORw0KG")) return "image/png";
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  if (head.startsWith("PHN2Zy") || head.startsWith("PD94bW")) {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}

function isCodeDomRepx(content) {
  return (
    content.includes("<XRTypeInfo>") ||
    content.includes("namespace XtraReportSerialization") ||
    content.includes("DevExpress.XtraReports.UI.XtraReport")
  );
}

function parseCodeDomRepx(content) {
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
      controlType: "XRPictureBox",
      source: "bound",
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

function extractCodeDomMeta(content) {
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
    devExpressVersion: versionMatch?.[1] || null,
    pictureBoxNames: [...new Set(pictureBoxNames)],
    resourceKeys: [...new Set(resourceKeys)],
  };
}

function extractResourceBuffer(content) {
  const match = content.match(
    /<Resource Name="([^"]+)">\s*([\s\S]*?)<\/Resource>/,
  );
  if (!match) return null;

  const base64 = match[2].replace(/^\/\/\/ ?/gm, "").replace(/\s+/g, "");
  if (!base64) return null;

  try {
    return decodeBase64(base64);
  } catch {
    return null;
  }
}

function extractImagesFromResourceBinary(buffer, resourceKeys) {
  const pngChunks = extractBinaryImages(buffer);
  const keysInOrder = findResourceKeysInBinary(buffer, resourceKeys);
  const mapped = mapKeysToImages(keysInOrder, pngChunks);

  return mapped.map((item) => ({
    name: item.displayName,
    controlType: "XRPictureBox",
    source: "embedded",
    mimeType: item.mimeType,
    base64: item.base64,
    dataUrl: item.dataUrl,
    imageUrl: null,
    expression: null,
    sizeBytes: item.sizeBytes,
    resourceKey: item.resourceKey,
  }));
}

function extractImagesFromText(content, resourceKeys) {
  const pngRegex = /iVBORw0KGgo[A-Za-z0-9+/=]+/g;
  const jpgRegex = /\/9j\/[A-Za-z0-9+/=]+/g;
  const matches = [...(content.match(pngRegex) || []), ...(content.match(jpgRegex) || [])];

  return matches.map((base64, index) => {
    const mimeType = detectMimeFromBase64(base64);
    const resourceKey = resourceKeys[index] || null;
    const displayName = resourceKey
      ? resourceKey.replace(/\.Image$/, "")
      : `embedded-image-${index + 1}`;

    return {
      name: displayName,
      controlType: "XRPictureBox",
      source: "embedded",
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

function findResourceKeysInBinary(buffer, resourceKeys) {
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

function findFirstImageOffset(buffer) {
  const png = indexOfBytes(buffer, PNG_SIGNATURE);
  const jpg = indexOfBytes(buffer, JPEG_SIGNATURE);
  if (png === -1) return jpg;
  if (jpg === -1) return png;
  return Math.min(png, jpg);
}

function extractBinaryImages(buffer) {
  const images = [];
  let position = 0;

  while (position < buffer.length) {
    const pngStart = indexOfBytes(buffer, PNG_SIGNATURE, position);
    const jpgStart = indexOfBytes(buffer, JPEG_SIGNATURE, position);

    let start = -1;
    let mimeType = "image/png";

    if (pngStart === -1 && jpgStart === -1) break;
    if (pngStart === -1 || (jpgStart !== -1 && jpgStart < pngStart)) {
      start = jpgStart;
      mimeType = "image/jpeg";
    } else {
      start = pngStart;
      mimeType = "image/png";
    }

    const chunk =
      mimeType === "image/png"
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

function extractPngChunk(buffer, start) {
  const end = indexOfBytes(buffer, PNG_IEND, start);
  if (end === -1) return null;
  return buffer.subarray(start, end + PNG_IEND.length);
}

function extractJpegChunk(buffer, start) {
  let end = start + 3;
  while (end < buffer.length - 1) {
    if (buffer[end] === 0xff && buffer[end + 1] === 0xd9) {
      return buffer.subarray(start, end + 2);
    }
    end += 1;
  }
  return null;
}

function mapKeysToImages(resourceKeys, images) {
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
      displayName: resourceKeys[index].replace(/\.Image$/, ""),
      ...image,
    }));
  }

  return sortedImages.map((image, index) => {
    const resourceKey = resourceKeys[index] || null;
    return {
      resourceKey,
      displayName: resourceKey
        ? resourceKey.replace(/\.Image$/, "")
        : `embedded-image-${index + 1}`,
      ...image,
    };
  });
}

function decodeBase64(base64) {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ByteLength(base64) {
  const normalized = base64.replace(/\s/g, "");
  const padding = normalized.endsWith("==")
    ? 2
    : normalized.endsWith("=")
      ? 1
      : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function indexOfBytes(haystack, needle, from = 0) {
  if (!needle.length || haystack.length < needle.length) return -1;

  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }

  return -1;
}

function utf16leBytes(value) {
  const bytes = new Uint8Array(value.length * 2);
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = code >> 8;
  }
  return bytes;
}
