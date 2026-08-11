"use client";

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";

const LENGTH = 6;
// Crockford-ish: mismo alfabeto que isValidPickupCode en src/lib/codes.ts.
const ALPHABET = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]$/;

interface Props {
  name: string;
  autoFocus?: boolean;
}

export function OtpCodeInput({ name, autoFocus = true }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const joined = digits.join("");

  function setDigit(index: number, raw: string) {
    const upper = raw.toUpperCase();
    const ch = upper.slice(-1); // si pega muchos, lo último gana en este slot
    if (ch && !ALPHABET.test(ch)) return;
    const next = [...digits];
    next[index] = ch;
    setDigits(next);
    if (ch && index < LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const chars = e.clipboardData
      .getData("text")
      .toUpperCase()
      .split("")
      .filter((c) => ALPHABET.test(c))
      .slice(0, LENGTH);
    if (!chars.length) return;
    const next = Array(LENGTH).fill("");
    chars.forEach((c, i) => (next[i] = c));
    setDigits(next);
    refs.current[Math.min(chars.length, LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      <input type="hidden" name={name} value={joined} />
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          aria-label={`Carácter ${i + 1} de ${LENGTH}`}
          className="h-16 w-12 rounded-xl border-2 border-ink-700 bg-ink-850 text-center font-mono text-3xl font-bold text-ink-100 caret-accent transition-colors focus:border-accent focus:outline-none sm:h-20 sm:w-14 sm:text-4xl"
        />
      ))}
    </div>
  );
}
