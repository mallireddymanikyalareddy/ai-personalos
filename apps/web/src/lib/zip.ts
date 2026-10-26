const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

interface CentralEntry {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(buffer: ArrayBuffer, view: DataView): number {
  const minimum = Math.max(0, buffer.byteLength - 65_557);
  for (let offset = buffer.byteLength - 22; offset >= minimum; offset -= 1) {
    if (u32(view, offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function readCentralDirectory(buffer: ArrayBuffer): CentralEntry[] {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(buffer, view);
  if (eocd < 0) return [];

  const count = u16(view, eocd + 10);
  let cursor = u32(view, eocd + 16);
  const entries: CentralEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.byteLength || u32(view, cursor) !== CENTRAL_SIGNATURE) break;
    const compression = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localHeaderOffset = u32(view, cursor + 42);
    const name = new TextDecoder().decode(
      new Uint8Array(buffer, cursor + 46, nameLength),
    );
    entries.push({ name, compression, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readCompressedData(buffer: ArrayBuffer, entry: CentralEntry): Uint8Array | null {
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

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(
      new DecompressionStream("deflate-raw"),
    );
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** Reads every stored/deflated file inside a ZIP archive. */
export async function readZip(file: File): Promise<ZipEntry[]> {
  const buffer = await file.arrayBuffer();
  const entries = readCentralDirectory(buffer);
  const result: ZipEntry[] = [];

  for (const entry of entries) {
    if (entry.name.endsWith("/")) continue;
    const data = readCompressedData(buffer, entry);
    if (!data) continue;
    if (entry.compression === 0) {
      result.push({ name: entry.name, bytes: data });
      continue;
    }
    if (entry.compression === 8) {
      const inflated = await inflate(data);
      if (inflated) result.push({ name: entry.name, bytes: inflated });
    }
  }

  return result;
}

export function zipEntryText(entry: ZipEntry): string {
  return new TextDecoder().decode(entry.bytes);
}

/** Finds the first JSON file in a ZIP archive. */
export function findJsonEntry(entries: ZipEntry[]): ZipEntry | null {
  return (
    entries.find((entry) => entry.name.toLowerCase() === "template.json") ??
    entries.find((entry) => entry.name.toLowerCase().endsWith(".json")) ??
    null
  );
}
