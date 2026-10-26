"use client";

import * as React from "react";

export interface MediaRecorderState {
  supported: boolean;
  recording: boolean;
  elapsedMs: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob | null; durationMs: number }>;
}

/**
 * Records the microphone with MediaRecorder when the browser supports it.
 * The blob is returned to the caller so it can be stored locally (IndexedDB).
 */
export function useMediaRecorder(): MediaRecorderState {
  const [recording, setRecording] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [supported, setSupported] = React.useState(false);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef(0);
  const stopResolveRef = React.useRef<((blob: Blob | null) => void) | null>(null);

  React.useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  React.useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 500);
    return () => window.clearInterval(id);
  }, [recording]);

  React.useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = React.useCallback(async () => {
    setError(null);
    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("This browser cannot record audio. Type or paste the transcript instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        stopResolveRef.current?.(blob);
        stopResolveRef.current = null;
        setElapsedMs(Date.now() - startedAtRef.current);
        setRecording(false);
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access was blocked. Type or paste the transcript instead.");
      setRecording(false);
    }
  }, []);

  const stop = React.useCallback(async () => {
    const recorder = recorderRef.current;
    const durationMs = Math.max(0, Date.now() - startedAtRef.current);
    if (!recorder || recorder.state === "inactive") {
      return { blob: null, durationMs };
    }
    const blob = await new Promise<Blob | null>((resolve) => {
      stopResolveRef.current = resolve;
      recorder.stop();
    });
    return { blob, durationMs };
  }, []);

  return { supported, recording, elapsedMs, error, start, stop };
}
