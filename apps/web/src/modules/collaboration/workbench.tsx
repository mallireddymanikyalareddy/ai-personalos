"use client";

import * as React from "react";

import {
  CalendarClock,
  CalendarPlus,
  Check,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import type { ID } from "@personalos/core";
import { SHARE_ROLE_LABELS, type ShareableEntityType } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { AIAnswer } from "@/components/ai/ai-answer";
import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { FieldLabel, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAIGateway } from "@/lib/use-ai-gateway";

import { useOS } from "@/store/use-os";

type Tab = "team" | "tasks" | "projects" | "shifts" | "timeoff" | "calendar";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "team", label: "Team" },
  { value: "tasks", label: "Tasks" },
  { value: "projects", label: "Projects" },
  { value: "shifts", label: "Shifts" },
  { value: "timeoff", label: "Time off" },
  { value: "calendar", label: "Calendar" },
];

function ShiftKindBadge({ kind }: { kind: string }) {
  const tone = kind === "vacation" ? "accent" : kind === "sick" ? "warning" : "neutral";
  return <Badge tone={tone}>{kind}</Badge>;
}

function CommentThread({
  targetType,
  targetId,
}: {
  targetType: ShareableEntityType | "meeting";
  targetId: ID;
}) {
  const os = useOS();
  const [body, setBody] = React.useState("");
  const threads = os.commentsFor(targetType, targetId);
  const members = os.members();

  const submit = () => {
    if (!body.trim()) return;
    os.addComment({ targetType, targetId, body: body.trim() });
    setBody("");
  };

  return (
    <div className="space-y-3">
      {threads.length === 0 ? (
        <p className="text-sm text-ink-3">No comments yet.</p>
      ) : (
        threads.map((thread) => (
          <div key={thread.root.id} className="space-y-1.5">
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-medium text-ink-2">
                  {members.find((m) => m.id === thread.root.ownerId)?.displayName ?? "You"}
                </span>
                <span className="text-[11px] text-ink-3">
                  {new Date(thread.root.createdAt).toLocaleString()}
                </span>
                {thread.root.edited && <Badge tone="outline">edited</Badge>}
              </div>
              <p className="text-sm leading-relaxed text-ink-2">{thread.root.body}</p>
            </div>
            {thread.replies.map((reply) => (
              <div key={reply.id} className="ml-6 rounded-xl border border-line bg-surface-2/50 p-2.5">
                <p className="text-sm leading-relaxed text-ink-2">{reply.body}</p>
              </div>
            ))}
          </div>
        ))
      )}

      <div className="flex items-center gap-2">
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="Write a comment — @name mentions notify"
          className="flex-1"
        />
        <Button variant="secondary" size="sm" onClick={submit} disabled={!body.trim()}>
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function WorkModeModule() {
  const os = useOS();
  const { toast } = useToast();
  const ai = useAIGateway();
  const [tab, setTab] = React.useState<Tab>("team");

  const [memberOpen, setMemberOpen] = React.useState(false);
  const [memberName, setMemberName] = React.useState("");
  const [memberRole, setMemberRole] = React.useState<"owner" | "admin" | "member" | "guest">("member");

  const [projectOpen, setProjectOpen] = React.useState(false);
  const [projectName, setProjectName] = React.useState("");

  const [shiftMemberId, setShiftMemberId] = React.useState<string>("");
  const [shiftDate, setShiftDate] = React.useState("2026-10-20");
  const [shiftStart, setShiftStart] = React.useState("09:00");
  const [shiftEnd, setShiftEnd] = React.useState("17:00");

  const [timeOffMemberId, setTimeOffMemberId] = React.useState<string>("");
  const [timeOffStart, setTimeOffStart] = React.useState("2026-10-20");
  const [timeOffEnd, setTimeOffEnd] = React.useState("2026-10-21");
  const [timeOffKind, setTimeOffKind] = React.useState<"vacation" | "sick" | "personal" | "unpaid" | "bereavement">("vacation");
  const [timeOffHours, setTimeOffHours] = React.useState(16);

  const members = os.members();
  const roster = os.teamRoster();
  const tasks = os.sharedTasks("work");
  const projects = os.sharedProjects("work");
  const openShifts = os.openShifts();
  const coverage = os.weekCoverage();
  const timeOff = os.timeOffRequests();
  const weekFrom = Date.now();
  const weekTo = weekFrom + 14 * 86_400_000;
  const calendar = os.sharedCalendar(weekFrom, weekTo, "work");

  const ensureMemberSelection = (current: string) => {
    if (current) return current;
    return members[0]?.id ?? "";
  };

  const addMember = () => {
    if (!memberName.trim()) return;
    os.addMember({
      userId: `user_${Date.now().toString(36)}`,
      role: memberRole,
      displayName: memberName.trim(),
    });
    setMemberName("");
    setMemberOpen(false);
    toast("Member added");
  };

  const addShift = () => {
    const memberId = ensureMemberSelection(shiftMemberId);
    if (!memberId) {
      toast("Add a team member first", { tone: "danger" });
      return;
    }
    const [y, mo, d] = shiftDate.split("-").map(Number);
    const [sh, sm] = shiftStart.split(":").map(Number);
    const [eh, em] = shiftEnd.split(":").map(Number);
    const startsAt = new Date(y, mo - 1, d, sh, sm).getTime();
    const endsAt = new Date(y, mo - 1, d, eh, em).getTime();

    const verdict = os.checkShift(memberId, startsAt, endsAt);
    if (!verdict.ok) {
      toast(verdict.reason, { tone: "danger" });
      return;
    }
    os.addShift({ memberId, startsAt, endsAt, title: "Shift" });
    toast("Shift scheduled");
  };

  const requestTimeOff = () => {
    const memberId = ensureMemberSelection(timeOffMemberId);
    if (!memberId) {
      toast("Add a team member first", { tone: "danger" });
      return;
    }
    const [y1, m1, d1] = timeOffStart.split("-").map(Number);
    const [y2, m2, d2] = timeOffEnd.split("-").map(Number);
    const startsAt = new Date(y1, m1 - 1, d1, 9).getTime();
    const endsAt = new Date(y2, m2 - 1, d2, 17).getTime();

    const verdict = os.requestTimeOff({
      memberId,
      kind: timeOffKind,
      startsAt,
      endsAt,
      requestedHours: timeOffHours,
    });
    if (!verdict.ok) {
      toast(verdict.reason, { tone: "danger" });
      return;
    }
    toast("Time off requested");
  };

  const runCollabAI = (id: "summary" | "reply" | "agenda") => {
    const meta =
      id === "summary"
        ? { action: "collab_summary", prompt: "Summarize this shared workspace thread and the open decisions.", label: "Workspace summary" }
        : id === "reply"
          ? { action: "collab_reply_draft", prompt: "Draft a concise, friendly reply to the latest thread.", label: "Draft reply" }
          : { action: "collab_agenda", prompt: "Build a shared agenda for the next team meeting.", label: "Shared agenda" };
    if (!ai.gatewayEnabled) {
      ai.setAnswer(`Local ${meta.label.toLowerCase()}: list the open items, owners and the next decision.`);
      return;
    }
    void ai.request({ ...meta, context: os.aiContextSummary() });
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented options={TABS} value={tab} onChange={setTab} label="Work space" />
        {tab === "team" && (
          <Button variant="primary" size="sm" onClick={() => setMemberOpen(true)}>
            <UserPlus className="size-4" />
            Add member
          </Button>
        )}
        {tab === "projects" && (
          <Button variant="primary" size="sm" onClick={() => setProjectOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        )}
      </div>

      <section className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-card" aria-label="AI collaboration assistant" data-testid="collab-ai-panel">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI collaboration assistant
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => runCollabAI("summary")}>Summarize workspace</Button>
          <Button size="sm" variant="ghost" onClick={() => runCollabAI("reply")}>Draft reply</Button>
          <Button size="sm" variant="ghost" onClick={() => runCollabAI("agenda")}>Build agenda</Button>
        </div>
        {ai.answer ? (
          <AIAnswer
            text={ai.answer}
            testId="collab-ai-answer"
            className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-[12px]"
          />
        ) : null}
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="collab-ai-credits">{ai.creditsNote}</p>
      </section>

      {tab === "team" && (
        <>
          {members.length === 0 ? (
            <p className="text-sm text-ink-3">No team members yet — add someone to start sharing.</p>
          ) : (
            <ul className="space-y-2">
              {roster.map((row) => (
                <li
                  key={row.member.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-medium text-ink-2">
                      {row.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">{row.displayName}</span>
                        <Badge tone="neutral">{row.member.role}</Badge>
                      </div>
                      <span className="text-xs text-ink-3">
                        {row.openTasks} open task{row.openTasks === 1 ? "" : "s"} ·{" "}
                        {row.shiftsThisWeek} shift{row.shiftsThisWeek === 1 ? "" : "s"} this week
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.pendingTimeOff > 0 && (
                      <Badge tone="warning">{row.pendingTimeOff} pending</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${row.displayName}`}
                      onClick={() => {
                        os.deleteMember(row.member.id);
                        toast("Member removed");
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "tasks" && (
        <>
          {tasks.length === 0 ? (
            <p className="text-sm text-ink-3">
              No shared tasks yet. Assign a task to a teammate and it moves into Work mode automatically.
            </p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((row) => (
                <li key={row.task.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">{row.task.title}</span>
                        <Badge tone="neutral">{row.task.status}</Badge>
                      </div>
                      {row.projectName && (
                        <span className="mt-0.5 block text-xs text-ink-3">{row.projectName}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {row.assignee && (
                        <span className="text-xs text-ink-3">{row.assignee.displayName}</span>
                      )}
                      <Badge tone="outline">{SHARE_ROLE_LABELS["viewer"]}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <CommentThread targetType="task" targetId={row.task.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "projects" && (
        <>
          {projects.length === 0 ? (
            <p className="text-sm text-ink-3">No shared projects yet.</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((row) => (
                <li key={row.project.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-ink">{row.project.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {row.openTaskCount} open · {row.memberCount} shared
                    </span>
                  </div>
                  {row.project.summary && (
                    <p className="mt-1 text-sm text-ink-3">{row.project.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "shifts" && (
        <div className="space-y-5">
          {members.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <CalendarClock className="size-4" aria-hidden="true" />
                Schedule a shift
              </h3>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <FieldLabel>Member</FieldLabel>
                  <Select
                    value={shiftMemberId}
                    onChange={(event) => setShiftMemberId(event.target.value)}
                    className="w-40"
                  >
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Date</FieldLabel>
                  <Input type="date" value={shiftDate} onChange={(event) => setShiftDate(event.target.value)} className="w-40" />
                </div>
                <div>
                  <FieldLabel>Start</FieldLabel>
                  <Input type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} className="w-28" />
                </div>
                <div>
                  <FieldLabel>End</FieldLabel>
                  <Input type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} className="w-28" />
                </div>
                <Button variant="primary" size="sm" onClick={addShift}>
                  <CalendarPlus className="size-4" />
                  Schedule
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-ink">This week&apos;s coverage</h3>
            <div className="flex h-24 items-end gap-1.5">
              {coverage.map((row) => (
                <div key={row.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-16 w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-accent"
                      style={{ height: `${Math.max(3, (row.minutes / 480) * 100)}%` }}
                      title={`${row.minutes} min`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-ink-3">{row.label}</span>
                  <span className="text-[10px] tabular-nums text-ink-3">{row.shifts}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-ink">Open for pickup</h3>
            {openShifts.length === 0 ? (
              <p className="text-sm text-ink-3">No shifts available for pickup.</p>
            ) : (
              <ul className="space-y-2">
                {openShifts.map((row) => (
                  <li
                    key={row.shift.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm text-ink">{row.shift.title || "Shift"}</span>
                      <span className="text-xs text-ink-3">
                        {row.memberName} · {new Date(row.shift.startsAt).toLocaleString()}
                      </span>
                    </div>
                    {row.pickups > 0 ? (
                      <Badge tone="warning">{row.pickups} requests</Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const target = members.find((m) => m.id !== row.shift.memberId);
                          if (!target) return;
                          const verdict = os.requestShiftPickup({ shiftId: row.shift.id, memberId: target.id });
                          toast(verdict.ok ? "Pickup requested" : verdict.reason, {
                            tone: verdict.ok ? "success" : "danger",
                          });
                        }}
                        disabled={members.length < 2}
                      >
                        Request pickup
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {os.shiftSwaps().length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="mb-3 text-sm font-medium text-ink">Swap requests</h3>
              <ul className="space-y-2">
                {os.shiftSwaps().map((swap) => {
                  const shift = os.getState().shifts[swap.shiftId];
                  const requester = os.members().find((m) => m.id === swap.requesterId);
                  return (
                    <li
                      key={swap.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm text-ink">
                          {requester?.displayName ?? "Someone"} requested a swap
                        </span>
                        <span className="text-xs text-ink-3">
                          {shift ? new Date(shift.startsAt).toLocaleString() : "Shift"}
                        </span>
                      </div>
                      {swap.status === "pending" ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="primary"
                            size="icon-sm"
                            aria-label="Accept swap"
                            onClick={() => os.respondShiftSwap(swap.id, true)}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Reject swap"
                            onClick={() => os.respondShiftSwap(swap.id, false)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Badge tone="neutral">{swap.status}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "timeoff" && (
        <div className="space-y-5">
          {members.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="mb-3 text-sm font-medium text-ink">Request time off</h3>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <FieldLabel>Member</FieldLabel>
                  <Select
                    value={timeOffMemberId}
                    onChange={(event) => setTimeOffMemberId(event.target.value)}
                    className="w-40"
                  >
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Kind</FieldLabel>
                  <Select
                    value={timeOffKind}
                    onChange={(event) => setTimeOffKind(event.target.value as typeof timeOffKind)}
                    className="w-32"
                  >
                    <option value="vacation">Vacation</option>
                    <option value="sick">Sick</option>
                    <option value="personal">Personal</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="bereavement">Bereavement</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>From</FieldLabel>
                  <Input type="date" value={timeOffStart} onChange={(event) => setTimeOffStart(event.target.value)} className="w-40" />
                </div>
                <div>
                  <FieldLabel>To</FieldLabel>
                  <Input type="date" value={timeOffEnd} onChange={(event) => setTimeOffEnd(event.target.value)} className="w-40" />
                </div>
                <div>
                  <FieldLabel>Hours</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={timeOffHours}
                    onChange={(event) => setTimeOffHours(Number(event.target.value))}
                    className="w-20"
                  />
                </div>
                <Button variant="primary" size="sm" onClick={requestTimeOff}>
                  Submit request
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-ink">Requests</h3>
            {timeOff.length === 0 ? (
              <p className="text-sm text-ink-3">No time-off requests.</p>
            ) : (
              <ul className="space-y-2">
                {timeOff.map((request) => {
                  const member = os.members().find((m) => m.id === request.memberId);
                  return (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm text-ink">
                            {member?.displayName ?? "Member"}
                          </span>
                          <ShiftKindBadge kind={request.kind} />
                        </div>
                        <span className="text-xs text-ink-3">
                          {new Date(request.startsAt).toLocaleDateString()} →{" "}
                          {new Date(request.endsAt).toLocaleDateString()} · {request.requestedHours}h
                        </span>
                      </div>
                      {request.status === "pending" ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="primary"
                            size="icon-sm"
                            aria-label="Approve request"
                            onClick={() => {
                              const approver = os.members()[0];
                              if (!approver) return;
                              os.decideTimeOff(request.id, true, approver.id);
                              toast("Approved");
                            }}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Reject request"
                            onClick={() => {
                              const approver = os.members()[0];
                              if (!approver) return;
                              os.decideTimeOff(request.id, false, approver.id);
                              toast("Rejected");
                            }}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Badge tone={request.status === "approved" ? "success" : "neutral"}>
                          {request.status}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-ink">Balances this year</h3>
            <ul className="space-y-1.5">
              {os.timeOffBalances().map((row) => (
                <li key={row.memberId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-2">{row.displayName}</span>
                  <span className="text-xs text-ink-3">
                    {row.approvedHours}h approved · {row.pendingHours}h pending
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const ics = os.exportIcs(Date.now(), Date.now() + 30 * 86_400_000, "work");
                const blob = new Blob([ics], { type: "text/calendar" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "work-calendar.ics";
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export .ics
            </Button>
          </div>

          {calendar.length === 0 ? (
            <p className="text-sm text-ink-3">
              No work events yet — add a calendar event with Work mode to share it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {calendar.map((row) => (
                <li
                  key={row.event.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-ink">{row.event.title}</span>
                    <span className="text-xs text-ink-3">
                      {new Date(row.event.startsAt).toLocaleString()}
                      {row.attendeeCount > 0 && ` · ${row.attendeeCount} attendees`}
                    </span>
                  </div>
                  <Badge tone="neutral">{row.event.mode}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        title="Add team member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMemberOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addMember} disabled={!memberName.trim()}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="wm-name">Display name</FieldLabel>
            <Input
              id="wm-name"
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
              placeholder="Grace Hopper"
              autoFocus
            />
          </div>
          <div>
            <FieldLabel htmlFor="wm-role">Role</FieldLabel>
            <Select
              id="wm-role"
              value={memberRole}
              onChange={(event) => setMemberRole(event.target.value as typeof memberRole)}
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="guest">Guest</option>
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        title="New shared project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!projectName.trim()) return;
                os.addProject({ name: projectName.trim(), mode: "work" });
                setProjectName("");
                setProjectOpen(false);
                toast("Project created in Work mode");
              }}
              disabled={!projectName.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <FieldLabel htmlFor="wm-project">Project name</FieldLabel>
        <Input
          id="wm-project"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="Website redesign"
          autoFocus
        />
      </Modal>
      <CreditConfirmDialog
        open={ai.pending != null}
        label={ai.pending?.label ?? "AI action"}
        estimate={ai.pending?.estimate ?? null}
        busy={ai.busy}
        onClose={ai.dismiss}
        onConfirm={() => void ai.confirm()}
      />
    </>
  );
}