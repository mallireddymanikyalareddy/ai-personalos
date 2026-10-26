"use client";

import * as React from "react";

import { Inbox, MoreHorizontal, Plus, Settings, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { Tooltip } from "@/components/ui/tooltip";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CommandMenu, type CommandItem } from "@/components/ui/command-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressBar } from "@/components/ui/progress";
import { CircularProgress } from "@/components/ui/circular-progress";
import { useToast } from "@/components/ui/toast";
import { Block, Row, Section } from "./section";

export function FeedbackSection() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const commandItems: CommandItem[] = [
    { id: "today", label: "Go to Today", keywords: "home dashboard", group: "Navigate", shortcut: "G T", onSelect: () => toast("Today selected") },
    { id: "inbox", label: "Go to Inbox", keywords: "capture triage", group: "Navigate", shortcut: "G I", onSelect: () => toast("Inbox selected") },
    { id: "notes", label: "Go to Notes", keywords: "knowledge write", group: "Navigate", shortcut: "G N", onSelect: () => toast("Notes selected") },
    { id: "task", label: "New task", keywords: "todo capture add", group: "Actions", shortcut: "A T", onSelect: () => toast("Task draft started", { tone: "success" }) },
    { id: "note", label: "New note", keywords: "write capture add", group: "Actions", shortcut: "A N", onSelect: () => toast("Note draft started", { tone: "success" }) },
    { id: "focus", label: "Start focus session", keywords: "timer deep work", group: "Actions", shortcut: "F", onSelect: () => toast("Focus session queued") },
  ];

  return (
    <>
      <Section
        id="modals"
        title="Modals & drawers"
        blurb="Both lock scroll, trap focus, restore focus on close and close on Escape or backdrop. Modals bottom-sheet on mobile; drawers slide from the side."
      >
        <Row>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Confirmation dialog
          </Button>
        </Row>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Example modal"
          description="A focused, single-column surface for one decision or task."
          footer={
            <div className="flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Confirm
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-ink-2">
            The modal centers on desktop, docks to the bottom edge on mobile, and keeps at most one decision at a
            time. Autofocus lands on the first focusable element unless marked with <code>data-autofocus</code>.
          </p>
          <div className="mt-4 flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-ink">
              <Settings className="size-4" aria-hidden="true" />
            </div>
            <p className="text-xs text-ink-3">Title + description header · scrollable body · sticky footer</p>
          </div>
        </Modal>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Example drawer"
          description="A persistent context panel."
          footer={
            <div className="flex justify-end gap-2.5">
              <Button variant="primary" onClick={() => setDrawerOpen(false)}>
                Done
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-ink-2">
            Drawers suit details and editors that need breathing room — task details, note previews, quick settings.
            They always keep their own header and footer so the context never scrolls away.
          </p>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Drawer>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            toast("Deleted", { tone: "success" });
          }}
          title="Delete this project?"
          description="All matching tasks stay in your archive but their project links are removed. This can't be undone."
          confirmLabel="Delete project"
          cancelLabel="Keep it"
        />
      </Section>

      <Section
        id="tooltips"
        title="Tooltips"
        blurb="Triggered by hover or keyboard focus with a 400ms delay so idle cursor movement stays quiet. Never required to complete a task."
      >
        <Row>
          <Tooltip label="Capture anything with ⌘K" side="top">
            <Button variant="secondary" size="icon" aria-label="Capture">
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip label="More actions" side="bottom">
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip label="Inline status badge" side="right">
            <span className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm text-ink">
              Hover or focus me
            </span>
          </Tooltip>
        </Row>
      </Section>

      <Section
        id="toasts"
        title="Toasts"
        blurb="Transient feedback for actions you already know happened. A single action affordance (undo) plus tone color; never for errors that need a decision."
      >
        <Row>
          <Button variant="secondary" onClick={() => toast("Task completed")}>
            Default toast
          </Button>
          <Button variant="secondary" onClick={() => toast("Saved to this device", { tone: "success" })}>
            Success tone
          </Button>
          <Button variant="secondary" onClick={() => toast("Couldn't sync", { tone: "danger" })}>
            Danger tone
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast("Task moved to Inbox", {
                action: { label: "Undo", onClick: () => toast("Restored", { tone: "success" }) },
              })
            }
          >
            With undo action
          </Button>
        </Row>
      </Section>

      <Section
        id="alerts"
        title="Alerts"
        blurb="Persistent, screen-reader-announced messages inside the page: banner-level notices with tone, icon, optional action and optional dismissal."
      >
        <div className="grid max-w-2xl gap-3">
          <Alert tone="accent" title="A suggestion is ready">OpenAI can turn this week&apos;s notes into next week&apos;s plan.</Alert>
          <Alert tone="info" title="Sync is paused">Captures are saved locally until you reconnect.</Alert>
          <Alert tone="success" title="Weekly review complete">3 goals moved forward and 2 tasks rescheduled.</Alert>
          <Alert tone="warning" title="Streak at risk" action={<Button size="sm" variant="secondary">Check in</Button>}>
            You haven&apos;t checked in today — one more day keeps the streak alive.
          </Alert>
          <Alert tone="danger" title="Import failed" dismissible onDismiss={() => toast("Dismissed")}>
            The backup file is from an older schema. Export again from the source app.
          </Alert>
        </div>
      </Section>

      <Section
        id="progress"
        title="Progress indicators"
        blurb="Determinate only — the app never guesses. Linear bars carry broad progress; the circular variant fits scores and compact cards."
      >
        <div className="grid max-w-2xl gap-5">
          <Block title="Linear">
            <div className="space-y-3">
              <ProgressBar value={64} max={100} />
              <ProgressBar value={100} max={100} tone="success" />
              <ProgressBar value={18} max={100} tone="accent" />
            </div>
          </Block>
          <Block title="Circular">
            <Row>
              <CircularProgress value={72} max={100} size={48} label="Weekly goal progress" />
              <CircularProgress value={40} max={100} size={40} tone="success" label="Habit consistency" />
              <CircularProgress value={95} max={100} size={56} tone="danger" label="Energy budget used" />
            </Row>
          </Block>
        </div>
      </Section>

      <Section
        id="skeletons"
        title="Skeleton loaders"
        blurb="Placeholders that respect the real layout, so nothing jumps when data arrives. Pulsing once, gently, at reduced-motion they go static."
      >
        <div className="max-w-md space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-2/5" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Section>

      <Section
        id="empty"
        title="Empty states"
        blurb="Empty is a designed moment, not a bug. Every surface pairs an icon, an explanation and a call to action."
      >
        <div className="rounded-2xl border border-line bg-surface-2/50">
          <EmptyState
            icon={Inbox}
            title="Inbox zero"
            description="Everything you captured is scheduled or filed. New captures land here until you decide."
            action={
              <Button variant="primary" onClick={() => toast("Capture opened", { tone: "success" })}>
                Capture something
              </Button>
            }
            secondaryAction={<Button variant="ghost">Learn shortcuts</Button>}
          />
        </div>
      </Section>

      <Section
        id="errors"
        title="Error states"
        blurb="Errors are calm and specific. We never invent details; when we can't catch something, honesty beats a spinner."
      >
        <div className="grid max-w-2xl gap-4">
          <Alert tone="danger" title="This couldn't be saved">
            We couldn&apos;t write to local storage. Check available space and try again — nothing is lost until you
            leave this screen.
          </Alert>
        </div>
      </Section>

      <Section
        id="command"
        title="Command palette"
        blurb="One keystroke away from everything. Fuzzy-ish matching over label, keywords and description; arrow keys navigate, Enter commits, Esc dismisses."
      >
        <Button variant="secondary" onClick={() => setCommandOpen(true)}>
          <Sparkles className="size-4" aria-hidden="true" />
          Open command palette
        </Button>
        <CommandMenu
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          items={commandItems}
          placeholder="Search tasks, notes, actions…"
        />
      </Section>
    </>
  );
}