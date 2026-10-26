"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

import {
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_KIND_LABELS,
  createTemplateItem,
  type Template,
  type TemplateCategory,
  type TemplateItem,
  type TemplateItemKind,
  type TemplateKind,
} from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import { useOS } from "@/store/use-os";

const CATEGORY_ORDER: TemplateCategory[] = [
  "work",
  "personal",
  "planning",
  "finance",
  "health",
  "learning",
  "productivity",
  "projects",
];

const ITEM_KINDS: TemplateItemKind[] = [
  "task",
  "habit",
  "goal",
  "project",
  "note",
  "routine",
];

const PRIORITIES = [
  { value: 0, label: "None" },
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
  { value: 4, label: "Urgent" },
];

function emptyItem(): TemplateItem {
  return createTemplateItem({ kind: "task", title: "New item" });
}

export function TemplateEditorDialog({
  open,
  template,
  onClose,
}: {
  open: boolean;
  template: Template | null;
  onClose: () => void;
}) {
  const os = useOS();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<TemplateCategory>("productivity");
  const [kind, setKind] = React.useState<TemplateKind>("planner");
  const [items, setItems] = React.useState<TemplateItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    setCategory(template?.category ?? "productivity");
    setKind(template?.templateKind ?? "planner");
    setItems(
      template
        ? template.items.map((item) => ({ ...item }))
        : [emptyItem()],
    );
    setError(null);
  }, [open, template]);

  const updateItem = (index: number, patch: Partial<TemplateItem>) => {
    setItems((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  };

  const save = () => {
    if (!name.trim()) {
      setError("Give the template a name");
      return;
    }
    const cleaned = items
      .map((item) => ({ ...item, title: item.title.trim() }))
      .filter((item) => item.title.length > 0);
    if (cleaned.length === 0) {
      setError("Add at least one item with a title");
      return;
    }
    const input = {
      name: name.trim(),
      target: template?.target ?? "task",
      title: name.trim(),
      body: description.trim(),
      description: description.trim() || "A custom template you made.",
      category,
      templateKind: kind,
      icon: template?.icon ?? "sparkles",
      builtin: false,
      source: "custom" as const,
      tags: [category, kind],
      items: cleaned,
    };
    if (template) {
      os.updateTemplate(template.id, input);
      toast(`Updated "${input.name}"`, { tone: "success" });
    } else {
      os.addTemplate(input);
      toast(`Created "${input.name}"`, { tone: "success" });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "Edit template" : "New template"}
      description="Templates turn a repeatable plan into real tasks, habits, goals and notes."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} data-testid="template-editor-save">
            {template ? "Save changes" : "Create template"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger" data-testid="template-editor-error">
            {error}
          </p>
        ) : null}

        <div>
          <FieldLabel htmlFor="template-editor-name">Name</FieldLabel>
          <Input
            id="template-editor-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Weekly client check-in"
          />
        </div>

        <div>
          <FieldLabel htmlFor="template-editor-description">Description</FieldLabel>
          <Textarea
            id="template-editor-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this template for?"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="template-editor-category">Category</FieldLabel>
            <Select
              id="template-editor-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as TemplateCategory)}
            >
              {CATEGORY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {TEMPLATE_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="template-editor-kind">Type</FieldLabel>
            <Select
              id="template-editor-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as TemplateKind)}
            >
              {Object.entries(TEMPLATE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <FieldLabel>Items</FieldLabel>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setItems((current) => [...current, emptyItem()])}
              data-testid="template-editor-add-item"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add item
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="rounded-xl border border-line p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={item.kind}
                    onChange={(event) =>
                      updateItem(index, { kind: event.target.value as TemplateItemKind })
                    }
                    aria-label={`Item ${index + 1} kind`}
                    className="w-28"
                  >
                    {ITEM_KINDS.map((value) => (
                      <option key={value} value={value}>
                        {value[0]!.toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={item.title}
                    onChange={(event) => updateItem(index, { title: event.target.value })}
                    placeholder="Item title"
                    aria-label={`Item ${index + 1} title`}
                    className="min-w-40 flex-1"
                  />
                  <Select
                    value={String(item.priority)}
                    onChange={(event) =>
                      updateItem(index, {
                        priority: Number(event.target.value) as TemplateItem["priority"],
                      })
                    }
                    aria-label={`Item ${index + 1} priority`}
                    className="w-28"
                  >
                    {PRIORITIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) => current.filter((_, position) => position !== index))
                    }
                    aria-label={`Remove item ${index + 1}`}
                    className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <Input
                  value={item.detail}
                  onChange={(event) => updateItem(index, { detail: event.target.value })}
                  placeholder="Optional detail"
                  aria-label={`Item ${index + 1} detail`}
                  className="mt-2 h-8"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
