import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, FONT, MONO } from "./theme";
import {
  Card,
  ClickPulse,
  LogoIcon,
  PersonBadge,
  PickupCode,
  SectionLabel,
  Typewriter,
  Wordmark,
} from "./ui";

export interface SceneProps {
  vertical?: boolean;
}

const Bg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: C.bg,
      backgroundImage: `radial-gradient(1200px 600px at 50% -10%, ${C.accent}10, transparent 70%)`,
    }}
  >
    {children}
  </AbsoluteFill>
);

// ─── ESCENA 1 · Intro ────────────────────────────────────────────────────────

export const Intro: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconIn = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const okIn = spring({ frame: frame - 14, fps, config: { damping: 14, stiffness: 90 } });
  const tagOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagY = interpolate(frame, [50, 80], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Bg>
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", gap: 48 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: vertical ? 26 : 36,
            transform: `scale(${iconIn})`,
          }}
        >
          <LogoIcon size={vertical ? 110 : 150} />
          <Wordmark size={vertical ? 100 : 140} okProgress={okIn} />
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: vertical ? 36 : 42,
            color: C.textSoft,
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
            maxWidth: vertical ? 880 : undefined,
            textAlign: "center",
            padding: "0 50px",
            lineHeight: 1.4,
          }}
        >
          La gestión de paquetes de tu edificio,{" "}
          <span style={{ color: C.text, fontWeight: 600 }}>ordenada y trazable.</span>
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ─── ESCENA 2 · El problema ──────────────────────────────────────────────────

