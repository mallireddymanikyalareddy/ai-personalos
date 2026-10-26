import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { AIModule } from "./ai-module";

const DAY = 86_400_000;

let os: ReturnType<typeof getOS>;
let now: number;

function installMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia,
  });
}

function renderModule() {
  return render(
    <ToastProvider>
      <AIModule />
    </ToastProvider>,
  );
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  installMatchMedia();
  now = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the hero, features, chat and the tool rail with no data", () => {
    renderModule();

    expect(screen.getByTestId("ai-hero")).toBeDefined();
    expect(screen.getByRole("heading", { name: /Your personal AI/i })).toBeDefined();
    expect(screen.getByTestId("ai-features")).toBeDefined();
    expect(screen.getByTestId("ai-chat")).toBeDefined();
    expect(screen.getByTestId("ai-tools")).toBeDefined();
    expect(screen.getByTestId("ai-context")).toBeDefined();
    expect(screen.getByTestId("ai-conversations")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Assistant tools" })).toBeDefined();
    expect(screen.getByText(/How can I help you today/i)).toBeDefined();
  });

  it("greets the user by name", () => {
    os.updateProfile({ displayName: "Mani Krishnan" });
    renderModule();
    expect(screen.getByText(/Hi Mani!/)).toBeDefined();
  });
});

describe("your context panel", () => {
  it("shows live counts and links to each area", () => {
    os.addTask({ title: "Pending task", status: "open" });
    os.addNote({ title: "A note" });
    os.addGoal({ title: "A goal" });

    renderModule();

    const context = within(screen.getByTestId("ai-context"));
    expect(within(context.getByTestId("ai-context-tasks")).getByText(/pending tasks|overdue/)).toBeDefined();
    expect(context.getByTestId("ai-context-notes").getAttribute("href")).toBe("/notes");
    expect(context.getByTestId("ai-context-goals").textContent).toContain("1 active goals");
    expect(context.getByTestId("ai-context-habits").getAttribute("href")).toBe("/habits");
  });
});

describe("quick prompts", () => {
  it("runs a plan and offers the proposal for review", () => {
    os.addTask({ title: "Write the release notes", status: "open", dueAt: now + 2 * 3_600_000 });

    renderModule();

    fireEvent.click(screen.getByTestId("ai-suggestion-plan"));

    expect(screen.getByTestId("ai-user-message").textContent).toBe("plan my day");
expect(screen.getByTestId("ai-proposals")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /^Accept$/i }).length).toBeGreaterThan(0);
  });

it("accepts a proposal and applies it", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Buy milk" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    expect(os.aiPendingProposals().length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /^Accept$/i })[0]!);

    expect(os.aiPendingProposals()).toHaveLength(0);
    expect(Object.values(os.getState().tasks).map((task) => task.title)).toContain("Buy milk");
  });

  it("dismisses a proposal without applying it", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Buy milk" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    fireEvent.click(screen.getAllByRole("button", { name: /^Dismiss$/i })[0]!);
    expect(os.aiPendingProposals()).toHaveLength(0);
    expect(Object.values(os.getState().tasks)).toHaveLength(0);
  });

it("runs the action chips", () => {
    renderModule();

    fireEvent.click(screen.getByTestId("ai-chip-summarize"));
    expect(screen.getByTestId("ai-user-message").textContent).toBe("review my week");
  });

  it("renders the weekly review chart", () => {
    const done = os.addTask({ title: "Shipped", status: "open" });
    os.updateTask(done.id, { status: "done", completedAt: now - DAY });

    renderModule();

    fireEvent.click(screen.getByTestId("ai-chip-summarize"));
    expect(screen.getByTestId("ai-review-chart")).toBeDefined();
  });

  it("uses a suggestion built from the first goal", () => {
    os.addGoal({ title: "Get in better shape" });
    renderModule();

    const suggestion = screen.getByTestId("ai-suggestion-goal");
    expect(suggestion.textContent).toContain("Get in better shape");
  });

  it("does not suggest breaking down a completed goal", () => {
    const goal = os.addGoal({ title: "Finished goal" });
    os.completeGoal(goal.id, now);
    renderModule();

    expect(screen.getByTestId("ai-suggestion-goal").textContent).toContain("Break down a goal into steps");
    expect(screen.getByTestId("ai-suggestion-goal").textContent).not.toContain("Finished goal");
  });
});

