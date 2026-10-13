import { decodeBase64, encodeBase64 } from "./binary";

const SCHEMA_FIELDS = ["CCCDan", "MDVQHNSach", "SHChieu"];
const CAPTION_WIDTH = 780;
const DEFAULT_ROW_HEIGHT = 60.58325;

function newlineOf(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function fmt(value) {
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function read7Bit(bytes, offset) {
  let value = 0;
  let shift = 0;
  let index = offset;
  while (index < bytes.length) {
    const byte = bytes[index];
    index += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value, next: index, size: index - offset };
    }
    shift += 7;
  }
  throw new Error("Resource REPX bị hỏng: không đọc được độ dài chuỗi.");
}

function encode7Bit(value) {
  const out = [];
  let remaining = value;
  while (remaining >= 0x80) {
    out.push((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }
  out.push(remaining);
  return out;
}

function readInt32(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function writeInt32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function parseResourceEntries(bytes) {
  if (
    bytes.length < 12 ||
    bytes[0] !== 0xce ||
    bytes[1] !== 0xca ||
    bytes[2] !== 0xef ||
    bytes[3] !== 0xbe
  ) {
    throw new Error("Không tìm thấy resource schema trong file REPX.");
  }

  const skip = readInt32(bytes, 8);
  let index = 12 + skip;
  const version = readInt32(bytes, index);
  index += 4;
  if (version !== 2) {
    throw new Error(`Resource REPX phiên bản ${version} chưa được hỗ trợ.`);
  }

  const resourceCount = readInt32(bytes, index);
  index += 4;
  const typeCount = readInt32(bytes, index);
  index += 4;
  for (let i = 0; i < typeCount; i += 1) {
    const typeName = read7Bit(bytes, index);
    index = typeName.next + typeName.value;
  }
  if (index % 8 !== 0) index += 8 - (index % 8);

  index += resourceCount * 4;
  const namePositions = [];
  for (let i = 0; i < resourceCount; i += 1) {
    namePositions.push(readInt32(bytes, index));
    index += 4;
  }
  const dataSection = readInt32(bytes, index);
  index += 4;
  const nameSection = index;

  const entries = [];
  for (const position of namePositions) {
    let cursor = nameSection + position;
    const nameLength = read7Bit(bytes, cursor);
    cursor = nameLength.next + nameLength.value;
    entries.push({
      dataOffset: readInt32(bytes, cursor),
      dataOffsetPos: cursor,
    });
  }
  return { entries, dataSection };
}

function insertSchemaFields(schema) {
  const buyerStart = schema.indexOf('name="NMua"');
  if (buyerStart < 0) {
    throw new Error("Schema không có nhóm NMua.");
  }
  const sequenceEnd = schema.indexOf("</xs:sequence>", buyerStart);
  if (sequenceEnd < 0) {
    throw new Error("Schema NMua không có xs:sequence.");
  }

  const buyer = schema.slice(buyerStart, sequenceEnd);
  const missing = SCHEMA_FIELDS.filter(
    (name) => !buyer.includes(`name="${name}"`),
  );
  if (!missing.length) {
    return { schema, added: [] };
  }

  const indent =
    buyer.match(/\r?\n([ \t]*)<xs:element /)?.[1] || "                          ";
  const schemaNewline = schema.includes("\r\n") ? "\r\n" : "\n";
  const insertion = missing
    .map(
      (name) =>
        `${indent}<xs:element name="${name}" type="xs:string" minOccurs="0" />${schemaNewline}`,
    )
    .join("");

  return {
    schema: schema.slice(0, sequenceEnd) + insertion + schema.slice(sequenceEnd),
    added: missing,
  };
}

function indexOfBytes(bytes, text, from = 0) {
  const needle = new TextEncoder().encode(text);
  outer: for (let i = from; i <= bytes.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function locateSchema(bytes) {
  const marker = '<?xml version="1.0"?>';
  let from = 0;
  while (from < bytes.length) {
    const xmlStart = indexOfBytes(bytes, marker, from);
    if (xmlStart < 0) return null;
    for (const size of [1, 2, 3]) {
      const lengthOffset = xmlStart - size;
      if (lengthOffset <= 0) continue;
      let length;
      try {
        length = read7Bit(bytes, lengthOffset);
      } catch {
        continue;
      }
      if (
        length.size === size &&
        length.next === xmlStart &&
        bytes[lengthOffset - 1] === 0x01
      ) {
        return { xmlStart, lengthOffset, length };
      }
    }
    from = xmlStart + marker.length;
  }
  return null;
}

function patchSchemaResource(bytes) {
  const located = locateSchema(bytes);
  if (!located) {
    throw new Error("Không tìm thấy schema XML trong file REPX.");
  }
  const { xmlStart, lengthOffset, length } = located;

  const oldSchema = new TextDecoder().decode(
    bytes.subarray(xmlStart, xmlStart + length.value),
  );
  const updated = insertSchemaFields(oldSchema);
  if (!updated.added.length) {
    return { bytes, added: [] };
  }

  const schemaBytes = new TextEncoder().encode(updated.schema);
  const newLength = encode7Bit(schemaBytes.length);
  const delta =
    schemaBytes.length - length.value + (newLength.length - length.size);
  const { entries, dataSection } = parseResourceEntries(bytes);
  const schemaEntry = entries.find(
    (entry) => dataSection + entry.dataOffset === lengthOffset - 1,
  );
  if (!schemaEntry) {
    throw new Error("Không xác định được resource schema để cập nhật offset.");
  }

  const next = new Uint8Array(bytes.length + delta);
  next.set(bytes.subarray(0, lengthOffset), 0);
  next.set(newLength, lengthOffset);
  const schemaAt = lengthOffset + newLength.length;
  next.set(schemaBytes, schemaAt);
  next.set(bytes.subarray(xmlStart + length.value), schemaAt + schemaBytes.length);

  for (const entry of entries) {
    if (entry.dataOffset > schemaEntry.dataOffset) {
      writeInt32(next, entry.dataOffsetPos, entry.dataOffset + delta);
    }
  }

  return { bytes: next, added: updated.added };
}

function replaceResourceBlock(text, bytes) {
  const match = text.match(
    /(\/\/\/\s*<Resource Name="[^"]+">\r?\n)([\s\S]*?)(<\/Resource>)/,
  );
  if (!match) {
    throw new Error("Không tìm thấy khối resource của file REPX.");
  }

  const encoded = encodeBase64(bytes);
  const lines = [];
  for (let i = 0; i < encoded.length; i += 500) {
    lines.push(`/// ${encoded.slice(i, i + 500)}`);
  }
  const nl = newlineOf(text);
  const last = lines.pop() || "/// ";
  return (
    text.slice(0, match.index) +
    match[1] +
    lines.join(nl) +
    (lines.length ? nl : "") +
    last +
    "</Resource>" +
    text.slice(match.index + match[0].length)
  );
}

function controlNameBefore(text, index) {
  const before = text.slice(0, index);
  const marks = [...before.matchAll(/\/\/ (\w+)\r?\n\s*\/\/\s*\r?\n/g)];
  return marks.length ? marks[marks.length - 1][1] : null;
}

function readLocation(text, name) {
  const match = text.match(
    new RegExp(
      `this\\.${name}\\.LocationFloat = new DevExpress\\.Utils\\.PointFloat\\(([-\\d.]+)F,\\s*([-\\d.]+)F\\)`,
    ),
  );
  if (!match) return null;
  const size = text.match(
    new RegExp(
      `this\\.${name}\\.SizeF = new System\\.Drawing\\.SizeF\\(([-\\d.]+)F,\\s*([-\\d.]+)F\\)`,
    ),
  );
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: size ? Number(size[1]) : null,
    height: size ? Number(size[2]) : DEFAULT_ROW_HEIGHT,
  };
}

function pageHeaderChildren(text) {
  const match = text.match(
    /this\.PageHeader\.Controls\.AddRange\(new DevExpress\.XtraReports\.UI\.XRControl\[\] \{([\s\S]*?)\}\);/,
  );
  if (!match) return [];
  return [...match[1].matchAll(/this\.(\w+)/g)].map((item) => item[1]);
}

function nextLabelNames(text, count) {
  const used = new Set(
    [...text.matchAll(/\b(label\d+)\b/g)].map((item) => item[1]),
  );
  let number = 1;
  const names = [];
  while (names.length < count) {
    const name = `label${number}`;
    if (!used.has(name)) names.push(name);
    number += 1;
  }
  return names;
}

function labelCode(nl, name, options) {
  const lines = [`            // `, `            // ${name}`, `            // `];
  if (options.binding) {
    lines.push(
      `            this.${name}.BorderColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(192)))), ((int)(((byte)(192)))));`,
      `            this.${name}.BorderDashStyle = DevExpress.XtraPrinting.BorderDashStyle.Dot;`,
      `            this.${name}.Borders = DevExpress.XtraPrinting.BorderSide.Bottom;`,
      `            this.${name}.DataBindings.AddRange(new DevExpress.XtraReports.UI.XRBinding[] {`,
      `                        new DevExpress.XtraReports.UI.XRBinding("Text", null, "${options.binding}")});`,
    );
  }
  lines.push(
    `            this.${name}.Dpi = 254F;`,
    options.italic
      ? `            this.${name}.Font = new System.Drawing.Font("Times New Roman", 9F, System.Drawing.FontStyle.Italic);`
      : `            this.${name}.Font = new System.Drawing.Font("Times New Roman", 10F);`,
    `            this.${name}.ForeColor = System.Drawing.Color.Black;`,
    `            this.${name}.LocationFloat = new DevExpress.Utils.PointFloat(${fmt(options.x)}F, ${fmt(options.y)}F);`,
    `            this.${name}.Name = "${name}";`,
    `            this.${name}.Padding = new DevExpress.XtraPrinting.PaddingInfo(5, 5, 0, 0, 254F);`,
    `            this.${name}.SizeF = new System.Drawing.SizeF(${fmt(options.width)}F, ${fmt(options.height)}F);`,
  );
  if (options.binding) {
    lines.push(
      `            this.${name}.StylePriority.UseBorderColor = false;`,
      `            this.${name}.StylePriority.UseBorderDashStyle = false;`,
      `            this.${name}.StylePriority.UseBorders = false;`,
    );
  }
  lines.push(
    `            this.${name}.StylePriority.UseFont = false;`,
    `            this.${name}.StylePriority.UseForeColor = false;`,
    `            this.${name}.StylePriority.UseTextAlignment = false;`,
    `            this.${name}.Text = "${options.text}";`,
    `            this.${name}.TextAlignment = DevExpress.XtraPrinting.TextAlignment.MiddleLeft;`,
  );
  return lines.join(nl);
}

function shiftControl(text, name, delta) {
  return text.replace(
    new RegExp(
      `(this\\.${name}\\.LocationFloat = new DevExpress\\.Utils\\.PointFloat\\(([-\\d.]+)F,\\s*)([-\\d.]+)F`,
    ),
    (_match, prefix, _x, y) => `${prefix}${fmt(Number(y) + delta)}F`,
  );
}

function readCaption(text, name) {
  const location = readLocation(text, name);
  if (!location?.width) return null;
  const match = text.match(
    new RegExp(`this\\.${name}\\.Text = "((?:\\\\.|[^"\\\\])*)"`),
  );
  if (!match) return null;
  const caption = match[1].replace(/\\'/g, "'");
  if (!caption || /^label\d+$/i.test(caption) || caption.startsWith("[")) return null;
  if (text.includes(`this.${name}.DataBindings`)) return null;
  const italic = new RegExp(
    `this\\.${name}\\.Font = new System\\.Drawing\\.Font\\([^;]*Italic`,
  ).test(text);
  return { name, ...location, text: caption, italic };
}

function textWeight(value) {
  let weight = 0;
  for (const char of value) {
    if (char === " ") weight += 0.35;
    else if (/[()/:]/.test(char)) weight += 0.42;
    else if (char.toLowerCase() !== char.toUpperCase() && char === char.toUpperCase()) {
      weight += 1.15;
    } else weight += 0.68;
  }
  return weight;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function widthScale(labels) {
  const ratios = labels
    .filter((label) => label.text && label.width && textWeight(label.text) > 0)
    .map((label) => label.width / textWeight(label.text));
  return median(ratios);
}

function hasSplitEnglishCaptions(text) {
  return (
    /FontStyle\.Italic[\s\S]{0,600}\.Text = "\([^"]+\):"/.test(text) ||
    /\.Text = "\([^"]+\):"[\s\S]{0,600}FontStyle\.Italic/.test(text)
  );
}

function patchLayout(text) {
  const hasCccd = text.includes('"NMua.CCCDan"');
  const hasQhns = text.includes('"NMua.MDVQHNSach"');
  if (hasCccd && hasQhns) {
    return { text, addedLabels: false };
  }

  const mstIndex = text.indexOf('"NMua.MST"');
  if (mstIndex < 0) {
    throw new Error("Mẫu này không có trường Mã số thuế người mua (NMua.MST).");
  }
  const mstName = controlNameBefore(text, mstIndex);
  const mst = mstName ? readLocation(text, mstName) : null;
  if (!mst) {
    throw new Error("Không đọc được vị trí ô Mã số thuế người mua.");
  }

  const rowHeight = mst.height || DEFAULT_ROW_HEIGHT;
  const splitEnglish = hasSplitEnglishCaptions(text);
  const rows = [];
  if (!hasCccd) {
    rows.push({
      vn: "CCCD/ định danh cá nhân",
      en: "(Identity card):",
      caption: "CCCD/ định danh cá nhân: (Identity card)",
      binding: "NMua.CCCDan",
    });
  }
  if (!hasQhns) {
    rows.push({
      vn: "Mã ĐV có QNHS",
      en: "(Budget unit code):",
      caption: "Mã ĐV có QNHS: (Budget unit code)",
      binding: "NMua.MDVQHNSach",
    });
  }

  const headerNames = pageHeaderChildren(text);
  const children = headerNames
    .map((name) => ({ name, location: readLocation(text, name) }))
    .filter((item) => item.location);
  const captions = headerNames
    .map((name) => readCaption(text, name))
    .filter(Boolean);
  const englishCaptions = captions.filter(
    (label) => label.italic && /^\(.*\):$/.test(label.text),
  );
  const pairs = englishCaptions
    .map((en) => {
      const vn = captions
        .filter(
          (label) =>
            !label.italic &&
            label.x < en.x &&
            Math.abs(label.y - en.y) < 2,
        )
        .sort((a, b) => b.x - a.x)[0];
      return vn ? { vn, en } : null;
    })
    .filter(Boolean);
  const vnScale = widthScale(pairs.map((pair) => pair.vn)) || widthScale(captions.filter((label) => !label.italic)) || 28;
  const enScale = widthScale(pairs.map((pair) => pair.en)) || vnScale * 0.9;
  const widthFor = (value, scale) => Math.ceil(textWeight(value) * scale + 12);

  const table = children
    .filter(
      (item) =>
        item.name.toLowerCase().includes("table") && item.location.y >= mst.y - 1,
    )
    .sort((a, b) => a.location.y - b.location.y)[0];
  const rowCeiling = table ? table.location.y - 0.5 : Number.POSITIVE_INFINITY;
  const buyerCaptions = captions.filter(
    (label) => label.y >= mst.y - 1 && label.y < rowCeiling,
  );
  const anchorY = buyerCaptions.reduce((max, label) => Math.max(max, label.y), mst.y);
  const anchorRow = buyerCaptions
    .filter((label) => !label.italic && Math.abs(label.y - anchorY) < 2)
    .sort((a, b) => a.x - b.x);
  const captionX = anchorRow[0]?.x ?? 44.5379;
  const rowTops = [...new Set(buyerCaptions.map((label) => Math.round(label.y * 10) / 10))].sort(
    (a, b) => a - b,
  );
  const rowGaps = rowTops.slice(1).map((y, index) => y - rowTops[index]).filter((gap) => gap > 20);
  const rowPitch = median(rowGaps) || rowHeight;
  const below = children.filter((item) => item.location.y > anchorY + 0.5);
  const rightEdge = table?.location
    ? table.location.x + (table.location.width || 0)
    : captionX + CAPTION_WIDTH + 1457.723;

  const delta = rowPitch * rows.length;
  const nl = newlineOf(text);
  const labelsPerRow = splitEnglish ? 3 : 2;
  const names = nextLabelNames(text, rows.length * labelsPerRow);

  let next = text;
  for (const item of below) {
    next = shiftControl(next, item.name, delta);
  }
  next = next.replace(
    /this\.PageHeader\.HeightF = ([-.\d]+)F;/,
    (_, height) => `this.PageHeader.HeightF = ${fmt(Number(height) + delta)}F;`,
  );
  if (!text.includes("this.PageHeader.HeightF")) {
    throw new Error("Không tìm thấy PageHeader để chèn thêm dòng.");
  }

  const blocks = [];
  const declarations = [];
  const constructors = [];
  const addNames = [];
  let nameIndex = 0;
  const claimName = () => {
    const name = names[nameIndex];
    nameIndex += 1;
    declarations.push(`        private DevExpress.XtraReports.UI.XRLabel ${name};`);
    constructors.push(
      `            this.${name} = new DevExpress.XtraReports.UI.XRLabel();`,
    );
    addNames.push(`                        this.${name},`);
    return name;
  };

  rows.forEach((row, index) => {
    const y = anchorY + rowPitch * (index + 1);
    if (splitEnglish) {
      const vnWidth = widthFor(row.vn, vnScale);
      const enWidth = widthFor(row.en, enScale);
      const enX = captionX + vnWidth + 4;
      const valueX = enX + enWidth;
      const vnName = claimName();
      const enName = claimName();
      const valueName = claimName();
      blocks.push(
        labelCode(nl, vnName, {
          text: row.vn,
          x: captionX,
          y,
          width: vnWidth,
          height: rowHeight,
        }),
        labelCode(nl, enName, {
          text: row.en,
          italic: true,
          x: enX,
          y,
          width: enWidth,
          height: rowHeight,
        }),
        labelCode(nl, valueName, {
          text: "",
          binding: row.binding,
          x: valueX,
          y,
          width: Math.max(200, rightEdge - valueX),
          height: rowHeight,
        }),
      );
      return;
    }

    const captionName = claimName();
    const valueName = claimName();
    const captionWidth = widthFor(row.caption, vnScale);
    const valueX = captionX + captionWidth;
    blocks.push(
      labelCode(nl, captionName, {
        text: row.caption,
        x: captionX,
        y,
        width: captionWidth,
        height: rowHeight,
      }),
      labelCode(nl, valueName, {
        text: "",
        binding: row.binding,
        x: valueX,
        y,
        width: Math.max(200, rightEdge - valueX),
        height: rowHeight,
      }),
    );
  });

  const initAt = next.indexOf("private void InitializeComponent()");
  if (initAt < 0) {
    throw new Error("File REPX không có InitializeComponent.");
  }
  next = `${next.slice(0, initAt)}${declarations.join(nl)}${nl}        ${next.slice(initAt)}`;

  next = next.replace(
    /(private void InitializeComponent\(\) \{\r?\n)/,
    `$1${constructors.join(nl)}${nl}`,
  );
  next = next.replace(
    /(this\.PageHeader\.Controls\.AddRange\(new DevExpress\.XtraReports\.UI\.XRControl\[\] \{\r?\n)/,
    `$1${addNames.join(nl)}${nl}`,
  );

  const headerAt = next.search(/\r?\n\s*\/\/\s*\r?\n\s*\/\/ PageHeader\r?\n\s*\/\/\s*\r?\n/);
  if (headerAt < 0) {
    throw new Error("Không tìm thấy khối PageHeader.");
  }
  next = `${next.slice(0, headerAt)}${nl}${blocks.join(nl)}${next.slice(headerAt)}`;

  return { text: next, addedLabels: true, rows: rows.map((row) => row.binding) };
}

export function patchRepxQhnsCccd(text) {
  if (!text.includes("XtraReport") && !text.includes("<XRTypeInfo>")) {
    throw new Error("File không phải REPX CodeDOM của DevExpress.");
  }

  const resource = text.match(
    /\/\/\/\s*<Resource Name="[^"]+">\r?\n([\s\S]*?)<\/Resource>/,
  );
  if (!resource) {
    throw new Error("File REPX không có resource schema.");
  }
  const base64 = resource[1].replace(/^\/\/\/\s*/gm, "").replace(/\s+/g, "");
  const patchedResource = patchSchemaResource(decodeBase64(base64));
  let next = replaceResourceBlock(text, patchedResource.bytes);
  const layout = patchLayout(next);
  next = layout.text;

  return {
    text: next,
    schemaFields: patchedResource.added,
    layoutFields: layout.rows || [],
    alreadyHadLayout: !layout.addedLabels,
  };
}

export async function patchRepxQhnsCccdFile(file) {
  const text = await file.text();
  const patched = patchRepxQhnsCccd(text);
  const baseName = file.name.replace(/\.repx$/i, "");
  return {
    ...patched,
    fileName: `${baseName}-qhns-cccd.repx`,
  };
}
