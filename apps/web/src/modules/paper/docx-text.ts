const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readCentralDirectory(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = buffer.byteLength - 22; offset >= Math.max(0, buffer.byteLength - 65_557); offset -= 1) {
    if (u32(view, offset) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) return [];

  const count = u16(view, eocd + 10);
  let cursor = u32(view, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.byteLength || u32(view, cursor) !== CENTRAL_SIGNATURE) break;
    const compression = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localHeaderOffset = u32(view, cursor + 42);
    const nameBytes = new Uint8Array(buffer, cursor + 46, nameLength);
    const name = new TextDecoder().decode(nameBytes);
    entries.push({ name, compression, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntryData(buffer: ArrayBuffer, entry: ZipEntry): Uint8Array | null {
  const view = new DataView(buffer);
  const local = entry.localHeaderOffset;
  if (local + 30 > buffer.byteLength || u32(view, local) !== LOCAL_SIGNATURE) return null;
  const nameLength = u16(view, local + 26);
  const extraLength = u16(view, local + 28);
  const start = local + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.byteLength) return null;
  return new Uint8Array(buffer, start, entry.compressedSize);
}

async function inflate(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") return "";
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  const inflated = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(inflated);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function xmlToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1]?.length > 0))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extracts readable text from a .docx file (OOXML) without external dependencies. */
export async function extractDocxText(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const entries = readCentralDirectory(buffer);
    const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
    if (!documentEntry) return "";
    const data = readEntryData(buffer, documentEntry);
    if (!data) return "";
    if (documentEntry.compression === 0) {
      return xmlToText(new TextDecoder().decode(data));
    }
    if (documentEntry.compression !== 8) return "";
    const xml = await inflate(data);
    return xml ? xmlToText(xml) : "";
  } catch {
    return "";
  }
}

/** Extracts plain text from .rtf files. */
export function extractRtfText(raw: string): string {
  return raw
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
