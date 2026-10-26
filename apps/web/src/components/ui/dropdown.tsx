"use client";

import * as React from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { Popover, useOutsideDismiss } from "@/components/ui/popover";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export interface MenuSection {
  label?: string;
  items: MenuItem[];
  separatorBefore?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactElement;
  sections: MenuSection[];
  placement?: string;
  side?: "bottom" | "top";
  align?: "start" | "end";
  matchWidth?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface FlatItem extends MenuItem {
  sectionIndex: number;
  sectionLabel?: string;
  separatorBefore: boolean;
}

export function DropdownMenu({
  trigger,
  sections,
  placement = "menu",
  side = "bottom",
  align = "start",
  matchWidth = false,
  disabled = false,
  onOpenChange,
}: DropdownMenuProps) {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const flat = React.useMemo<FlatItem[]>(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.items.map((item) => ({
          ...item,
          sectionIndex,
          sectionLabel: section.label,
          separatorBefore: section.separatorBefore ?? false,
        })),
      ),
    [sections],
  );

  const enabledIndexes = React.useMemo(
    () => flat.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0),
    [flat],
  );

  const setOpenWithCallback = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const closeMenu = React.useCallback(() => {
    setOpenWithCallback(false);
  }, [setOpenWithCallback]);

  useOutsideDismiss(popoverRef, closeMenu, open);

  React.useEffect(() => {
    if (!open) {
      setActive(-1);
      return;
    }
    setActive(enabledIndexes[0] ?? -1);
  }, [open, enabledIndexes]);

  React.useEffect(() => {
    if (!open || active < 0) return;
    itemRefs.current[active]?.focus();
  }, [open, active]);

  const selectItem = React.useCallback(
    (item: FlatItem) => {
      if (item.disabled) return;
      item.onSelect?.();
      setOpenWithCallback(false);
    },
    [setOpenWithCallback],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (enabledIndexes.length === 0) return;
      const current = enabledIndexes.indexOf(active);
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setActive(enabledIndexes[(current + 1) % enabledIndexes.length]);
          break;
        case "ArrowUp": {
          event.preventDefault();
          const previousIndex = current < 0 ? enabledIndexes.length - 1 : current - 1;
          setActive(enabledIndexes[(previousIndex + enabledIndexes.length) % enabledIndexes.length]);
          break;
        }
        case "Home":
          event.preventDefault();
          setActive(enabledIndexes[0]);
          break;
        case "End":
          event.preventDefault();
          setActive(enabledIndexes[enabledIndexes.length - 1]);
          break;
        case "Enter":
        case " ":
          if (active >= 0) {
            event.preventDefault();
            selectItem(flat[active]);
          }
          break;
      }
    },
    [active, enabledIndexes, flat, selectItem],
  );

  if (disabled) {
    return <span className="inline-flex">{trigger}</span>;
  }

  type TriggerProps = React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> };
  const triggerElement = trigger as React.ReactElement<TriggerProps>;

  const triggerNode = React.cloneElement(triggerElement, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
    },
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      triggerElement.props.onClick?.(event);
      if (!event.defaultPrevented) setOpenWithCallback(!open);
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
  });

  const renderItem = (item: FlatItem, index: number) => {
    const isActive = active === index;
    return (
      <button
        key={`${item.sectionIndex}-${index}`}
        ref={(node) => {
          itemRefs.current[index] = node;
        }}
        type="button"
        role="menuitem"
        tabIndex={isActive ? 0 : -1}
        aria-disabled={item.disabled || undefined}
        onClick={() => selectItem(item)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-100",
          item.danger ? "text-danger" : isActive ? "bg-surface-2 text-ink" : "text-ink",
          isActive && "bg-surface-2",
          item.disabled && "pointer-events-none opacity-50",
        )}
      >
        {item.icon ? (
          <span className={cn("grid size-4 place-items-center", item.danger ? "text-danger" : "text-ink-3")}>
            {item.icon}
          </span>
        ) : null}
        <span className="truncate">{item.label}</span>
        {item.selected ? (
          <Check className="ml-auto size-3.5 text-accent" aria-hidden="true" />
        ) : item.shortcut ? (
          <span className="ml-auto pl-6 text-xs text-ink-3">{item.shortcut}</span>
        ) : null}
      </button>
    );
  };

  return (
    <>
      <span className="inline-flex">{triggerNode}</span>
      <Popover
        open={open}
        anchor={triggerRef.current}
        side={side}
        align={align}
        matchWidth={matchWidth}
        panelRef={popoverRef}
      >
        <div
          role="menu"
          aria-label={placement}
          className="max-h-72 min-w-44 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop"
          onKeyDown={handleKeyDown}
        >
          {flat.map((item, index) => (
            <React.Fragment key={`${item.sectionIndex}-${index}`}>
              {index > 0 && item.separatorBefore && <div className="mx-2 my-1 h-px bg-line" />}
              {index === 0 || flat[index - 1]?.sectionIndex !== item.sectionIndex ? (
                item.sectionLabel ? (
                  <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                    {item.sectionLabel}
                  </div>
                ) : (
                  index > 0 && <div className="mx-2 my-1 h-px bg-line" />
                )
              ) : null}
              {renderItem(item, index)}
            </React.Fragment>
          ))}
        </div>
      </Popover>
    </>
  );
}