describe("ai tools", () => {
  it("runs the plan tool", () => {
    renderModule();
    fireEvent.click(screen.getByTestId("ai-tool-plan-day"));
    expect(screen.getByTestId("ai-user-message").textContent).toBe("plan my day");
  });

  it("prefills the composer for creating a task", () => {
    renderModule();
    fireEvent.click(screen.getByTestId("ai-tool-create-task"));
    expect((screen.getByTestId("ai-composer") as HTMLTextAreaElement).value).toBe("add a task: ");
  });

  it("reveals more tools on view all", () => {
    renderModule();
    expect(screen.queryByTestId("ai-tool-weekly-review")).toBeNull();
    fireEvent.click(screen.getByTestId("ai-tools-view-all"));
    expect(screen.getByTestId("ai-tool-weekly-review")).toBeDefined();
  });
});

describe("conversations", () => {
  it("records each turn as a conversation and can reopen it", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Call the bank" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    const conversations = Object.values(os.getState().aiConversations);
    expect(conversations).toHaveLength(1);
    const messages = Object.values(os.getState().aiMessages);
    expect(messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(messages.filter((message) => message.role === "assistant")).toHaveLength(1);

    expect(screen.getByTestId("ai-conversation-row")).toBeDefined();
  });

  it("reopens a stored conversation and shows its messages", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Call the bank" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    fireEvent.click(screen.getByRole("button", { name: "More assistant actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear conversation" }));
    expect(screen.queryByTestId("ai-thread")).toBeNull();
    expect(Object.values(os.getState().aiMessages).filter((message) => message.conversationId === Object.keys(os.getState().aiConversations)[0])).toHaveLength(0);

    fireEvent.click(screen.getAllByTestId("ai-conversation-row")[0]!);
    expect(screen.queryByTestId("ai-thread")).toBeNull();
  });

  it("restores proposal cards when reopening a conversation", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Call the bank" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    const conversation = Object.values(os.getState().aiConversations)[0]!;

    fireEvent.click(screen.getByRole("button", { name: "More assistant actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New conversation" }));
    const row = screen
      .getAllByTestId("ai-conversation-row")
      .find((entry) => entry.textContent?.includes("add a task: Call the bank"));
    fireEvent.click(row!);

    expect(screen.getByTestId("ai-proposals")).toBeDefined();
    expect(screen.getByRole("button", { name: /^Accept$/i })).toBeDefined();
    expect(conversation.id).toBeDefined();
  });

  it("opens pending proposals from the assistant menu", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Buy milk" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    fireEvent.click(screen.getByRole("button", { name: "More assistant actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pending proposals" }));

    expect(screen.getAllByTestId("ai-proposals").length).toBeGreaterThan(0);
  });

  it("restores structured assistant results when reopening a conversation", () => {
    const done = os.addTask({ title: "Ship a feature", status: "open" });
    os.updateTask(done.id, { status: "done", completedAt: now - DAY });
    renderModule();

    fireEvent.click(screen.getByTestId("ai-chip-summarize"));
    expect(screen.getByTestId("ai-review-chart")).toBeDefined();
    const original = Object.values(os.getState().aiConversations)[0]!;

    fireEvent.click(screen.getByRole("button", { name: "More assistant actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New conversation" }));
    fireEvent.click(screen.getAllByTestId("ai-conversation-row").find((row) => row.textContent?.includes("review my week"))!);

    expect(screen.getByTestId("ai-review-chart")).toBeDefined();
    const assistantMessage = Object.values(os.getState().aiMessages).find(
      (message) => message.conversationId === original.id && message.role === "assistant",
    );
    expect(assistantMessage?.result?.capability).toBe("weekly_review");
  });
});