const ProblemCard: React.FC<{
  text: string;
  appearFrame: number;
  vertical?: boolean;
}> = ({ text, appearFrame, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - appearFrame, fps, config: { damping: 14 } });
  const strike = interpolate(frame, [appearFrame + 24, appearFrame + 42], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "relative",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 36}px)`,
      }}
    >
      <Card style={{ padding: vertical ? "30px 44px" : "34px 60px", backgroundColor: C.cardAlt }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: vertical ? 40 : 46,
            fontWeight: 600,
            color: C.textSoft,
          }}
        >
          {text}
        </span>
      </Card>
      <div
        style={{
          position: "absolute",
          left: "4%",
          top: "50%",
          height: 6,
          width: `${strike * 0.92}%`,
          backgroundColor: C.critical,
          borderRadius: 3,
          transform: "rotate(-2deg)",
          boxShadow: `0 0 18px ${C.critical}66`,
        }}
      />
    </div>
  );
};

export const Problema: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Bg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 42 }}>
        <div style={{ opacity: titleOpacity, marginBottom: 10 }}>
          <SectionLabel>Hoy en tu edificio</SectionLabel>
        </div>
        {/* stagger 400ms = 12 frames a 30fps */}
        <ProblemCard text="¿Paquetes anotados en un cuaderno?" appearFrame={14} vertical={vertical} />
        <ProblemCard text="¿Residentes que nunca se enteran?" appearFrame={26} vertical={vertical} />
        <ProblemCard text="¿Retiros sin ningún registro?" appearFrame={38} vertical={vertical} />
      </AbsoluteFill>
    </Bg>
  );
};

// ─── ESCENA 3 · El guardia registra ──────────────────────────────────────────

const UNIT_LABELS = ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B"];
const SELECT_FRAME = 86;
const SUBMIT_FRAME = 250;
const TOAST_FRAME = 270;

const UnitTile: React.FC<{ label: string; index: number }> = ({ label, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 14 - index * 3, fps, config: { damping: 15 } });
  const isTarget = label === "3B";
  const selected = isTarget && frame >= SELECT_FRAME;
  const pop = isTarget
    ? spring({ frame: frame - SELECT_FRAME, fps, config: { damping: 9, stiffness: 180 } })
    : 0;
  const scale = selected ? 1 + 0.07 * Math.sin(Math.min(1, pop) * Math.PI) : 1;
  return (
    <div
      style={{
        width: 108,
        height: 108,
        borderRadius: 18,
        border: `2.5px solid ${selected ? C.accent : C.border}`,
        backgroundColor: selected ? C.accent : C.cardAlt,
        color: selected ? C.accentFg : C.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 34,
        opacity: enter,
        transform: `scale(${enter * scale})`,
        boxShadow: selected ? `0 0 0 8px ${C.accent}26` : "none",
      }}
    >
      {label}
    </div>
  );
};

export const Registro: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mockIn = spring({ frame, fps, config: { damping: 16 } });
  const buttonDip =
    frame >= SUBMIT_FRAME && frame < SUBMIT_FRAME + 8
      ? 0.96
      : 1;
  const toastIn = spring({ frame: frame - TOAST_FRAME, fps, config: { damping: 13 } });
  const sideIn = spring({ frame: frame - 8, fps, config: { damping: 16 } });

  const mockup = (
    <div
      style={{
        flex: vertical ? undefined : "0 0 1010px",
        width: vertical ? 1010 : undefined,
        opacity: mockIn,
        transform: `translateY(${(1 - mockIn) * 60}px)`,
        position: "relative",
      }}
    >
      {/* Toast de éxito: espacio reservado en el layout para no tapar el header */}
      <div
        style={{
          height: 108,
          marginBottom: 20,
          opacity: Math.min(1, toastIn * 1.4),
          transform: `translateY(${(1 - toastIn) * -40}px)`,
        }}
      >
        <Card
          style={{
            padding: "18px 34px",
            border: `1.5px solid ${C.positive}66`,
            backgroundColor: "#0c1a14",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontFamily: FONT }}>
            <div style={{ color: C.positive, fontSize: 26, fontWeight: 700 }}>
              Paquete registrado
            </div>
            <div style={{ color: C.textSoft, fontSize: 20 }}>
              El residente ya recibió el WhatsApp con el QR.
            </div>
          </div>
          {frame >= TOAST_FRAME && (
            <PickupCode code="H7K2MD" size={38} revealFrom={TOAST_FRAME + 6} />
          )}
        </Card>
      </div>

      <Card style={{ padding: 44 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <div style={{ fontFamily: FONT }}>
            <div style={{ color: C.textDim, fontSize: 19 }}>Edificio Libertad</div>
            <div style={{ color: C.text, fontSize: 36, fontWeight: 700 }}>Nuevo paquete</div>
          </div>
          <PersonBadge name="Conserjería 24hs" role="Guardia" />
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: C.textDim,
            marginBottom: 16,
          }}
        >
          Para qué departamento
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 30 }}>
          {UNIT_LABELS.map((u, i) => (
            <UnitTile key={u} label={u} index={i} />
          ))}
        </div>

        <div
          style={{
            fontFamily: FONT,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: C.textDim,
            marginBottom: 12,
          }}
        >
          Transportista <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
        </div>
        <div
          style={{
            border: `2px solid ${frame > 130 && frame < 200 ? C.accent : C.border}`,
            backgroundColor: C.cardAlt,
            borderRadius: 14,
            padding: "20px 26px",
            fontFamily: FONT,
            fontSize: 28,
            color: C.text,
            marginBottom: 36,
          }}
        >
          <Typewriter text="Andreani" startFrame={132} charsPerFrame={0.3} />
        </div>

        <div
          style={{
            backgroundColor: C.accent,
            color: C.accentFg,
            borderRadius: 18,
            padding: "26px 0",
            textAlign: "center",
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 32,
            transform: `scale(${buttonDip})`,
          }}
        >
          Registrar y notificar
        </div>
      </Card>

      <ClickPulse clickFrame={SELECT_FRAME} x={720} y={365} />
      <ClickPulse clickFrame={SUBMIT_FRAME} x={505} y={760} />
    </div>
  );

  const narrative = (
    <div
      style={{
        flex: vertical ? undefined : 1,
        fontFamily: FONT,
        opacity: sideIn,
        transform: vertical
          ? `translateY(${(1 - sideIn) * 30}px)`
          : `translateX(${(1 - sideIn) * 50}px)`,
        textAlign: vertical ? "center" : "left",
        maxWidth: vertical ? 920 : undefined,
      }}
    >
      <SectionLabel>Paso 1 · Conserjería</SectionLabel>
      <div
        style={{
          color: C.text,
          fontSize: vertical ? 52 : 58,
          fontWeight: 800,
          lineHeight: 1.15,
          margin: "18px 0 22px",
        }}
      >
        El guardia lo registra en segundos
      </div>
      <div style={{ color: C.textSoft, fontSize: vertical ? 28 : 30, lineHeight: 1.5 }}>
        Depto, transportista, listo. Menos clicks que escribirlo en el cuaderno —
        y el código de retiro se genera solo.
      </div>
    </div>
  );

  return (
    <Bg>
      <AbsoluteFill
        style={
          vertical
            ? { flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 35, gap: 52 }
            : { flexDirection: "row", alignItems: "center", padding: 90, gap: 70 }
        }
      >
        {vertical ? (
          <>
            {narrative}
            {mockup}
          </>
        ) : (
          <>
            {mockup}
            {narrative}
          </>
        )}
      </AbsoluteFill>
    </Bg>
  );
};
