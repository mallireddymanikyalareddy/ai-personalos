import type { EntityType, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";

export type TagStatus = "active" | "archived";

export interface NewTagInput extends CanonicalInput {
  name: string;
  color?: string | null;
}

export interface Tag extends CanonicalEntity {
  type: "tag";
  name: string;
  color: string | null;
  usageCount: number;
  status: TagStatus;
}

export function createTag(input: NewTagInput, now: Timestamp = Date.now()): Tag {
  return {
    ...createCanonicalBase(input, now),
    type: "tag",
    name: input.name.trim().toLowerCase(),
    color: input.color ?? null,
    usageCount: 0,
    status: "active",
  };
}

export type CategoryStatus = "active" | "archived";

export interface NewCategoryInput extends CanonicalInput {
  name: string;
  parentId?: string | null;
  description?: string;
  color?: string | null;
  entityTypes?: EntityType[];
}

export interface Category extends CanonicalEntity {
  type: "category";
  name: string;
  parentId: string | null;
  description: string;
  color: string | null;
  entityTypes: EntityType[];
  status: CategoryStatus;
}

export function createCategory(input: NewCategoryInput, now: Timestamp = Date.now()): Category {
  return {
    ...createCanonicalBase(input, now),
    type: "category",
    name: input.name.trim(),
    parentId: input.parentId ?? null,
    description: input.description ?? "",
    color: input.color ?? null,
    entityTypes: input.entityTypes ?? ["task"],
    status: "active",
  };
}
