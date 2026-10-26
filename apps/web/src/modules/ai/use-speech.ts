"use client";

import * as React from "react";

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}

interface SpeechEvent {
  readonly results: SpeechResultList;
}

interface SpeechRecognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognizerCtor = new () => SpeechRecognizer;

function recognizerCtor(): SpeechRecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognizerCtor;
    webkitSpeechRecognition?: SpeechRecognizerCtor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export interface UseSpeechInputOptions {
  onTranscript: (text: string) => void;
  onUnsupported: () => void;
  onError: () => void;
}

export function useSpeechInput({ onTranscript, onUnsupported, onError }: UseSpeechInputOptions) {
  const [listening, setListening] = React.useState(false);
  const recognizerRef = React.useRef<SpeechRecognizer | null>(null);
  const handlersRef = React.useRef({ onTranscript, onUnsupported, onError });

  React.useEffect(() => {
    handlersRef.current = { onTranscript, onUnsupported, onError };
  });

  React.useEffect(
    () => () => {
      recognizerRef.current?.abort();
    },
    [],
  );

  const stop = React.useCallback(() => {
    recognizerRef.current?.stop();
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    const Ctor = recognizerCtor();
    if (!Ctor) {
      handlersRef.current.onUnsupported();
      return;
    }
    if (listening) {
      stop();
      return;
    }
    const recognizer = new Ctor();
    recognizer.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    recognizer.interimResults = false;
    recognizer.continuous = false;
    recognizer.onresult = (event) => {
      const results = event.results;
      const last = results[results.length - 1];
      const transcript = last?.[0]?.transcript?.trim() ?? "";
      if (transcript.length > 0) handlersRef.current.onTranscript(transcript);
    };
    recognizer.onerror = () => {
      handlersRef.current.onError();
      setListening(false);
    };
    recognizer.onend = () => setListening(false);
    recognizerRef.current = recognizer;
    setListening(true);
    try {
      recognizer.start();
    } catch {
      setListening(false);
      handlersRef.current.onError();
    }
  }, [listening, stop]);

  return { supported: recognizerCtor() != null, listening, start, stop };
}
