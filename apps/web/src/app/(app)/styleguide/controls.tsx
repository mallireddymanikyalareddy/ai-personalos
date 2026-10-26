"use client";

import * as React from "react";

import { ChevronDown, MoreHorizontal, Plus, Share2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthCalendar } from "@/components/ui/calendar";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Block, Row, Section } from "./section";

export function ControlsSection() {
  const [text, setText] = React.useState("");
  const [area, setArea] = React.useState("");
  const [priority, setPriority] = React.useState("medium");
  const [tabsValue, setTabsValue] = React.useState("today");
  const [segmentedValue, setSegmentedValue] = React.useState("list");
  const [checked, setChecked] = React.useState(true);
  const [switchOn, setSwitchOn] = React.useState(true);
  const [date, setDate] = React.useState<number | null>(() => new Date(2026, 9, 15).getTime());
  const [calendarDate, setCalendarDate] = React.useState<number | null>(() => new Date(2026, 9, 15).getTime());

  return (
    <>
      <Section
        id="buttons"
        title="Buttons"
        blurb="Primary for one action per surface, secondary for peers, ghost for row/meta actions, danger for destructive, link for inline. Loading swaps children for a spinner without layout shift."
      >
        <Block title="Variants">
          <Row>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link button</Button>
          </Row>
        </Block>
        <Block title="With icons">
          <Row>
            <Button variant="primary">
              <Plus className="size-4" aria-hidden="true" /> New task
            </Button>
            <Button variant="secondary">
              Share <Share2 className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="More options">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label="More options">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </Row>
        </Block>
        <Block title="States">
          <Row>
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary" size="md">
              Medium
            </Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
          </Row>
        </Block>
        <Block title="Composable static class">
          <Row>
            <span className={buttonClasses("secondary", "sm")}>Rendered as any element</span>
          </Row>
        </Block>
      </Section>

      <Section
        id="inputs"
        title="Inputs, fields & search"
        blurb="Consistent 36px field height, border-line resting state, accent ring on focus. Errors attach a role=alert message; hints live under the control."
      >
        <Block title="Text input & textarea">
          <div className="grid max-w-xl gap-4">
            <Field label="Title" htmlFor="sg-input-title">
              <Input
                id="sg-input-title"
                placeholder="What needs to happen?"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="sg-input-notes" hint="Optional context or next steps.">
              <Textarea
                id="sg-input-notes"
                placeholder="Start writing…"
                value={area}
                onChange={(event) => setArea(event.target.value)}
              />
            </Field>
            <Field label="Deadline" error="This date is in the past." required>
              <Input defaultValue="2026-09-01" aria-invalid />
            </Field>
          </div>
        </Block>
        <Block title="Focus & keyboard">
          <div className="flex max-w-xl flex-wrap items-end gap-4">
            <Field label="Auto-focus">
              <Input placeholder="Tab here — accent ring on focus visible" autoFocus />
            </Field>
          </div>
        </Block>
      </Section>

      <Section
        id="select"
        title="Selects & dropdowns"
        blurb="Native selects inline; a custom menu component powers row actions and context menus with full keyboard support (arrows, Home/End, Enter, Escape)."
      >
        <div className="grid max-w-md gap-6">
          <Field label="Priority">
            <Select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-label="Priority"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
          <Field label="Row actions (custom dropdown)">
            <div>
              <DropdownMenu
                placement="Example actions"
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    Actions <ChevronDown className="size-4 text-ink-3" aria-hidden="true" />
                  </button>
                }
                sections={[
                  {
                    label: "Schedule",
                    items: [
                      { label: "Today", icon: <Plus className="size-4" /> },
                      { label: "Tomorrow", icon: <Plus className="size-4" /> },
                      { label: "Next week", icon: <Plus className="size-4" /> },
                    ],
                  },
                  {
                    label: "Manage",
                    separatorBefore: true,
                    items: [
                      { label: "Duplicate", icon: <Share2 className="size-4" />, shortcut: "⌘D", onSelect: () => alert("Duplicate") },
                      { label: "Archive", icon: <Plus className="size-4" /> },
                      { label: "Delete", icon: <Plus className="size-4" />, danger: true },
                    ],
                  },
                ]}
              />
            </div>
          </Field>
        </div>
      </Section>

      <Section
        id="tabs"
        title="Tabs & segmented controls"
        blurb="Tabs switch views; segmented controls switch modes. Both share the same contract and arrow-key navigation."
      >
        <Block title="Underline tabs">
          <div className="max-w-xl">
            <Tabs
              value={tabsValue}
              onChange={setTabsValue}
              a11yLabel="Example tabs"
              tabs={[
                { value: "today", label: "Today" },
                { value: "upcoming", label: "Upcoming", badge: <span className="text-xs text-ink-3">12</span> },
                { value: "all", label: "All", disabled: true },
              ]}
            />
          </div>
        </Block>
        <Block title="Pill tabs">
          <Tabs
            variant="pill"
            value={tabsValue}
            onChange={setTabsValue}
            tabs={[{ value: "today", label: "Today" }, { value: "upcoming", label: "Upcoming" }, { value: "all", label: "All" }]}
          />
        </Block>
        <Block title="Segmented control" className="max-w-md">
          <Segmented
            value={segmentedValue}
            onChange={setSegmentedValue}
            label="View mode"
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
              { value: "timeline", label: "Timeline" },
            ]}
          />
        </Block>
      </Section>

      <Section
        id="checkboxes"
        title="Checkboxes & switches"
        blurb="Checkboxes complete; switches toggle. Both keep labels legible and expose clear focus rings."
      >
        <div className="flex max-w-xl flex-wrap items-center gap-x-10 gap-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Checkbox label="Read the docs" checked={checked} onChange={setChecked} /> Read the docs
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-3">
              <Checkbox label="Frozen task" checked={false} onChange={() => void 0} /> Frozen task
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Checkbox label="Done forever" checked={true} onChange={() => void 0} /> Done forever
            </label>
          </div>
          <div className="space-y-3">
            <Row>
              <Switch checked={switchOn} onCheckedChange={setSwitchOn} label="Notifications" />
              <label className="text-sm text-ink">Notifications on</label>
            </Row>
            <Row>
              <Switch checked={false} onCheckedChange={() => void 0} disabled label="Disabled switch" />
              <span className="text-sm text-ink-3">Disabled</span>
            </Row>
          </div>
        </div>
      </Section>

      <Section
        id="date-time"
        title="Date & time controls"
        blurb="DatePicker pairs a compact month calendar with an inline trigger for global date selection. Time remains a typed input this stage."
      >
        <Block title="DatePicker">
          <div className="max-w-xs">
            <DatePicker
              value={date}
              onValueChange={setDate}
              ariaLabel="Pick a deadline"
              placeholder="Set a deadline"
            />
          </div>
        </Block>
        <Block title="Calendar">
          <div className="max-w-xs">
            <MonthCalendar
              value={calendarDate}
              onValueChange={setCalendarDate}
              weekStartsOn={1}
            />
          </div>
        </Block>
      </Section>
    </>
  );
}