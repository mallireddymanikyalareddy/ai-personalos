import { describe, expect, it } from "vitest";

import { findJsonEntry, readZip, zipEntryText } from "./zip";

function storedZip(name: string, content: string): File {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name);
  const data = encoder.encode(content);

  const local = new Uint8Array(30 + nameBytes.length + data.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, 0, true);
  localView.setUint32(18, data.length, true);
  localView.setUint32(22, data.length, true);
  localView.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  local.set(data, 30 + nameBytes.length);

  const central = new Uint8Array(46 + nameBytes.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, 0, true);
  centralView.setUint32(20, data.length, true);
  centralView.setUint32(24, data.length, true);
  centralView.setUint16(28, nameBytes.length, true);
  centralView.setUint32(42, 0, true);
  central.set(nameBytes, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);

  const bytes = new Uint8Array(local.length + central.length + end.length);
  bytes.set(local, 0);
  bytes.set(central, local.length);
  bytes.set(end, local.length + central.length);

  return new File([bytes], "template.zip", { type: "application/zip" });
}

describe("zip template import", () => {
  it("reads a JSON template out of a stored ZIP", async () => {
    const entries = await readZip(storedZip("template.json", '{"name":"Zipped template"}'));

    const json = findJsonEntry(entries);
    expect(json).not.toBeNull();
    expect(zipEntryText(json!)).toBe('{"name":"Zipped template"}');
  });
});