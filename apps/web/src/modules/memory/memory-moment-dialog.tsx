"use client";

import * as React from "react";

import { Heart, Paperclip, Trash2, X } from "lucide-react";

import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABELS,
  type ID,
  type MemoryCategory,
  type MemoryMoment,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import { useOS } from "@/store/use-os";

const MAX_PHOTO_BYTES = 1_500_000;

interface PhotoEntry {
  id: ID | null;
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

function toDateInput(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInput(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return Date.now();
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseCoordinate(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface MemoryMomentDialogSeed {
  title?: string;
  category?: MemoryCategory;
  kind?: MemoryMoment["kind"];
}

export function MemoryMomentDialog({
  open,
  onClose,
  editing,
  seed,
}: {
  open: boolean;
  onClose: () => void;
  editing: MemoryMoment | null;
  seed?: MemoryMomentDialogSeed;
}) {
  const os = useOS();
  const { toast } = useToast();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState("");
  const [category, setCategory] = React.useState<MemoryCategory>("other");
  const [placeName, setPlaceName] = React.useState("");
  const [latitude, setLatitude] = React.useState("");
  const [longitude, setLongitude] = React.useState("");
  const [people, setPeople] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [bookAuthor, setBookAuthor] = React.useState("");
  const [favorite, setFavorite] = React.useState(false);
  const [photos, setPhotos] = React.useState<PhotoEntry[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = React.useState<ID[]>([]);
  const [photoError, setPhotoError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? seed?.title ?? "");
    setDescription(editing?.description ?? "");
    setDate(toDateInput(editing?.happenedAt ?? Date.now()));
    setCategory(editing?.category ?? seed?.category ?? "other");
    setPlaceName(editing?.place?.name ?? "");
    setLatitude(editing?.place?.latitude != null ? String(editing.place.latitude) : "");
    setLongitude(editing?.place?.longitude != null ? String(editing.place.longitude) : "");
    setPeople((editing?.people ?? []).join(", "));
    setTags((editing?.tags ?? []).join(", "));
    setBookAuthor(editing?.bookAuthor ?? "");
    setFavorite(editing?.favorite ?? false);
    setPhotoError(null);
    setRemovedPhotoIds([]);

    const existing = (editing?.attachmentIds ?? [])
      .map((id) => os.getState().attachments[id])
      .filter((attachment): attachment is NonNullable<typeof attachment> => attachment != null && !!attachment.url)
      .map((attachment) => ({
        id: attachment.id,
        url: attachment.url as string,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      }));
    setPhotos(existing);
  }, [open, editing, seed, os]);

  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  const coordinatesValid =
    (lat == null || (lat >= -90 && lat <= 90)) && (lng == null || (lng >= -180 && lng <= 180));
  const coordinatesComplete = lat == null === (lng == null);
  const canSave = title.trim().length > 0 && coordinatesValid && coordinatesComplete;

  const addPhoto = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("That image is over 1.5 MB — pick a smaller one.");
      return;
    }
    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((current) => [
        ...current,
        {
          id: null,
          url: String(reader.result),
          name: file.name,
          mimeType: file.type || "image/*",
          sizeBytes: file.size,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    if (photo.id != null) setRemovedPhotoIds((current) => [...current, photo.id!]);
    setPhotos((current) => current.filter((_, position) => position !== index));
  };

  const save = () => {
    if (!canSave) return;
    const happenedAt = fromDateInput(date);
    const place = placeName.trim().length > 0
      ? { name: placeName.trim(), latitude: lat, longitude: lng }
      : null;

    if (editing) {
      const attachmentIds: ID[] = [];
      for (const photo of photos) {
        if (photo.id != null) {
          attachmentIds.push(photo.id);
          continue;
        }
        const attachment = os.addAttachment({
          ownerType: "memory_moment",
          ownerId: editing.id,
          name: photo.name,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          source: "upload",
          url: photo.url,
        });
        attachmentIds.push(attachment.id);
      }
      os.updateMemoryMoment(editing.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        happenedAt,
        place,
        people: splitList(people),
        tags: splitList(tags),
        bookAuthor: bookAuthor.trim(),
        favorite,
        attachmentIds,
      });
      for (const id of removedPhotoIds) os.deleteAttachment(id);
      toast("Memory updated");
    } else {
      const attachmentIds: ID[] = [];
      const pendingIds: ID[] = [];
      for (const photo of photos) {
        const attachment = os.addAttachment({
          ownerType: "memory_moment",
          ownerId: "pending",
          name: photo.name,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          source: "upload",
          url: photo.url,
        });
        attachmentIds.push(attachment.id);
        pendingIds.push(attachment.id);
      }
      const created = os.addMemoryMoment({
        title: title.trim(),
        description: description.trim(),
        category,
        happenedAt,
        place,
        people: splitList(people),
        tags: splitList(tags),
        bookAuthor: bookAuthor.trim(),
        favorite,
        attachmentIds,
      });
      for (const id of pendingIds) os.updateAttachment(id, { ownerId: created.id });
      toast("Memory added");
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit memory" : "New memory"}
      description="Capture the moment now so future-you can find it instantly."
      footer={
        <>
          {editing ? (
            <Button
              variant="ghost"
              onClick={() => {
                os.deleteMemoryMoment(editing.id);
                toast("Memory moved to trash");
                onClose();
              }}
            >
              <Trash2 className="size-4" />
              Trash
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>
            {editing ? "Save changes" : "Add memory"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="mm-title">What happened?</FieldLabel>
          <Input
            id="mm-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Andaman trip, birthday dinner, finished my novel…"
            autoFocus
          />
        </div>

        <div>
          <FieldLabel htmlFor="mm-desc">Details</FieldLabel>
          <Textarea
            id="mm-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional — what makes this worth remembering?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="mm-date">When</FieldLabel>
            <Input
              id="mm-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="mm-category">Category</FieldLabel>
            <Select
              id="mm-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as MemoryCategory)}
            >
              {MEMORY_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {MEMORY_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="mm-place">Place</FieldLabel>
            {placeName.trim().length > 0 && lat != null && lng != null ? (
              <Badge tone="accent">Plotted on map</Badge>
            ) : null}
          </div>
          <Input
            id="mm-place"
            value={placeName}
            onChange={(event) => setPlaceName(event.target.value)}
            placeholder="Havelock Island, Goa, home…"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="mm-lat">Latitude</FieldLabel>
              <Input
                id="mm-lat"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="11.68"
                inputMode="decimal"
              />
            </div>
            <div>
              <FieldLabel htmlFor="mm-lng">Longitude</FieldLabel>
              <Input
                id="mm-lng"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="92.28"
                inputMode="decimal"
              />
            </div>
          </div>
          {!coordinatesValid ? (
            <p className="text-xs text-danger">Latitude must be -90 to 90 and longitude -180 to 180.</p>
          ) : !coordinatesComplete ? (
            <p className="text-xs text-ink-3">Add both coordinates to plot this place on the map.</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="mm-people">People</FieldLabel>
            <Input
              id="mm-people"
              value={people}
              onChange={(event) => setPeople(event.target.value)}
              placeholder="Priya, Rahul"
            />
          </div>
          <div>
            <FieldLabel htmlFor="mm-tags">Tags</FieldLabel>
            <Input
              id="mm-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="beach, work"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="mm-author">Book author (optional)</FieldLabel>
          <Input
            id="mm-author"
            value={bookAuthor}
            onChange={(event) => setBookAuthor(event.target.value)}
            placeholder="James Clear"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="mm-photos">Photos</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="mm-photos"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent-ink"
            >
              <Paperclip className="size-3.5" />
              Attach photo
            </label>
            <input
              id="mm-photos"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                addPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => setFavorite((current) => !current)}
              aria-pressed={favorite}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                favorite
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line text-ink-2 hover:border-accent hover:text-accent-ink"
              }`}
            >
              <Heart className="size-3.5" />
              Favourite
            </button>
          </div>
          {photoError ? <p className="text-xs text-danger">{photoError}</p> : null}
          {photos.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <li key={`${photo.id ?? "draft"}-${index}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    className="size-16 rounded-lg border border-line object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-surface text-ink-2 shadow-card ring-1 ring-line transition-colors hover:text-danger"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}