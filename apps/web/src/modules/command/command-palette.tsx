"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Briefcase, Inbox, TableProperties, FileText, FolderTree, Sparkles, Sun, Moon, User } from "lucide-react";

import { CommandMenu, type CommandItem } from "@/components/ui/command-menu";
import { ALL_AREAS } from "@/lib/ia/routes";
import { useCommands } from "@/modules/command/command-context";
import { useCapture } from "@/modules/capture/capture-context";
import { setSettings } from "@/lib/settings-sync";
import { useAppState, useOS } from "@/store/use-os";

function exportBackup(os: ReturnType<typeof useOS>): void {
  const blob = new Blob([os.exportData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `personalos-backup-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function CommandPalette() {
  const router = useRouter();
  const os = useOS();
  const state = useAppState();
  const { openCapture } = useCapture();
  const { paletteOpen, closePalette } = useCommands();

  const items = React.useMemo<CommandItem[]>(() => {
    const go: CommandItem[] = ALL_AREAS.filter((area) => area.key !== "styleguide").map((area) => {
      const Icon = area.icon;
      return {
        id: `area:${area.key}`,
        label: area.label,
        group: "Go to",
        keywords: area.keywords,
        icon: <Icon className="size-4" aria-hidden="true" />,
        onSelect: () => router.push(area.slug),
      };
    });

    const create: CommandItem[] = [
      {
        id: "create:capture",
        label: "Capture anything",
        group: "Create",
        keywords: "capture quick add task note inbox",
        icon: <Sparkles className="size-4" aria-hidden="true" />,
        shortcut: "⌘⇧K",
        onSelect: openCapture,
      },
      {
        id: "create:new-note",
        label: "New note",
        group: "Create",
        keywords: "write note idea reference",
        icon: <FileText className="size-4" aria-hidden="true" />,
        onSelect: () => router.push("/notes"),
      },
      {
        id: "create:inbox",
        label: "Open inbox",
        group: "Create",
        keywords: "inbox triage capture queue",
        icon: <Inbox className="size-4" aria-hidden="true" />,
        onSelect: () => router.push("/inbox"),
      },
    ];

    const actions: CommandItem[] = [
      {
        id: "mode:personal",
        label: "Switch to Personal mode",
        group: "Mode",
        keywords: "personal mode switch workspace today",
        icon: <User className="size-4" aria-hidden="true" />,
        onSelect: () => {
          os.setActiveMode("personal");
          router.push("/today");
        },
      },
      {
        id: "mode:work",
        label: "Switch to Work mode",
        group: "Mode",
        keywords: "work mode switch workspace team",
        icon: <Briefcase className="size-4" aria-hidden="true" />,
        onSelect: () => {
          os.setActiveMode("work");
          router.push("/workmode");
        },
      },
      {
        id: "action:theme",
        label: state.settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        keywords: "theme dark light appearance",
        icon:
          state.settings.theme === "dark" ? (
            <Sun className="size-4" aria-hidden="true" />
          ) : (
            <Moon className="size-4" aria-hidden="true" />
          ),
        onSelect: () =>
          setSettings({
            theme: state.settings.theme === "dark" ? "light" : "dark",
          }),
      },
      {
        id: "action:export",
        label: "Export backup",
        group: "Actions",
        keywords: "backup export download data",
        icon: <TableProperties className="size-4" aria-hidden="true" />,
        onSelect: () => exportBackup(os),
      },
      {
        id: "action:areas",
        label: "Manage projects",
        group: "Actions",
        keywords: "projects areas work",
        icon: <FolderTree className="size-4" aria-hidden="true" />,
        onSelect: () => router.push("/work"),
      },
      {
        id: "action:ai-plan",
        label: "AI: plan my day",
        group: "AI",
        keywords: "ai assistant plan day schedule time block",
        icon: <Sparkles className="size-4" aria-hidden="true" />,
        onSelect: () => router.push("/ai?run=plan%20my%20day"),
      },
      {
        id: "action:ai-review",
        label: "AI: weekly review",
        group: "AI",
        keywords: "ai weekly review summary",
        icon: <Sparkles className="size-4" aria-hidden="true" />,
        onSelect: () => router.push("/ai?run=weekly%20review"),
      },
      {
        id: "action:ai-insights",
        label: "AI: productivity insights",
        group: "AI",
        keywords: "ai insights stats productivity trends",
        icon: <Sparkles className="size-4" aria-hidden="true" />,
        onSelect: () => router.push("/ai?run=insights"),
      },
    ];

    return [...go, ...create, ...actions];
  }, [os, router, state.settings.theme, openCapture]);

  return (
    <CommandMenu
      open={paletteOpen}
      onClose={closePalette}
      items={items}
      placeholder="Go to, create, or run an action…"
      emptyText="No matching commands"
      a11yLabel="Command palette"
    />
  );
}