/**
 * Text Extraction / Smart Read modal:
 * - sentence-based reading
 * - current sentence highlight + current word highlight
 * - search (typing + voice)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Mic, Search, Volume2, X } from "lucide-react";

interface TextExtractionModalProps {
  allText: string[];
  isOpen: boolean;
  onClose: () => void;
  /** Controls auto-read on open only; manual Read button remains available. */
  speakEnabled?: boolean;
}

export function TextExtractionModal({
  allText,
  isOpen,
  onClose,
  speakEnabled = true,
}: TextExtractionModalProps) {
  const [zoom, setZoom] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceSearching, setVoiceSearching] = useState(false);
  /** One automatic read per modal open once non-empty text is available */
  const autoPlayedRef = useRef(false);
  const recogRef = useRef<any>(null);

  const sentences = useMemo(() => allText.filter(Boolean), [allText]);
  const fullText = useMemo(() => sentences.join("\n\n"), [sentences]);
  const contentJoined = allText.filter(Boolean).join("\u0001");
  const filteredSentenceIndexes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sentences.map((_, i) => i);
    return sentences
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.toLowerCase().includes(q))
      .map(({ i }) => i);
  }, [sentences, searchQuery]);

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  useEffect(() => {
    return () => {
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      if (recogRef.current) {
        try {
          recogRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  /** Sequential TTS when open + text ready (handles text arriving after open) */
  useEffect(() => {
    if (!isOpen) {
      autoPlayedRef.current = false;
      return;
    }
    if (!speakEnabled) {
      autoPlayedRef.current = true;
      return;
    }
    const parts = allText.filter(Boolean);
    if (parts.length === 0) return;
    if (autoPlayedRef.current) return;
    autoPlayedRef.current = true;

    window.speechSynthesis.cancel();
    let i = 0;
    setIsSpeaking(true);
    setActiveSentenceIndex(0);
    setActiveWordIndex(-1);
    const speakNext = () => {
      if (i >= parts.length) {
        setIsSpeaking(false);
        setActiveSentenceIndex(-1);
        setActiveWordIndex(-1);
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i]);
      u.rate = 0.95;
      u.lang = "en-US";
      setActiveSentenceIndex(i);
      u.onboundary = (e: SpeechSynthesisEvent) => {
        if (e.name !== "word") return;
        const spoken = parts[i].slice(0, e.charIndex);
        const idx = spoken.trim() ? spoken.trim().split(/\s+/).length : 0;
        setActiveWordIndex(idx);
      };
      u.onend = () => {
        i += 1;
        setActiveWordIndex(-1);
        speakNext();
      };
      u.onerror = () => {
        setIsSpeaking(false);
        setActiveSentenceIndex(-1);
        setActiveWordIndex(-1);
      };
      window.speechSynthesis.speak(u);
    };
    speakNext();
    return () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setActiveSentenceIndex(-1);
      setActiveWordIndex(-1);
    };
  }, [isOpen, contentJoined, speakEnabled]);

  const handleStopSpeak = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveSentenceIndex(-1);
    setActiveWordIndex(-1);
  };

  const handleReadAll = () => {
    if (!("speechSynthesis" in window)) return;
    handleStopSpeak();
    const targets = filteredSentenceIndexes.length
      ? filteredSentenceIndexes.map((i) => sentences[i])
      : sentences;
    if (targets.length === 0) return;
    let i = 0;
    setIsSpeaking(true);
    const speakNext = () => {
      if (i >= targets.length) {
        setIsSpeaking(false);
        setActiveSentenceIndex(-1);
        setActiveWordIndex(-1);
        return;
      }
      const sentence = targets[i];
      const sentenceIndex = sentences.indexOf(sentence);
      setActiveSentenceIndex(sentenceIndex);
      setActiveWordIndex(-1);
      const u = new SpeechSynthesisUtterance(sentence);
      u.rate = 0.95;
      u.lang = "en-US";
      u.onboundary = (e: SpeechSynthesisEvent) => {
        if (e.name !== "word") return;
        const spoken = sentence.slice(0, e.charIndex);
        const idx = spoken.trim() ? spoken.trim().split(/\s+/).length : 0;
        setActiveWordIndex(idx);
      };
      u.onend = () => {
        i += 1;
        speakNext();
      };
      u.onerror = () => {
        setIsSpeaking(false);
        setActiveSentenceIndex(-1);
        setActiveWordIndex(-1);
      };
      window.speechSynthesis.speak(u);
    };
    speakNext();
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleVoiceSearch = () => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const recog = new SR();
      recog.lang = "en-US";
      recog.interimResults = false;
      recog.maxAlternatives = 1;
      recogRef.current = recog;
      setVoiceSearching(true);
      recog.onresult = (event: any) => {
        const text = String(event?.results?.[0]?.[0]?.transcript || "").trim();
        if (text) setSearchQuery(text);
      };
      recog.onerror = () => setVoiceSearching(false);
      recog.onend = () => setVoiceSearching(false);
      recog.start();
    } catch {
      setVoiceSearching(false);
    }
  };

  if (!isOpen) return null;

  const fontSize = Math.round(18 * zoom);

  return (
    <div className="fixed inset-0 z-[120] bg-black text-white">
      <div className="flex h-full w-full flex-col" role="dialog" aria-labelledby="extract-title">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <h2 id="extract-title" className="text-base font-semibold tracking-tight">
            Detected text
          </h2>
          <button
            type="button"
            onClick={() => {
              handleStopSpeak();
              onClose();
            }}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-neutral-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search word..."
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-[#0D47A1]"
              />
            </div>
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                voiceSearching
                  ? "border-[#0D47A1] bg-[#0D47A1] text-white"
                  : "border-neutral-600 bg-neutral-900 text-white hover:bg-neutral-800"
              }`}
            >
              <Mic className="h-4 w-4" />
              {voiceSearching ? "Listening..." : "Voice"}
            </button>
          </div>
        </div>

        <div className="min-h-[120px] flex-1 overflow-y-auto px-4 py-4">
          {filteredSentenceIndexes.map((idx) => {
            const sentence = sentences[idx];
            const isActiveSentence = idx === activeSentenceIndex;
            const words = sentence.split(/\s+/);
            const q = searchQuery.trim();
            const queryRegex = q ? new RegExp(`(${escapeRegExp(q)})`, "ig") : null;
            return (
              <p
                key={idx}
                className={`mb-4 last:mb-0 whitespace-pre-wrap break-words rounded px-1 ${
                  isActiveSentence ? "bg-[rgba(255,255,255,0.08)]" : "text-white"
                }`}
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
              >
                {words.map((word, wIdx) => {
                  const activeWord = isActiveSentence && wIdx === activeWordIndex;
                  const segments = queryRegex ? word.split(queryRegex) : [word];
                  return (
                    <span
                      key={`${idx}-${wIdx}`}
                      className={activeWord ? "rounded bg-[#0D47A1] px-1 text-white" : ""}
                    >
                      {segments.map((seg, segIdx) => {
                        const isMatch = !!queryRegex && q.length > 0 && seg.toLowerCase() === q.toLowerCase();
                        if (!isMatch) return <span key={`${idx}-${wIdx}-${segIdx}`}>{seg}</span>;
                        return (
                          <mark
                            key={`${idx}-${wIdx}-${segIdx}`}
                            className="rounded bg-yellow-300 px-0.5 text-black"
                          >
                            {seg}
                          </mark>
                        );
                      })}
                      {wIdx < words.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </p>
            );
          })}
          {filteredSentenceIndexes.length === 0 && (
            <p className="text-neutral-500">No text detected.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-neutral-800 px-4 py-3">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            <ChevronDown className="h-4 w-4" />
            Smaller
          </button>
          <span className="px-2 text-sm text-neutral-400">{fontSize}px</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            <ChevronUp className="h-4 w-4" />
            Larger
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-neutral-800 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          <button
            type="button"
            onClick={isSpeaking ? handleStopSpeak : handleReadAll}
            disabled={!("speechSynthesis" in window) && !isSpeaking}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-black hover:bg-white min-w-[120px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Volume2 className="h-4 w-4" />
            {isSpeaking ? "Stop" : "Read"}
          </button>
          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-600 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 min-w-[120px]"
          >
            <Copy className="h-4 w-4" />
            {copiedAll ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
