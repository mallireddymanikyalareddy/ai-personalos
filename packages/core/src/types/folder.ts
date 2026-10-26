import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";
import type { ID, Timestamp } from "./common";

export type FolderStatus = "active" | "archived" | "trashed";

export interface NewFolderInput extends CanonicalInput {
  name: string;
  parentId?: ID | null;
  notebookId?: ID | null;
  color?: string | null;
  icon?: string | null;
  order?: number;
}

export interface Folder extends CanonicalEntity {
  type: "folder";
  name: string;
  parentId: ID | null;
  notebookId: ID | null;
  color: string | null;
  icon: string | null;
  order: number;
  status: FolderStatus;
  trashedAt: Timestamp | null;
}

export function createFolder(input: NewFolderInput, now: Timestamp = Date.now()): Folder {
  return {
    ...createCanonicalBase(input, now),
    type: "folder",
    name: input.name.trim(),
    parentId: input.parentId ?? null,
    notebookId: input.notebookId ?? null,
    color: input.color ?? null,
    icon: input.icon ?? null,
    order: input.order ?? now,
    status: "active",
    trashedAt: null,
  };
}

export function moveFolderToTrash(folder: Folder, now: Timestamp = Date.now()): Folder {
  return {
    ...folder,
    status: "trashed",
    trashedAt: now,
    updatedAt: now,
  } as Folder;
}

export function restoreFolder(folder: Folder, now: Timestamp = Date.now()): Folder {
  return {
    ...folder,
    status: "active",
    trashedAt: null,
    updatedAt: now,
  } as Folder;
}

export function getFolderPath(state: { folders: Record<string, Folder> }, folderId: ID): Folder[] {
  const path: Folder[] = [];
  let current: Folder | null = state.folders[folderId] ?? null;
  while (current) {
    path.unshift(current);
    current = current.parentId ? state.folders[current.parentId] ?? null : null;
  }
  return path;
}

export function getDescendantFolderIds(state: { folders: Record<string, Folder> }, folderId: ID): ID[] {
  const descendants: ID[] = [];
  for (const folder of Object.values(state.folders)) {
    let current = folder.parentId;
    while (current) {
      if (current === folderId) {
        descendants.push(folder.id);
        break;
      }
      current = state.folders[current]?.parentId ?? null;
    }
  }
  return descendants;
}