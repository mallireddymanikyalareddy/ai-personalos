"use client";

import * as React from "react";

import { useToast } from "@/components/ui/toast";
import { SwipeableRow } from "@/components/mobile/swipeable-row";
import { useHaptics } from "@/hooks/use-haptics";
import { useIsMobile } from "@/hooks/use-online";
import { useAppState, useOS } from "@/store/use-os";
import type { Task } from "@personalos/core";
import { TaskRow } from "@/modules/tasks/task-row";
import { addDays, startOfDay, type Timestamp } from "@personalos/core";

export interface MobileTaskListProps {
  tasks: Task[];
  onOpen: (taskId: string) => void;
  showQuickSchedule?: boolean;
  showProject?: boolean;
}

export function MobileTaskList({ tasks, onOpen, showQuickSchedule, showProject }: MobileTaskListProps) {
  const os = useOS();
  useAppState();
  const isMobile = useIsMobile();
  const haptics = useHaptics();
  const { toast } = useToast();
  const preferences = os.mobilePreferences();

  if (!isMobile) {
    return (
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {tasks.map((task) => (
          <li key={task.id} className="px-3 py-2">
            <TaskRow
              task={task}
              onOpen={onOpen}
              showQuickSchedule={showQuickSchedule}
              showProject={showProject}
            />
          </li>
        ))}
      </ul>
    );
  }

  const postpone = (task: Task, now: Timestamp) => {
    const next = addDays(task.dueAt ?? now, 1);
    os.updateTask(task.id, { dueAt: next });
    haptics.trigger("tap");
    toast(`Moved to ${new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(next))}`, {
      action: {
        label: "Undo",
        onClick: () => os.updateTask(task.id, { dueAt: task.dueAt }),
      },
    });
  };

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const done = task.status === "done";
        return (
          <li key={task.id}>
            <SwipeableRow
              entity="task"
              leftAction={preferences.swipeLeftTask}
              rightAction={preferences.swipeRightTask}
              enabled={preferences.swipe.enabled}
              thresholdPx={preferences.swipe.thresholdPx}
              onAction={(action) => {
                const now = Date.now();
                if (action === "complete" && !done) {
                  os.completeTask(task.id);
                  haptics.trigger("success");
                  toast("Task completed", {
                    action: {
                      label: "Undo",
                      onClick: () =>
                        os.updateTask(task.id, {
                          status: task.status,
                          completedAt: task.completedAt,
                          startedAt: task.startedAt,
                        }),
                    },
                  });
                  return;
                }
                if (action === "postpone") {
                  postpone(task, now);
                  return;
                }
                if (action === "archive") {
                  os.updateTask(task.id, { status: "archived" });
                  toast("Task archived");
                  return;
                }
                if (action === "schedule") {
                  os.updateTask(task.id, { scheduledAt: task.dueAt ?? startOfDay(now) + 9 * 3_600_000 });
                  toast("Scheduled for today");
                  return;
                }
                if (action === "pin") {
                  toast("Pinned to the top of your list");
                  return;
                }
                if (action === "delete") {
                  os.deleteTask(task.id);
                  toast("Task deleted");
                  return;
                }
                onOpen(task.id);
              }}
              onOpen={() => onOpen(task.id)}
            >
              <TaskRow
                task={task}
                onOpen={onOpen}
                showQuickSchedule={showQuickSchedule}
                showProject={showProject}
              />
            </SwipeableRow>
          </li>
        );
      })}
    </ul>
  );
}


