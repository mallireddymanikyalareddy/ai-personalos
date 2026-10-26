"use client";

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu } from "@/components/ui/dropdown";
import { CommandMenu, type CommandItem } from "@/components/ui/command-menu";
import { MonthCalendar } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("controls", () => {
  it("Switch toggles aria-checked on click", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} label="Notify" />);
    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("Tabs navigate selection with arrow keys", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="one"
        onChange={onChange}
        a11yLabel="test tabs"
        tabs={[
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
        ]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("two");
  });
});

describe("feedback", () => {
  it("Alert dismiss triggers onDismiss", () => {
    const onDismiss = vi.fn();
    render(
      <Alert tone="danger" title="Boom" dismissible onDismiss={onDismiss}>
        Something failed.
      </Alert>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("Tooltip appears on focus after delay and registers aria-describedby", async () => {
    render(
      <Tooltip label="Helper" side="top">
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.focus(trigger);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeTruthy(), { timeout: 1500 });
    expect(trigger.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("ConfirmDialog places initial focus on the safe action and confirms", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />,
    );
    await waitFor(() => {
      const cancel = screen.getByRole("button", { name: "Cancel" });
      expect(document.activeElement).toBe(cancel);
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("dropdown", () => {
  it("opens, navigates with arrows and selects on Enter", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        placement="Row actions"
        trigger={<button type="button">Actions</button>}
        sections={[{ label: "Schedule", items: [{ label: "Today", onSelect }] }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    const item = screen.getByRole("menuitem", { name: "Today" });
    await waitFor(() => expect(document.activeElement).toBe(item));
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("command palette", () => {
  it("filters, navigates and commits the active item", () => {
    const onSelect = vi.fn();
    const items: CommandItem[] = [
      { id: "today", label: "Go to Today", keywords: "home", group: "Navigate", onSelect },
      { id: "note", label: "New note", keywords: "write", group: "Actions", onSelect },
    ];
    render(<CommandMenu open onClose={vi.fn()} items={items} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "note" } });
    expect(screen.queryByRole("option", { name: /Go to Today/ })).toBeNull();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("calendar", () => {
  it("renders the displayed month and reports a selected day", () => {
    const onValueChange = vi.fn();
    const onMonthChange = vi.fn();
    render(
      <MonthCalendar
        value={new Date(2026, 9, 15).getTime()}
        onValueChange={onValueChange}
        displayedMonth={new Date(2026, 9, 1).getTime()}
        onDisplayedMonthChange={onMonthChange}
      />,
    );
    const day = screen.getByRole("gridcell", { name: /October 20, 2026/ });
    fireEvent.click(day);
    expect(onValueChange).toHaveBeenCalledWith(new Date(2026, 9, 20).getTime());
  });

  it("navigates month with previous button", () => {
    const onMonthChange = vi.fn();
    render(
      <MonthCalendar
        displayedMonth={new Date(2026, 9, 1).getTime()}
        onDisplayedMonthChange={onMonthChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2026, 8, 1).getTime());
  });
});

describe("date picker", () => {
  it("opens, selects a date and clears it", async () => {
    const onValueChange = vi.fn();
    render(
      <DatePicker
        value={new Date(2026, 9, 15).getTime()}
        onValueChange={onValueChange}
        ariaLabel="Deadline"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Deadline" }));
    await waitFor(() => {
      const day = screen.getByRole("gridcell", { name: /October 20, 2026/ });
      fireEvent.click(day);
    });
    expect(onValueChange).toHaveBeenCalledWith(new Date(2026, 9, 20).getTime());
    fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});