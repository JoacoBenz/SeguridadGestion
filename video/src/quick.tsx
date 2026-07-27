import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { C, FONT, MONO } from "./theme";
import type { SceneProps } from "./scenes-1";
import {
  Card,
  ClickPulse,
  Confetti,
  FakeQR,
  LogoIcon,
  PickupCode,
  Tag,
  Wordmark,
} from "./ui";

// ─── Versión rápida: 15s máx (435 frames @ 30fps) ────────────────────────────
// Mismo lenguaje visual que el demo de 60s pero un solo mensaje por escena:
// gancho → registro → WhatsApp → retiro → CTA. El indicador de pasos arriba
// hace legible el flujo aunque cada escena dure ~4s.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

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

// Indicador de progreso: 3 píldoras, la activa en ámbar.
const STEPS = ["Registrar", "WhatsApp", "Retirar"] as const;

const StepPills: React.FC<{ active: 1 | 2 | 3; vertical?: boolean }> = ({
  active,
  vertical,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], clamp);
  return (
    <div style={{ display: "flex", gap: vertical ? 14 : 18, opacity }}>
      {STEPS.map((label, i) => {
        const isActive = i + 1 === active;
        const isDone = i + 1 < active;
        return (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: FONT,
              fontSize: vertical ? 24 : 26,
              fontWeight: 600,
              color: isActive ? C.accentFg : isDone ? C.positive : C.textDim,
              backgroundColor: isActive ? C.accent : C.cardAlt,
              border: `1.5px solid ${
                isActive ? C.accent : isDone ? `${C.positive}55` : C.border
              }`,
              borderRadius: 999,
              padding: vertical ? "10px 22px" : "10px 26px",
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: vertical ? 22 : 24,
              }}
            >
              {isDone ? "✓" : i + 1}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  );
};

// Layout común de las escenas de paso: píldoras + título + mockup.
const StepScene: React.FC<{
  n: 1 | 2 | 3;
  title: string;
  vertical?: boolean;
  children: React.ReactNode;
}> = ({ n, title, vertical, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleIn = spring({ frame: frame - 4, fps, config: { damping: 15 } });
  const mockIn = spring({ frame: frame - 10, fps, config: { damping: 16 } });
  return (
    <Bg>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: vertical ? 40 : 34,
          padding: vertical ? "0 40px" : 0,
        }}
      >
        <StepPills active={n} vertical={vertical} />
        <div
          style={{
            fontFamily: FONT,
            fontSize: vertical ? 52 : 56,
            fontWeight: 800,
            color: C.text,
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 24}px)`,
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: vertical ? 960 : 1400,
          }}
        >
          {title}
        </div>
        <div
          style={{
            opacity: mockIn,
            transform: `translateY(${(1 - mockIn) * 50}px)`,
          }}
        >
          {children}
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ─── Gancho (55f ≈ 1.8s) ─────────────────────────────────────────────────────

const QHook: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iconIn = spring({ frame, fps, config: { damping: 12, stiffness: 130 } });
  const okIn = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 100 } });
  const subIn = interpolate(frame, [18, 34], [0, 1], clamp);
  return (
    <Bg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: vertical ? 24 : 32,
            transform: `scale(${iconIn})`,
          }}
        >
          <LogoIcon size={vertical ? 104 : 130} />
          <Wordmark size={vertical ? 96 : 120} okProgress={okIn} />
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: vertical ? 34 : 40,
            color: C.textSoft,
            opacity: subIn,
            textAlign: "center",
            padding: "0 60px",
            lineHeight: 1.4,
          }}
        >
          Los paquetes de tu edificio, en{" "}
          <span style={{ color: C.accent, fontWeight: 700 }}>3 pasos</span>.
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ─── Paso 1 · Registro (115f ≈ 3.8s) ─────────────────────────────────────────

const R_SELECT = 26;
const R_PHOTO = 46;
const R_SUBMIT = 68;
const R_TOAST = 82;

const QUICK_UNITS = ["2A", "2B", "3A", "3B", "4A", "4B"];

const QuickTile: React.FC<{ label: string; index: number }> = ({ label, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 8 - index * 2, fps, config: { damping: 15 } });
  const isTarget = label === "3B";
  const selected = isTarget && frame >= R_SELECT;
  const pop = isTarget
    ? spring({ frame: frame - R_SELECT, fps, config: { damping: 9, stiffness: 180 } })
    : 0;
  const scale = selected ? 1 + 0.07 * Math.sin(Math.min(1, pop) * Math.PI) : 1;
  return (
    <div
      style={{
        width: 100,
        height: 100,
        borderRadius: 16,
        border: `2.5px solid ${selected ? C.accent : C.border}`,
        backgroundColor: selected ? C.accent : C.cardAlt,
        color: selected ? C.accentFg : C.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 32,
        opacity: enter,
        transform: `scale(${enter * scale})`,
        boxShadow: selected ? `0 0 0 7px ${C.accent}26` : "none",
      }}
    >
      {label}
    </div>
  );
};

const QRegistro: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const buttonDip = frame >= R_SUBMIT && frame < R_SUBMIT + 8 ? 0.96 : 1;
  const toastIn = spring({ frame: frame - R_TOAST, fps, config: { damping: 13 } });
  const photoOn = frame >= R_PHOTO;

  return (
    <StepScene n={1} title="El guardia lo registra en segundos" vertical={vertical}>
      <div style={{ position: "relative", width: 880 }}>
        <Card style={{ padding: 36 }}>
          <div style={{ fontFamily: FONT, marginBottom: 24 }}>
            <div style={{ color: C.textDim, fontSize: 18 }}>Edificio Libertad · Conserjería</div>
            <div style={{ color: C.text, fontSize: 34, fontWeight: 700 }}>Nuevo paquete</div>
          </div>

          <div
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: C.textDim,
              marginBottom: 14,
            }}
          >
            ¿Para qué depto?
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
            {QUICK_UNITS.map((u, i) => (
              <QuickTile key={u} label={u} index={i} />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: `2px solid ${photoOn ? `${C.positive}66` : C.border}`,
              backgroundColor: photoOn ? "#0c1a14" : C.cardAlt,
              borderRadius: 14,
              padding: "16px 24px",
              marginBottom: 24,
              fontFamily: FONT,
              fontSize: 24,
            }}
          >
            <span style={{ color: photoOn ? C.text : C.textDim }}>
              📷 Foto del paquete
            </span>
            <span
              style={{
                color: C.positive,
                fontWeight: 700,
                opacity: photoOn ? 1 : 0.25,
              }}
            >
              {photoOn ? "✓ Lista" : "…"}
            </span>
          </div>

          <div
            style={{
              backgroundColor: C.accent,
              color: C.accentFg,
              borderRadius: 16,
              padding: "22px 0",
              textAlign: "center",
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 30,
              transform: `scale(${buttonDip})`,
            }}
          >
            Registrar y notificar
          </div>
        </Card>

        {/* Toast de éxito: overlay sobre el botón, aparece justo donde se clickeó */}
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 14,
            opacity: Math.min(1, toastIn * 1.4),
            transform: `translateY(${(1 - toastIn) * 28}px)`,
          }}
        >
          <Card
            style={{
              padding: "16px 28px",
              border: `1.5px solid ${C.positive}66`,
              backgroundColor: "#0c1a14",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
            }}
          >
            <div style={{ fontFamily: FONT }}>
              <div style={{ color: C.positive, fontSize: 25, fontWeight: 700 }}>
                Paquete registrado
              </div>
              <div style={{ color: C.textSoft, fontSize: 19 }}>
                WhatsApp enviado al residente
              </div>
            </div>
            {frame >= R_TOAST && (
              <PickupCode code="H7K2MD" size={36} revealFrom={R_TOAST + 4} />
            )}
          </Card>
        </div>

        <ClickPulse clickFrame={R_SELECT} x={428} y={222} />
        <ClickPulse clickFrame={R_SUBMIT} x={440} y={424} />
      </div>
    </StepScene>
  );
};

// ─── Paso 2 · WhatsApp (115f ≈ 3.8s) ─────────────────────────────────────────

const W_BUBBLE = 16;
const W_TICKS_BLUE = 68;

const QWhatsApp: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bubbleIn = spring({
    frame: frame - W_BUBBLE,
    fps,
    config: { damping: 12, stiffness: 110 },
  });
  const ticksBlue = frame >= W_TICKS_BLUE;

  return (
    <StepScene
      n={2}
      title="El residente recibe el QR al instante"
      vertical={vertical}
    >
      <div
        style={{
          width: 520,
          borderRadius: 48,
          border: `3px solid ${C.borderLight}`,
          backgroundColor: C.waBg,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            backgroundColor: C.waHeader,
            padding: "22px 26px 16px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Img
            src={staticFile("bexovar-icon.png")}
            style={{ width: 48, height: 48, borderRadius: 999, display: "block" }}
          />
          <div style={{ fontFamily: FONT, lineHeight: 1.2 }}>
            <div style={{ color: "#e9edef", fontSize: 23, fontWeight: 600 }}>
              PackItO
            </div>
            <div style={{ color: "#8696a0", fontSize: 16 }}>Edificio Libertad</div>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <div
            style={{
              backgroundColor: C.waBubble,
              borderRadius: 16,
              borderTopLeftRadius: 4,
              padding: 14,
              width: 430,
              margin: "0 auto",
              opacity: bubbleIn,
              transform: `scale(${0.7 + bubbleIn * 0.3})`,
              transformOrigin: "top center",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <FakeQR size={250} seed="H7K2MD" />
            </div>
            <div
              style={{
                fontFamily: FONT,
                color: "#e9edef",
                fontSize: 22,
                lineHeight: 1.45,
                padding: "12px 6px 4px",
              }}
            >
              Hola <b>Juan</b> 👋 Llegó un paquete para tu depto <b>3B</b> en{" "}
              <b>Edificio Libertad</b>. Mostrá este QR en conserjería para
              retirarlo. ¿Lo busca otra persona? Reenviale este mensaje.
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 6,
                padding: "6px 6px 0",
                fontFamily: FONT,
                fontSize: 16,
                color: "#8696a0",
              }}
            >
              14:32
              <svg width={26} height={16} viewBox="0 0 26 16">
                <path
                  d="M1 9l4 4L13 5M9 9l4 4L21 5"
                  fill="none"
                  stroke={ticksBlue ? "#53bdeb" : "#8696a0"}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </StepScene>
  );
};

// ─── Paso 3 · Retiro (115f ≈ 3.8s) ───────────────────────────────────────────

const Q_SCAN_HIT = 44;
const Q_FLIP = 68;
const Q_AUDIT = 84;

const QRetiro: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const qrIn = spring({ frame: frame - 16, fps, config: { damping: 14 } });

  const scanT = (frame % 56) / 56;
  const scanY = interpolate(scanT < 0.5 ? scanT : 1 - scanT, [0, 0.5], [0, 390]);
  const greenTint =
    interpolate(frame, [Q_SCAN_HIT, Q_SCAN_HIT + 12], [0, 0.38], clamp) *
    interpolate(frame, [Q_SCAN_HIT + 28, Q_SCAN_HIT + 46], [1, 0], clamp);
  const greenRing = interpolate(frame, [Q_SCAN_HIT, Q_SCAN_HIT + 12], [0, 1], clamp);
  const scanLineOpacity = interpolate(
    frame,
    [Q_SCAN_HIT - 2, Q_SCAN_HIT + 8],
    [1, 0],
    clamp,
  );
  const chipIn = interpolate(frame, [Q_SCAN_HIT + 10, Q_SCAN_HIT + 22], [0, 1], clamp);

  const flipT = interpolate(frame, [Q_FLIP, Q_FLIP + 14], [0, 1], clamp);
  const showNew = flipT >= 0.5;
  const rotX = showNew ? (1 - flipT) * 180 : flipT * 180;

  const auditIn = spring({ frame: frame - Q_AUDIT, fps, config: { damping: 15 } });

  return (
    <StepScene n={3} title="Retiro con QR, todo queda auditado" vertical={vertical}>
      <div style={{ position: "relative", width: 880 }}>
        <Card style={{ padding: 32 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div style={{ fontFamily: FONT }}>
              <div style={{ color: C.textDim, fontSize: 18 }}>Edificio Libertad</div>
              <div style={{ color: C.text, fontSize: 32, fontWeight: 700 }}>
                Procesar retiro
              </div>
            </div>
            <div style={{ perspective: 600 }}>
              <div style={{ transform: `rotateX(${rotX}deg)` }}>
                {showNew ? (
                  <Tag
                    label="Retirado"
                    color={C.positive}
                    style={{ fontSize: 25, padding: "10px 24px" }}
                  />
                ) : (
                  <Tag
                    label="Pendiente"
                    color={C.accent}
                    style={{ fontSize: 25, padding: "10px 24px" }}
                  />
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              height: 400,
              borderRadius: 18,
              border: `2px solid ${C.border}`,
              backgroundColor: "#000",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                opacity: qrIn,
                transform: `scale(${0.8 + qrIn * 0.2})`,
              }}
            >
              <FakeQR size={290} seed="H7K2MD" />
              <div
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: 16,
                  backgroundColor: C.positive,
                  opacity: greenTint,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: 16,
                  border: `3px solid ${C.positive}`,
                  boxShadow: `0 0 24px ${C.positive}55`,
                  opacity: greenRing,
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: 26,
                right: 26,
                top: scanY,
                height: 3,
                backgroundColor: `${C.accent}cc`,
                boxShadow: `0 0 18px 5px ${C.accent}55`,
                opacity: scanLineOpacity,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 18,
                left: "50%",
                transform: `translate(-50%, ${(1 - chipIn) * 12}px)`,
                opacity: chipIn,
                fontFamily: MONO,
                fontSize: 21,
                color: C.positive,
                backgroundColor: "#0c1a14ee",
                border: `1.5px solid ${C.positive}66`,
                borderRadius: 10,
                padding: "10px 22px",
                whiteSpace: "nowrap",
              }}
            >
              QR válido · Depto 3B · H7K2MD
            </div>
          </div>
        </Card>

        <Confetti startFrame={Q_FLIP + 4} originX={800} originY={60} />

        <div
          style={{
            position: "absolute",
            left: 50,
            right: 50,
            bottom: -30,
            opacity: auditIn,
            transform: `translateY(${(1 - auditIn) * 26}px)`,
          }}
        >
          <Card
            style={{
              padding: "16px 26px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              backgroundColor: C.cardAlt,
              boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
            }}
          >
            <svg width={38} height={38} viewBox="0 0 24 24">
              <path
                d="M12 2l8 3.5V11c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5.5z"
                fill="none"
                stroke={C.accent}
                strokeWidth={1.8}
                strokeLinejoin="round"
              />
              <path
                d="M8.5 12l2.5 2.5L16 9.5"
                fill="none"
                stroke={C.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{ fontFamily: FONT, fontSize: 21, color: C.textSoft }}>
              Quién recibió, quién entregó y cuándo —{" "}
              <span style={{ color: C.text, fontWeight: 600 }}>todo registrado.</span>
            </div>
          </Card>
        </div>
      </div>
    </StepScene>
  );
};

// ─── Cierre (75f ≈ 2.5s) ─────────────────────────────────────────────────────

const QCierre: React.FC<SceneProps> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const logoIn = spring({ frame, fps, config: { damping: 13 } });
  const ctaIn = spring({ frame: frame - 12, fps, config: { damping: 13 } });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames - 4],
    [1, 0],
    clamp,
  );

  return (
    <Bg>
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", gap: 44, opacity: fadeOut }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: vertical ? 20 : 28,
            transform: `scale(${logoIn})`,
          }}
        >
          <LogoIcon size={vertical ? 96 : 112} />
          <Wordmark size={vertical ? 88 : 104} okProgress={logoIn} />
        </div>
        <div
          style={{
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * 26}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              backgroundColor: C.accent,
              color: C.accentFg,
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: vertical ? 32 : 36,
              borderRadius: 18,
              padding: "24px 58px",
              boxShadow: `0 0 60px ${C.accent}44`,
            }}
          >
            Sumá tu edificio
          </div>
          <div style={{ fontFamily: MONO, fontSize: 28, color: C.textDim }}>
            packito.bexovar.com.ar
          </div>
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ─── Composición ─────────────────────────────────────────────────────────────
// 55 + 115 + 115 + 115 + 75 = 475; 4 transiciones × 10f de solape → 435 frames
// = 14.5s @ 30fps.

const T = () => springTiming({ config: { damping: 200 }, durationInFrames: 10 });

export const QUICK_DURATION = 435;

export const PackItOQuick: React.FC<SceneProps> = ({ vertical }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={55}>
          <QHook vertical={vertical} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={115}>
          <QRegistro vertical={vertical} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={115}>
          <QWhatsApp vertical={vertical} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={115}>
          <QRetiro vertical={vertical} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={75}>
          <QCierre vertical={vertical} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
