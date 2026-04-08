"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous?: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export interface VoiceInputProps {
  disabled?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  continuousMode?: boolean;
  debounceMs?: number;
  listening: boolean;
  setListening: (value: boolean) => void;
  onTranscript: (text: string) => void | Promise<void>;
  onInterrupt?: () => void;
  onError: (message: string) => void;
}

export interface VoiceInputHandle {
  startListening: () => void;
  stopListening: () => void;
}

function mapSpeechError(error: string): string {
  if (error === "aborted") {
    return "";
  }

  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone permission denied. Please allow microphone access and try again.";
  }

  if (error === "no-speech") {
    return "No speech detected. Please speak clearly and try again.";
  }

  if (error === "audio-capture") {
    return "No microphone was found. Please connect a microphone and retry.";
  }

  return `Voice input failed: ${error}`;
}

export const VoiceInput = forwardRef<VoiceInputHandle, VoiceInputProps>(function VoiceInput(
  {
    disabled = false,
    isSpeaking = false,
    isThinking = false,
    continuousMode = false,
    debounceMs = 700,
    listening,
    setListening,
    onTranscript,
    onInterrupt,
    onError
  }: VoiceInputProps,
  ref
) {
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const userStoppedRef = useRef(false);
  const disabledRef = useRef(disabled);
  const speakingRef = useRef(isSpeaking);
  const continuousRef = useRef(continuousMode);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    continuousRef.current = continuousMode;
  }, [continuousMode]);

  function getSpeechRecognition(): SpeechRecognitionCtor | null {
    if (typeof window === "undefined") {
      return null;
    }

    const speechWindow = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };

    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
  }

  function stopListening(): void {
    userStoppedRef.current = true;
    recognitionRef.current?.stop();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setListening(false);
  }

  function startListening(): void {
    if (isSpeaking) {
      onInterrupt?.();
    }

    userStoppedRef.current = false;

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      onError("SpeechRecognition is unavailable in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      if (speakingRef.current) {
        onInterrupt?.();
      }
      setListening(true);
    };
    recognition.onend = () => {
      setListening(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (!userStoppedRef.current && continuousRef.current && !disabledRef.current && !speakingRef.current) {
        setTimeout(() => {
          if (!disabledRef.current && !speakingRef.current) {
            startListening();
          }
        }, 200);
      }
    };
    recognition.onerror = (event) => {
      const mapped = mapSpeechError(event.error);
      if (!mapped) {
        return;
      }

      onError(mapped);
    };
    recognition.onresult = async (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        transcript += `${piece} `;
      }

      const normalized = transcript.trim();
      if (!normalized) {
        return;
      }

      transcriptRef.current = normalized;

      if (speakingRef.current) {
        onInterrupt?.();
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        const finalText = transcriptRef.current.trim();
        transcriptRef.current = "";
        if (!finalText) {
          return;
        }

        await onTranscript(finalText);
      }, debounceMs);
    };

    recognition.start();
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      recognitionRef.current?.stop();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startListening,
    stopListening
  }));

  return (
    <div className="flex items-center gap-2">
      <button
        className="ring-focus rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-white disabled:opacity-60"
        type="button"
        disabled={disabled}
        onClick={listening ? stopListening : startListening}
      >
        {listening ? "Stop Listening" : "Voice Input"}
      </button>
      {listening && !isSpeaking && (
        <div className="flex items-center gap-2 text-xs text-slate-700" aria-live="polite">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Listening... 🎤
        </div>
      )}
      {isThinking && <div className="text-xs text-slate-700">Thinking... 🧠</div>}
      {isSpeaking && <div className="text-xs text-slate-700">Jarvis speaking... 🔊</div>}
    </div>
  );
});