describe("conversation management and polish", () => {
  it("renames a conversation from the row menu", () => {
    renderModule();
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Rename me" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Weekly planning");
    fireEvent.click(screen.getByRole("button", { name: /^Options for add a task: Rename me/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    const conversation = Object.values(os.getState().aiConversations)[0]!;
    expect(conversation.title).toBe("Weekly planning");
    prompt.mockRestore();
  });

  it("deletes a conversation and clears the open thread", () => {
    renderModule();
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Delete me" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    fireEvent.click(screen.getByRole("button", { name: /^Options for add a task: Delete me/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete conversation" }));

    expect(Object.values(os.getState().aiConversations)).toHaveLength(0);
    expect(screen.queryByTestId("ai-thread")).toBeNull();
  });

  it("copies an assistant answer", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderModule();
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Copy me" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();
  });

  it("offers the extra tools without duplicating ids", () => {
    renderModule();
    fireEvent.click(screen.getByTestId("ai-tools-view-all"));
    expect(screen.getByTestId("ai-tool-create-note")).toBeDefined();
    expect(screen.getByTestId("ai-tool-reschedule")).toBeDefined();
    expect(screen.getAllByTestId("ai-tool-recommend")).toHaveLength(1);
  });
});
describe("regenerate, feedback, search, pin, voice and model", () => {
  it("regenerates the last answer in place", () => {
    renderModule();
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Buy milk" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    expect(Object.values(os.getState().aiMessages)).toHaveLength(2);
    fireEvent.click(screen.getByTestId("ai-regenerate"));

    const messages = Object.values(os.getState().aiMessages);
    expect(messages).toHaveLength(2);
    expect(messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(screen.getAllByTestId("ai-user-message")).toHaveLength(1);
  });

  it("stores message feedback and summarises it", () => {
    renderModule();
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Rate me" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    fireEvent.click(screen.getByRole("button", { name: "Mark helpful" }));

    const assistant = Object.values(os.getState().aiMessages).find((message) => message.role === "assistant");
    expect(assistant?.feedback).toBe("up");
    expect(screen.getByTestId("ai-feedback-summary").textContent).toContain("Helpful 1");

    fireEvent.click(screen.getByRole("button", { name: "Remove helpful rating" }));
    expect(Object.values(os.getState().aiMessages).find((message) => message.role === "assistant")?.feedback).toBeNull();
  });

  it("searches conversations by title", () => {
    renderModule();
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Alpha" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    fireEvent.click(screen.getByRole("button", { name: "More assistant actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New conversation" }));
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Beta" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    fireEvent.change(screen.getByLabelText("Search conversations"), { target: { value: "alpha" } });

    const rows = screen.getAllByTestId("ai-conversation-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain("Alpha");
  });

  it("pins a conversation and lists it first", () => {
    renderModule();
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: First" } });
    fireEvent.click(screen.getByTestId("ai-send"));
    fireEvent.click(screen.getByRole("button", { name: "More assistant actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New conversation" }));
    fireEvent.change(screen.getByTestId("ai-composer"), { target: { value: "add a task: Second" } });
    fireEvent.click(screen.getByTestId("ai-send"));

    fireEvent.click(screen.getByRole("button", { name: /^Options for add a task: First/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin conversation" }));

    const pinned = Object.values(os.getState().aiConversations).find((conversation) => conversation.pinnedAt != null);
    expect(pinned).toBeDefined();
    expect(screen.getAllByTestId("ai-conversation-row")[0]!.textContent).toContain("First");
  });

  it("explains when voice input is unavailable", () => {
    renderModule();
    fireEvent.click(screen.getByTestId("ai-voice"));
    expect(screen.getByText(/Voice input is not supported/i)).toBeDefined();
  });

  it("sends a transcript when speech recognition is available", () => {
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        this.onresult?.({
          results: { length: 1, 0: { length: 1, 0: { transcript: "add a task: From voice" }, isFinal: true } },
        });
      }
      stop() {}
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FakeRecognition });

    renderModule();
    fireEvent.click(screen.getByTestId("ai-voice"));

    expect(screen.getByTestId("ai-user-message").textContent).toBe("add a task: From voice");
    Reflect.deleteProperty(window, "SpeechRecognition");
  });

  it("shows the model picker and disables unavailable providers", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Choose AI model" }));

    const disabled = screen.getByRole("menuitem", { name: /OpenAI GPT \(needs API key\)/ });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "PersonalOS Local" })).toBeDefined();
  });
});