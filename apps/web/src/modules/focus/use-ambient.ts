"use client";

import * as React from "react";

import type { FocusAmbient } from "@personalos/core";

interface AmbientNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  stop: () => void;
}

function noiseBuffer(ctx: AudioContext, kind: "white" | "brown"): AudioBuffer {
  const seconds = 3;
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (kind === "white") {
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export function useAmbientSound(current: FocusAmbient, enabled: boolean) {
  const ctxRef = React.useRef<AudioContext | null>(null);
  const nodesRef = React.useRef<AmbientNodes | null>(null);
  const gainRef = React.useRef<number>(0.35);

  const teardown = React.useCallback(() => {
    nodesRef.current?.stop();
    nodesRef.current = null;
  }, []);

  const build = React.useCallback(
    (ctx: AudioContext, kind: FocusAmbient): AmbientNodes => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);

      const fade = () => {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(gainRef.current, ctx.currentTime + 0.8);
      };

      if (kind === "rain" || kind === "waves") {
        const buffer = noiseBuffer(ctx, "white");
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = kind === "rain" ? "bandpass" : "lowpass";
        filter.frequency.value = kind === "rain" ? 2200 : 700;
        filter.Q.value = kind === "rain" ? 0.6 : 0.9;

        source.connect(filter);
        filter.connect(gain);

        let lfo: OscillatorNode | null = null;
        let lfoGain: GainNode | null = null;
        if (kind === "waves") {
          lfo = ctx.createOscillator();
          lfo.frequency.value = 0.12;
          lfoGain = ctx.createGain();
          lfoGain.gain.value = 320;
          lfo.connect(lfoGain);
          lfoGain.connect(filter.frequency);
          lfo.start();
        }

        source.start();
        fade();

        return {
          source,
          gain,
          stop: () => {
            gain.gain.cancelScheduledValues(ctx.currentTime);
            gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
            window.setTimeout(() => {
              try {
                source.stop();
                lfo?.stop();
              } catch {
                /* already stopped */
              }
            }, 450);
          },
        };
      }

      const buffer = noiseBuffer(ctx, kind === "brown" ? "brown" : "white");
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = kind === "brown" ? 520 : 9000;
      source.connect(filter);
      filter.connect(gain);
      source.start();
      fade();

      return {
        source,
        gain,
        stop: () => {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
          window.setTimeout(() => {
            try {
              source.stop();
            } catch {
              /* already stopped */
            }
          }, 450);
        },
      };
    },
    [],
  );

  React.useEffect(() => {
    if (!enabled || current === "none") {
      teardown();
      return;
    }

    const Ctor =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctor) return;

    if (!ctxRef.current) ctxRef.current = new Ctor();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const nodes = build(ctx, current);
    nodesRef.current = nodes;

    return () => {
      nodes.stop();
      nodesRef.current = null;
    };
  }, [current, enabled, build, teardown]);

  React.useEffect(
    () => () => {
      teardown();
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [teardown],
  );

  const setVolume = React.useCallback((value: number) => {
    gainRef.current = Math.max(0, Math.min(1, value));
    const gain = nodesRef.current?.gain;
    const ctx = ctxRef.current;
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(gainRef.current, ctx.currentTime + 0.2);
    }
  }, []);

  return { setVolume };
}

export const AMBIENT_OPTIONS: Array<{ value: FocusAmbient; label: string; hint: string }> = [
  { value: "none", label: "Silence", hint: "No sound" },
  { value: "white", label: "White noise", hint: "Even hiss, masks speech" },
  { value: "brown", label: "Brown noise", hint: "Deeper, softer rumble" },
  { value: "rain", label: "Rain", hint: "Band-passed rainfall" },
  { value: "waves", label: "Waves", hint: "Slowly rolling surf" },
];