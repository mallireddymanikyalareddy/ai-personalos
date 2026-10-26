"use client";

import * as React from "react";

import { Inbox as InboxIcon, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { selectInboxTasks, type InboxItem } from "@personalos/core";

import { useCapture } from "@/modules/capture/capture-context";
import { AddTaskRow } from "@/modules/tasks/add-task-row";
import { TaskDetailSheet } from "@/modules/tasks/task-detail-sheet";
import { TaskList } from "@/modules/tasks/task-row";
import { useAppState, useOS } from "@/store/use-os";

export default function InboxPage() {
  const state = useAppState();
  const os = useOS();
  const { openCapture } = useCapture();
  const [detailTaskId, setDetailTaskId] = React.useState<string | null>(null);

  const inbox = selectInboxTasks(state);
  const knowledgeItems = os.getInboxItems();

  return (
    <>
      <PageHeader
        icon={InboxIcon}
        title="Inbox"
        subtitle={
          inbox.length + knowledgeItems.length > 0
            ? `${inbox.length + knowledgeItems.length} ${inbox.length + knowledgeItems.length === 1 ? "item" : "items"} waiting to be decided`
            : "Everything lands here first"
        }
        actions={
          <Button variant="primary" size="sm" onClick={openCapture}>
            Capture
          </Button>
        }
      />

      <AddTaskRow placeholder="Capture without deciding — dates and tags are optional" />

      <Section title="To triage" count={inbox.length} className="mt-6">
        {inbox.length > 0 ? (
          <TaskList tasks={inbox} onOpen={setDetailTaskId} showQuickSchedule showProject={false} />
        ) : (
          <EmptyState
            icon={InboxIcon}
            title="Inbox zero"
            description="Nothing waiting. Capture anything that crosses your mind — a task, a thought, a half-formed idea — and sort it out later."
            action={
              <Button variant="primary" size="md" onClick={openCapture}>
                Capture something
              </Button>
            }
          />
        )}
      </Section>

      <Section title="Knowledge inbox" count={knowledgeItems.length} className="mt-8">
        {knowledgeItems.length > 0 ? (
          <div className="space-y-2">
            {knowledgeItems.map((item: InboxItem) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {item.kind}
                    {item.tags.length > 0 ? ` · ${item.tags.map((t) => `#${t}`).join(" ")}` : ""}
                  </span>
                </div>
                <Badge tone="neutral">{item.status}</Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    os.triageInboxItem(item.id);
                  }}
                >
                  Triage
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No knowledge waiting"
            description="Web clips, documents, and recordings land here for sorting into notes, notebooks, and folders."
          />
        )}
      </Section>

      <div className="mt-8 rounded-2xl border border-dashed border-line px-5 py-4 text-sm leading-relaxed text-ink-3">
        Quick triage: give a capture a date to move it onto your calendar, or add a project to file
        it under <span className="text-ink-2">Tasks</span>. Anything with a date automatically
        becomes part of your day.
      </div>

      <TaskDetailSheet taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
    </>
  );
}
