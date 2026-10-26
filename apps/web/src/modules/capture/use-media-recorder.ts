"use client";

import * as React from "react";

export interface RecordedMedia {
  blob: Blob;
  mimeType: string;
}

interface UseMediaRecorderResult {
  supported: boolean;
  recording: boolean;
  error: string | null;
  start: () => void;
  stop: () => Promise<RecordedMedia | null>;
}

export function useMediaRecorder(): UseMediaRecorderResult {
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const [recording, setRecording] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof window.MediaRecorder === "function";

  const start = React.useCallback(() => {
    setError(null);
    if (recorderRef.current) return;
    if (!supported || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording is not supported here. Upload an audio file instead.");
      return;
    }
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        let mimeType = "audio/webm";
        if (typeof MediaRecorder.isTypeSupported === "function") {
          mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm";
        }
        const recorder = new MediaRecorder(stream, { mimeType });
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
        };
        recorderRef.current = recorder;
        recorder.start();
        setRecording(true);
      })
      .catch(() => {
        setError("Microphone access was denied.");
      });
  }, [supported]);

  const stop = React.useCallback<() => Promise<RecordedMedia | null>>(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      recorder.onstop = () => {
        recorderRef.current = null;
        setRecording(false);
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size === 0) {
          resolve(null);
          return;
        }
        resolve({ blob, mimeType: type });
      };
      recorder.stop();
    });
  }, []);

  React.useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
    };
  }, []);

  return { supported, recording, error, start, stop };
}