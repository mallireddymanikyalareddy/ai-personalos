import type { EntityMeta, EntityType, ID, Timestamp } from "./common";
import { newId } from "./common";

export type AttachmentSource = "upload" | "link";

export interface Attachment extends EntityMeta {
  type: "attachment";
  ownerType: EntityType;
  ownerId: ID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  source: AttachmentSource;
  url: string | null;
}

export interface NewAttachmentInput {
  ownerType: EntityType;
  ownerId: ID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  source?: AttachmentSource;
  url?: string | null;
}

export function createAttachment(input: NewAttachmentInput, now: Timestamp = Date.now()): Attachment {
  return {
    type: "attachment",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    name: input.name,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    source: input.source ?? "upload",
    url: input.url ?? null,
  };
}
