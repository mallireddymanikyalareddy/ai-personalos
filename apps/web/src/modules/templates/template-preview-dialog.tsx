"use client";

import * as React from "react";

import { Sparkles } from "lucide-react";

import {
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_KIND_LABELS,
  type Template,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useOS } from "@/store/use-os";

export function TemplatePreviewDialog({
  template,
  onClose,
}: {
  template: Template | null;
  onClose: () => void;
}) {
  const os = useOS();
  const { toast } = useToast();

  const use = () => {
    if (!template) return;
    const result = os.useTemplate(template.id);
    toast(result.message, { tone: result.ok ? "success" : "danger" });
    onClose();
  };

  return (
    <Modal
      open={template != null}
      onClose={onClose}
      title={template?.name ?? "Template"}
      description={template?.description}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={use} data-testid="template-preview-use">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Use template
          </Button>
        </div>
      }
    >
      {template ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{TEMPLATE_CATEGORY_LABELS[template.category]}</Badge>
            <Badge tone="outline">{TEMPLATE_KIND_LABELS[template.templateKind]}</Badge>
            <Badge tone="neutral">
              {template.items.length} item{template.items.length === 1 ? "" : "s"}
            </Badge>
            {template.builtin ? <Badge tone="outline">Built-in</Badge> : null}
          </div>

          {template.items.length === 0 ? (
            <p className="text-sm text-ink-3">This template has no items yet.</p>
          ) : (
            <ul className="space-y-2">
              {template.items.map((item, index) => (
                <li
                  key={`${item.kind}-${item.title}-${index}`}
                  className="rounded-xl border border-line p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{item.kind}</Badge>
                    <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                      {item.title}
                    </span>
                    {item.priority > 0 ? (
                      <Badge tone={item.priority >= 3 ? "danger" : "warning"}>
                        Priority {item.priority}
                      </Badge>
                    ) : null}
                  </div>
                  {item.detail ? (
                    <p className="mt-1 text-[12px] leading-snug text-ink-3">{item.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {template.tags.length > 0 ? (
            <p className="text-[11px] text-ink-3">Tags: {template.tags.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
