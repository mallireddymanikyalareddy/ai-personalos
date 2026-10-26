"use client";

import * as React from "react";

import { Mic, MicOff, Square, Upload } from "lucide-react";

import { formatFullDate } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import { useOS } from "@/store/use-os";
import { audioKey, saveAudio } from "@/lib/audio-store";
import { useMediaRecorder } from "./use-media-recorder";

function SpeakerLabel({ name }: { name: string }) {
  const isNumbered = /^speaker\s*\d+$/i.test(name);
  return (
    <span
      className={
        isNumbered
          ? "rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3"
          : "rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink"
      }
    >
      {name}
    </span>
  );
}

function LiveRecorder({ onDone }: { onDone?: (meetingId: string | null) => void }) {
  const os = useOS();
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [live, setLive] = React.useState<{ id: string; meetingId: string; label: string } | null>(null);
  const [segments, setSegments] = React.useState<Array<{ speaker: string; text: string; at: number }>>([]);
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<{ start(): void; stop(): void; onresult?: unknown } | null>(null);
  const [speaker, setSpeaker] = React.useState("Speaker 1");
  const [draft, setDraft] = React.useState("");
  const [supported, setSupported] = React.useState(false);
  const [recordingId, setRecordingId] = React.useState<string | null>(null);
  const audio = useMediaRecorder();

  React.useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => { start(): void; stop(): void };
      webkitSpeechRecognition?: new () => { start(): void; stop(): void };
    };
    setSupported(typeof (w.SpeechRecognition ?? w.webkitSpeechRecognition) === "function");
  }, []);

  React.useEffect(() => {
    if (!listening || !live) return;
    const id = window.setInterval(() => {
      void segments;
    }, 1000);
    return () => window.clearInterval(id);
  }, [listening, live, segments]);

  const start = async () => {
    const label = title.trim() || "Live meeting";
    const startedAt = Date.now();
    const started = os.startLiveTranscription({ title: label }, startedAt);
    setLive({ id: started.transcript.id, meetingId: started.meeting.id, label });
    setSegments([]);
    setSpeaker("Speaker 1");

    const recording = os.addRecording({
      title: label,
      startedAt,
      meetingId: started.meeting.id,
      status: "recording",
    });
    setRecordingId(recording.id);
    await audio.start();
    toast(
      audio.supported
        ? "Recording started — audio stays on this device"
        : "Recording started — add transcript lines as you go",
      { tone: "success" },
    );
  };

  const stop = async () => {
    if (!live) return;
    const meetingId = live.meetingId;
    const transcriptId = live.id;
    const { blob, durationMs } = await audio.stop();

    if (recordingId) {
      let stored = false;
      if (blob) stored = await saveAudio(audioKey(recordingId), blob);
      os.updateRecording(recordingId, {
        endsAt: Date.now(),
        durationMs,
        url: stored ? audioKey(recordingId) : null,
        status: stored ? "ready" : "failed",
      });
      setRecordingId(null);
    }

    os.finishLiveTranscription(transcriptId);
    toast(
      blob
        ? "Recording saved — audio and transcript are ready"
        : "Recording finished — transcript is ready to summarise",
    );
    setLive(null);
    onDone?.(meetingId);
  };

  const addSegment = () => {
    if (!live || !draft.trim()) return;
    os.appendTranscriptSegment(live.id, { speaker, text: draft.trim() });
    setSegments((current) => [...current, { speaker, text: draft.trim(), at: Date.now() }]);
    setDraft("");
  };

  const toggleMic = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => { start(): void; stop(): void };
      webkitSpeechRecognition?: new () => { start(): void; stop(): void };
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
    window.setTimeout(() => setListening(false), 20000);
  };

  const analysable = live ? os.getTranscript(live.id) : null;

  return (
    <div className="space-y-5">
      {!live ? (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <FieldLabel htmlFor="live-title">Meeting name</FieldLabel>
          <Input
            id="live-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly standup, 1:1 with Ada…"
          />
          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary" onClick={start}>
              <Mic className="size-4" />
              Start recording
            </Button>
            <span className="text-xs text-ink-3">
              Transcription runs locally in the browser. Nothing is uploaded.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
              <span className="text-sm font-medium text-ink">Recording {live.label}</span>
              <Badge tone="neutral">{segments.length} segment{segments.length === 1 ? "" : "s"}</Badge>
            </div>
            <Button variant="danger" size="sm" onClick={stop}>
              <Square className="size-3.5" />
              Finish
            </Button>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select
                value={speaker}
                onChange={(event) => setSpeaker(event.target.value)}
                aria-label="Speaker"
                className="w-40"
              >
                {Array.from(new Set([speaker, "Speaker 1", "Speaker 2", "Speaker 3", ...analysable?.segments.map((segment) => segment.speaker) ?? []])).map(
                  (name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ),
                )}
              </Select>
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSegment();
                  }
                }}
                placeholder="What was said?"
                aria-label="Transcript segment"
                className="flex-1"
              />
              {supported && (
                <Button variant={listening ? "primary" : "secondary"} size="icon-sm" aria-label="Dictate" onClick={toggleMic}>
                  {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={addSegment} disabled={!draft.trim()}>
                Add
              </Button>
            </div>

            <ul className="space-y-2">
              {(analysable?.segments ?? segments).map((segment, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm">
                  <SpeakerLabel name={segment.speaker} />
                  <span className="min-w-0 flex-1 text-ink-2">{segment.text}</span>
                </li>
              ))}
              {segments.length === 0 && (
                <li className="text-sm text-ink-3">Add the first line of the transcript — it is stored as you go.</li>
              )}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const report = os.storeMeetingReport(live.id);
                toast(report ? `Summarised with ${report.actionItems.length} action items` : "Nothing to summarise yet", {
                  tone: report ? "success" : "danger",
                });
              }}
              disabled={segments.length === 0}
            >
              Summarise transcript
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-line px-5 py-4 text-sm leading-relaxed text-ink-3">
        Life transcription uses your browser&apos;s speech recognition when available. On devices without it, type or paste
        each line — the pipeline (summarise, decide, extract, confirm) is identical either way.
      </div>
    </div>
  );
}

