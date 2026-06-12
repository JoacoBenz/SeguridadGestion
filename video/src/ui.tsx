import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "./theme";

// ─── Logo ────────────────────────────────────────────────────────────────────

// Ícono de marca: caja ámbar con tilde de retiro (misma geometría que
// public/icon.svg de la app, sin el fondo redondeado).
export const LogoIcon: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <svg width={size} height={size} viewBox="0 0 512 512">
    <path
      d="M256 96 416 176v160l-160 80-160-80V176z"
      fill="none"
      stroke={C.accent}
      strokeWidth={30}
      strokeLinejoin="round"
    />
    <path
      d="M96 176l160 80 160-80M256 256v160"
      fill="none"
      stroke={C.accent}
      strokeWidth={30}
      strokeLinejoin="round"
    />
    <circle cx={400} cy={400} r={86} fill={C.accent} />
    <path
      d="M364 400l26 26 48-52"
      fill="none"
      stroke={C.bg}
      strokeWidth={26}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Wordmark "PaqueteOK": el "OK" desliza desde atrás de "Paquete".
export const Wordmark: React.FC<{
  size?: number;
  okProgress?: number; // 0 = escondido atrás, 1 = en posición
}> = ({ size = 120, okProgress = 1 }) => {
  const okX = interpolate(okProgress, [0, 1], [-size * 0.9, 0]);
  const okOpacity = interpolate(okProgress, [0, 0.35, 1], [0, 0.6, 1]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: -size * 0.03,
        lineHeight: 1,
      }}
    >
      <span style={{ color: C.text, position: "relative", zIndex: 2, backgroundColor: "transparent" }}>
        Paquete
      </span>
      <span
        style={{
          color: C.accent,
          zIndex: 1,
          transform: `translateX(${okX}px)`,
          opacity: okOpacity,
          display: "inline-block",
        }}
      >
        OK
      </span>
    </div>
  );
};

// ─── Primitivas de UI mockup ─────────────────────────────────────────────────

export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      backgroundColor: C.card,
      border: `1.5px solid ${C.border}`,
      borderRadius: 16,
      boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Tag: React.FC<{
  label: string;
  color: string;
  style?: React.CSSProperties;
}> = ({ label, color, style }) => (
  <span
    style={{
      fontFamily: FONT,
      fontSize: 22,
      fontWeight: 600,
      color,
      backgroundColor: `${color}1c`,
      border: `1.5px solid ${color}66`,
      borderRadius: 10,
      padding: "8px 18px",
      display: "inline-block",
      ...style,
    }}
  >
    {label}
  </span>
);

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: 4,
      textTransform: "uppercase",
      color: C.textDim,
    }}
  >
    {children}
  </div>
);

export const PersonBadge: React.FC<{ name: string; role: string }> = ({ name, role }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      backgroundColor: C.cardAlt,
      border: `1.5px solid ${C.border}`,
      borderRadius: 999,
      padding: "10px 22px 10px 12px",
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        backgroundColor: `${C.accent}22`,
        border: `1.5px solid ${C.accent}55`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 20,
        color: C.accent,
      }}
    >
      {name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")}
    </div>
    <div style={{ fontFamily: FONT, lineHeight: 1.25 }}>
      <div style={{ color: C.text, fontSize: 20, fontWeight: 600 }}>{name}</div>
      <div style={{ color: C.textDim, fontSize: 16 }}>{role}</div>
    </div>
  </div>
);

// ─── Helpers de animación ────────────────────────────────────────────────────

// Texto que se auto-tipea. `startFrame` absoluto dentro de la escena.
export const Typewriter: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
  showCaret?: boolean;
}> = ({ text, startFrame, charsPerFrame = 0.55, style, showCaret = true }) => {
  const frame = useCurrentFrame();
  const chars = Math.max(0, Math.floor((frame - startFrame) * charsPerFrame));
  const visible = text.slice(0, chars);
  const done = chars >= text.length;
  const typing = frame >= startFrame && !done;
  const caretOn = typing || (!done && frame < startFrame) || (done && frame % 20 < 10);
  return (
    <span style={style}>
      {visible}
      {showCaret && !done && (
        <span style={{ opacity: caretOn ? 1 : 0, color: C.accent }}>▎</span>
      )}
    </span>
  );
};

// Número que cuenta hacia arriba, formateado es-AR.
export const useCountUp = (
  startFrame: number,
  durationFrames: number,
  target: number,
): number => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // ease-out cúbico para que frene suave
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(target * eased);
};

