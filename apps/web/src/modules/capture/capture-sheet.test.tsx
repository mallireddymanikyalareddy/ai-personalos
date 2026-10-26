import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { CaptureProvider, useCapture } from "./capture-context";
import { CaptureSheet } from "./capture-sheet";

afterEach(cleanup);

function Harness() {
  const { openCapture } = useCapture();
  return (
    <div>
      <button type="button" onClick={() => openCapture()}>
        Open capture
      </button>
      <CaptureSheet />
    </div>
  );
}

function renderCapture() {
  return render(
    <ToastProvider>
      <CaptureProvider>
        <Harness />
      </CaptureProvider>
    </ToastProvider>,
  );
}

describe("CaptureSheet", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
  });

  it("renders closed until the shell opens it", () => {
    renderCapture();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens with 'Let AI decide' as the default mode", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    const ai = within(dialog).getByRole("radio", { name: /Let AI decide/i });
    expect(ai.getAttribute("aria-checked")).toBe("true");
  });

  it("resolves free text into a task preview", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Capture text"), {
      target: { value: "I need to call John tomorrow at 3 PM" },
    });
    expect(within(dialog).getAllByText(/^Task$/)).toHaveLength(2);
    expect(within(dialog).getByText(/Tomorrow/)).toBeTruthy();
    expect(within(dialog).getByText(/confidence 90%/)).toBeTruthy();
  });

  it("lets the user force a type", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /^Event$/ }));
    expect(
      within(dialog).getByRole("radio", { name: /^Event$/ }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.change(within(dialog).getByLabelText("Capture text"), {
      target: { value: "Dinner with parents friday at 7pm" },
    });
    expect(within(dialog).getAllByText(/^Event$/)).toHaveLength(2);
  });

  it("requires an image before image-only capture", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /^Image$/ }));
    fireEvent.change(within(dialog).getByLabelText("Capture text"), {
      target: { value: "Receipt" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Capture" }));

    expect(await screen.findByText("Add an image first")).toBeTruthy();
    expect(Object.keys(getOS().getState().notes)).toHaveLength(0);
  });

  it("stores uploaded images as persistent data URLs", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    const file = new File(["image-bytes"], "receipt.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText("Attach image"), {
      target: { files: [file] },
    });
    expect(await within(dialog).findByText("receipt.png")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Capture" }));
    await waitFor(() => expect(Object.keys(getOS().getState().notes)).toHaveLength(1));

    const attachment = Object.values(getOS().getState().attachments)[0]!;
    expect(attachment.url?.startsWith("data:image/png")).toBe(true);
  });

  it("captures into the active workspace mode", async () => {
    getOS().setActiveMode("work");
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Capture text"), {
      target: { value: "Prepare work brief" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Capture" }));

    await waitFor(() => expect(Object.values(getOS().getState().tasks)).toHaveLength(1));
    expect(Object.values(getOS().getState().tasks)[0]!.mode).toBe("work");
  });

  it("clears the current draft", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    const textarea = within(dialog).getByLabelText("Capture text") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Temporary thought" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));

    expect(textarea.value).toBe("");
    expect((within(dialog).getByRole("button", { name: "Capture" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("captures a task and confirms it was scheduled", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("Open capture"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Capture text"), {
      target: { value: "Pay rent tomorrow" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Capture" }));
    expect(await screen.findByText(/Task scheduled for/i)).toBeTruthy();
    expect(Object.keys(getOS().getState().tasks)).toHaveLength(1);
    expect(Object.values(getOS().getState().captures)).toHaveLength(1);
  });
});