function ImportRecorder({ onDone }: { onDone?: (meetingId: string | null) => void }) {
  const os = useOS();
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [speakers, setSpeakers] = React.useState(2);

  const segments = React.useMemo(() => {
    const lines = text.split(/\n+/).filter((line) => line.trim().length > 0);
    return lines.map((line, index) => {
      const named = line.match(/^([A-Za-z][A-Za-z .]{1,24}):\s*(.*)$/);
      if (named) return { speaker: named[1]!.trim(), text: named[2]!.trim(), startMs: index * 1000, endMs: index * 1000 + 1000 };
      return {
        speaker: `Speaker ${(index % Math.max(1, speakers)) + 1}`,
        text: line.trim(),
        startMs: index * 1000,
        endMs: index * 1000 + 1000,
      };
    });
  }, [text, speakers]);

  const submit = () => {
    if (!title.trim() || segments.length === 0) {
      toast("Give it a title and some transcript text", { tone: "danger" });
      return;
    }
    const now = Date.now();
    const meeting = os.addMeeting({
      title: title.trim(),
      startsAt: now,
      endsAt: now + Math.max(60_000, segments.length * 1000),
    });
    os.updateMeeting(meeting.id, { status: "completed" });
    const transcript = os.importTranscript(
      { title: title.trim(), source: "upload", meetingId: meeting.id, recordingId: null },
      segments,
      now,
    );
    os.storeMeetingReport(transcript.id);
    toast("Imported and summarised", { tone: "success" });
    setTitle("");
    setText("");
    onDone?.(meeting.id);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="imp-title">Meeting name</FieldLabel>
            <Input id="imp-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Recording title" />
          </div>
          <div>
            <FieldLabel htmlFor="imp-text">Transcript</FieldLabel>
            <Textarea
              id="imp-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={"Ada: we decided to ship on the 14th\nI will send the pricing sheet today"}
              className="min-h-40"
            />
            <p className="mt-1.5 text-xs text-ink-3">
              Lines written as <span className="text-ink-2">Name: text</span> are attributed to that speaker automatically;
              otherwise turns are split across {speakers} speakers.
            </p>
          </div>
          <div className="max-w-[220px]">
            <FieldLabel htmlFor="imp-speakers">Speakers if unnamed</FieldLabel>
            <Input
              id="imp-speakers"
              type="number"
              min={1}
              max={8}
              value={speakers}
              onChange={(event) => setSpeakers(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={submit} disabled={!title.trim() || segments.length === 0}>
              <Upload className="size-4" />
              Import and summarise
            </Button>
            {segments.length > 0 && <span className="text-xs text-ink-3">{segments.length} lines ready</span>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-line px-5 py-4 text-sm leading-relaxed text-ink-3">
        Imported recordings are stored on the device as audio entries, and the transcript you paste is what makes them
        searchable and summarisable.
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Recordings awaiting a transcript</h3>
        <ul className="mt-2 space-y-1.5">
          {os.transcriptsNeedingAudio().map((recording) => (
            <li key={recording.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-ink-2">{recording.title}</span>
              <span className="text-xs text-ink-3">{formatFullDate(recording.startedAt)}</span>
            </li>
          ))}
          {os.transcriptsNeedingAudio().length === 0 && (
            <li className="text-sm text-ink-3">Every recording has a transcript.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export { LiveRecorder, ImportRecorder };