// Círculo que pulsa simulando el click/tap sobre un botón.
export const ClickPulse: React.FC<{ clickFrame: number; x: number; y: number }> = ({
  clickFrame,
  x,
  y,
}) => {
  const frame = useCurrentFrame();
  const t = frame - clickFrame;
  if (t < -30) return null;
  // puntero aparece, se posa, clickea
  const approach = interpolate(t, [-30, 0], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringScale = interpolate(t, [0, 18], [0.3, 2.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(t, [0, 18], [0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dotOpacity = interpolate(t, [-30, -20, 6, 14], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ position: "absolute", left: x, top: y + approach, zIndex: 50 }}>
      {t >= 0 && (
        <div
          style={{
            position: "absolute",
            left: -30,
            top: -30,
            width: 60,
            height: 60,
            borderRadius: 999,
            border: `4px solid ${C.accent}`,
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: -13,
          top: -13,
          width: 26,
          height: 26,
          borderRadius: 999,
          backgroundColor: C.text,
          boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
          opacity: dotOpacity,
        }}
      />
    </div>
  );
};

// QR falso pero verosímil: grilla determinística con los 3 finder patterns.
export const FakeQR: React.FC<{ size: number; seed?: string }> = ({
  size,
  seed = "paqueteok",
}) => {
  const n = 21;
  const cell = size / (n + 4); // margen de 2 celdas
  const cells: React.ReactNode[] = [];
  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (isFinder(x, y)) continue;
      if (random(`${seed}-${x}-${y}`) > 0.52) {
        cells.push(
          <rect key={`${x}-${y}`} x={(x + 2) * cell} y={(y + 2) * cell} width={cell} height={cell} />,
        );
      }
    }
  }
  const Finder = ({ fx, fy }: { fx: number; fy: number }) => (
    <g>
      <rect x={(fx + 2) * cell} y={(fy + 2) * cell} width={cell * 7} height={cell * 7} />
      <rect x={(fx + 3) * cell} y={(fy + 3) * cell} width={cell * 5} height={cell * 5} fill="#fff" />
      <rect x={(fx + 4) * cell} y={(fy + 4) * cell} width={cell * 3} height={cell * 3} />
    </g>
  );
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <rect width={size} height={size} fill="#fff" rx={12} />
      <g fill="#111">
        {cells}
        <Finder fx={0} fy={0} />
        <Finder fx={n - 7} fy={0} />
        <Finder fx={0} fy={n - 7} />
      </g>
    </svg>
  );
};

// Confetti sutil determinístico (ámbar + verde).
export const Confetti: React.FC<{
  startFrame: number;
  originX: number;
  originY: number;
  count?: number;
}> = ({ startFrame, originX, originY, count = 36 }) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0) return null;
  const parts = new Array(count).fill(0).map((_, i) => {
    const angle = random(`c-a-${i}`) * Math.PI * 2;
    const speed = 6 + random(`c-s-${i}`) * 13;
    const life = 40 + random(`c-l-${i}`) * 30;
    const p = Math.min(1, t / life);
    const dist = speed * t * (1 - p * 0.5);
    const x = originX + Math.cos(angle) * dist;
    const y = originY + Math.sin(angle) * dist * 0.7 + 0.10 * t * t;
    const opacity = interpolate(p, [0, 0.7, 1], [1, 0.9, 0]);
    const size = 7 + random(`c-z-${i}`) * 9;
    const color = random(`c-c-${i}`) > 0.5 ? C.accent : C.positive;
    const rot = random(`c-r-${i}`) * 360 + t * (random(`c-rs-${i}`) * 16 - 8);
    return { x, y, opacity, size, color, rot, key: i };
  });
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {parts.map((p) => (
        <div
          key={p.key}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            opacity: p.opacity,
            borderRadius: 2,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
};

// Código de retiro estilo OTP de la app (cajitas mono ámbar).
export const PickupCode: React.FC<{ code: string; size?: number; revealFrom?: number }> = ({
  code,
  size = 56,
  revealFrom,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: size * 0.18 }}>
      {code.split("").map((ch, i) => {
        const visible = revealFrom === undefined ? 1 : frame >= revealFrom + i * 3 ? 1 : 0;
        return (
          <div
            key={i}
            style={{
              width: size,
              height: size * 1.25,
              borderRadius: 10,
              border: `2px solid ${C.border}`,
              backgroundColor: C.cardAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: size * 0.62,
              color: C.accent,
              opacity: visible,
              transform: visible ? "translateY(0)" : "translateY(6px)",
            }}
          >
            {ch}
          </div>
        );
      })}
    </div>
  );
};
