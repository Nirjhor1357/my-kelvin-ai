"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

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
  listening: boolean;
  setListening: (value: boolean) => void;
  onTranscript: (text: string) => void | Promise<void>;
  onError: (message: string) => void;
}

export interface VoiceInputHandle {
  startListening: () => void;
  stopListening: () => void;
}

function mapSpeechError(error: string): string {
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
  { disabled = false, isSpeaking = false, listening, setListening, onTranscript, onError }: VoiceInputProps,
  ref
) {
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

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
    recognitionRef.current?.stop();
    setListening(false);
  }

  function startListening(): void {
    if (isSpeaking) {
      return;
    }

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      onError("SpeechRecognition is unavailable in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => onError(mapSpeechError(event.error));
    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        onError("Speech was not recognized. Please try again.");
        return;
      }

      await onTranscript(transcript);
    };

    recognition.start();
  }

  useImperativeHandle(ref, () => ({
    startListening,
    stopListening
  }));

  return (
    <div className="flex items-center gap-2">
      <button
        className="ring-focus rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-white disabled:opacity-60"
        type="button"
        disabled={disabled || isSpeaking}
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
      {isSpeaking && <div className="text-xs text-slate-700">Jarvis speaking... 🔊</div>}
    </div>
  );
});
