"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { useDialog } from "@/hooks/use-dialog";
import { Kbd } from "@/components/ui/kbd";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
  icon?: React.ReactNode;
  group?: string;
  shortcut?: string;
  onSelect?: () => void;
}

export interface CommandMenuProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  emptyText?: string;
  a11yLabel?: string;
  className?: string;
}

interface GroupedItem {
  group: string | null;
  items: { item: CommandItem; index: number }[];
}

function matchTerm(item: CommandItem, term: string): boolean {
  if (item.label.toLowerCase().includes(term)) return true;
  if (item.keywords?.toLowerCase().includes(term)) return true;
  if (item.description?.toLowerCase().includes(term)) return true;
  return false;
}

export function CommandMenu({
  open,
  onClose,
  items,
  placeholder = "Search or jump to…",
  emptyText = "No results found",
  a11yLabel = "Command palette",
  className,
}: CommandMenuProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const { mounted, onKeyDown } = useDialog({ open, onDismiss: onClose, panelRef });
  const listboxId = React.useId();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const term = query.trim().toLowerCase();

  const groups = React.useMemo<GroupedItem[]>(() => {
    const filtered = term ? items.filter((item) => matchTerm(item, term)) : items;
    const out: GroupedItem[] = [];
    for (const item of filtered) {
      const last = out[out.length - 1];
      if (last && last.group === item.group) {
        last.items.push({ item, index: last.items.length });
      } else {
        out.push({ group: item.group ?? null, items: [{ item, index: 0 }] });
      }
    }
    return out;
  }, [items, term]);

  const count = groups.reduce((total, group) => total + group.items.length, 0);

  const offsetFor = (groupIndex: number, itemIndex: number) => {
    let offset = 0;
    for (let i = 0; i < groupIndex; i++) offset += groups[i].items.length;
    return offset + itemIndex;
  };

  React.useEffect(() => {
    setActiveIndex(0);
  }, [term]);

  const activeId = count > 0 ? `${listboxId}-item-${activeIndex}` : undefined;

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (count === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, count - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      let offset = 0;
      let target: CommandItem | undefined;
      for (const group of groups) {
        if (activeIndex < offset + group.items.length) {
          target = group.items[activeIndex - offset].item;
          break;
        }
        offset += group.items.length;
      }
      if (target) {
        event.preventDefault();
        target.onSelect?.();
        onClose();
      }
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in sm:pt-[16vh]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={a11yLabel}
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-float animate-scale-in",
          className,
        )}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            aria-label={a11yLabel}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeId}
            data-autofocus
            className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          <Kbd className="hidden shrink-0 sm:inline-flex">esc</Kbd>
        </div>

        {count > 0 ? (
          <div id={listboxId} role="listbox" aria-label={a11yLabel} className="max-h-80 overflow-y-auto p-1.5">
            {groups.map((group, groupIndex) => (
              <div key={group.group ?? "ungrouped"}>
                {group.group && (
                  <div
                    role="presentation"
                    className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3"
                  >
                    {group.group}
                  </div>
                )}
                {group.items.map(({ item }, itemIndex) => {
                  const index = offsetFor(groupIndex, itemIndex);
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={item.id}
                      id={`${listboxId}-item-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        item.onSelect?.();
                        onClose();
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100",
                        isActive ? "bg-surface-2 text-ink" : "text-ink",
                      )}
                    >
                      {item.icon ? (
                        <span className="grid size-4 shrink-0 place-items-center text-ink-3">
                          {item.icon}
                        </span>
                      ) : null}
                      <span className="min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.description && (
                          <span className="block truncate text-xs text-ink-3">
                            {item.description}
                          </span>
                        )}
                      </span>
                      {item.shortcut && (
                        <span className="ml-auto shrink-0 text-xs text-ink-3">{item.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-ink-3">{emptyText}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}