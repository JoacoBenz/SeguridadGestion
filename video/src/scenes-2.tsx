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
  Confetti,
  FakeQR,
  LogoIcon,
  PickupCode,
  SectionLabel,
  Tag,
  Wordmark,
  useCountUp,
} from "./ui";

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

// ─── ESCENA 4 · WhatsApp al residente ────────────────────────────────────────

export const WhatsAppScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneIn = spring({ frame: frame - 4, fps, config: { damping: 15 } });
  const bubbleIn = spring({ frame: frame - 42, fps, config: { damping: 12, stiffness: 110 } });
  const sideIn = spring({ frame: frame - 10, fps, config: { damping: 16 } });
  const ticksBlue = frame >= 170;

  return (
    <Bg>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: 90, gap: 80 }}>
        {/* Narrativa lateral (izquierda esta vez) */}
        <div
          style={{
            flex: 1,
            fontFamily: FONT,
            opacity: sideIn,
            transform: `translateX(${(1 - sideIn) * -50}px)`,
          }}
        >
          <SectionLabel>Paso 2 · El residente</SectionLabel>
          <div style={{ color: C.text, fontSize: 58, fontWeight: 800, lineHeight: 1.15, margin: "18px 0 26px" }}>
            Se entera al instante, por WhatsApp
          </div>
          <div style={{ color: C.textSoft, fontSize: 30, lineHeight: 1.5 }}>
            QR + código en un solo mensaje. Sin apps que instalar, sin cuentas que crear.
            ¿Lo retira otro? Reenvía el mensaje y ya.
          </div>
        </div>

        {/* Teléfono */}
        <div
          style={{
            flex: "0 0 560px",
            opacity: phoneIn,
            transform: `translateY(${(1 - phoneIn) * 90}px)`,
          }}
        >
          <div
            style={{
              width: 540,
              height: 880,
              borderRadius: 56,
              border: `3px solid ${C.borderLight}`,
              backgroundColor: C.waBg,
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              margin: "0 auto",
            }}
          >
            {/* Header WhatsApp */}
            <div
              style={{
                backgroundColor: C.waHeader,
                padding: "30px 28px 18px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  backgroundColor: C.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LogoIcon size={34} />
              </div>
              <div style={{ fontFamily: FONT, lineHeight: 1.2 }}>
                <div style={{ color: "#e9edef", fontSize: 24, fontWeight: 600 }}>
                  PaqueteOK · Edificio Libertad
                </div>
                <div style={{ color: "#8696a0", fontSize: 17 }}>cuenta verificada</div>
              </div>
            </div>

            {/* Burbuja entrante */}
            <div style={{ padding: 26 }}>
              <div
                style={{
                  backgroundColor: C.waBubble,
                  borderRadius: 16,
                  borderTopLeftRadius: 4,
                  padding: 16,
                  width: 420,
                  opacity: bubbleIn,
                  transform: `scale(${0.7 + bubbleIn * 0.3})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <FakeQR size={280} seed="H7K2MD" />
                </div>
                <div
                  style={{
                    fontFamily: FONT,
                    color: "#e9edef",
                    fontSize: 22,
                    lineHeight: 1.45,
                    padding: "14px 6px 4px",
                  }}
                >
                  Hola <b>Juan</b> 👋 Llegó un paquete para <b>3B</b> en Edificio Libertad
                  (Andreani). Mostrá este QR en conserjería o decí el código:
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    color: C.accent,
                    backgroundColor: "#0e1a20",
                    borderRadius: 10,
                    textAlign: "center",
                    fontSize: 34,
                    fontWeight: 700,
                    letterSpacing: 10,
                    padding: "12px 0",
                    margin: "10px 6px 4px",
                  }}
                >
                  H7K2MD
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
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ─── ESCENA 5 · Retiro con QR ────────────────────────────────────────────────

const SCAN_HIT = 120; // frame en que el QR se detecta
const FLIP = 150; // frame del flip Pendiente → Retirado

export const Retiro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mockIn = spring({ frame, fps, config: { damping: 16 } });
  const sideIn = spring({ frame: frame - 8, fps, config: { damping: 16 } });
  const qrIn = spring({ frame: frame - 50, fps, config: { damping: 14 } });

  // línea de escaneo: barre arriba/abajo hasta detectar
  const scanT = (frame % 72) / 72;
  const scanY = interpolate(
    scanT < 0.5 ? scanT : 1 - scanT,
    [0, 0.5],
    [0, 460],
  );
  const detected = frame >= SCAN_HIT;
  const flash = interpolate(frame, [SCAN_HIT, SCAN_HIT + 12], [0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // flip del tag
  const flipT = interpolate(frame, [FLIP, FLIP + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showNew = flipT >= 0.5;
  const rotX = showNew ? (1 - flipT) * 180 : flipT * 180;

  const shieldIn = spring({ frame: frame - (FLIP + 40), fps, config: { damping: 15 } });

  return (
    <Bg>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: 90, gap: 70 }}>
        {/* Mockup retiro */}
        <div
          style={{
            flex: "0 0 980px",
            position: "relative",
            opacity: mockIn,
            transform: `translateY(${(1 - mockIn) * 60}px)`,
          }}
        >
          <Card style={{ padding: 44 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <div style={{ fontFamily: FONT }}>
                <div style={{ color: C.textDim, fontSize: 19 }}>Edificio Libertad</div>
                <div style={{ color: C.text, fontSize: 36, fontWeight: 700 }}>Procesar retiro</div>
              </div>
              <div style={{ perspective: 600 }}>
                <div style={{ transform: `rotateX(${rotX}deg)` }}>
                  {showNew ? (
                    <Tag label="Retirado" color={C.positive} style={{ fontSize: 26, padding: "10px 24px" }} />
                  ) : (
                    <Tag label="Pendiente" color={C.accent} style={{ fontSize: 26, padding: "10px 24px" }} />
                  )}
                </div>
              </div>
            </div>

            {/* Visor del scanner */}
            <div
              style={{
                position: "relative",
                height: 470,
                borderRadius: 20,
                border: `2px solid ${detected ? C.positive : C.border}`,
                backgroundColor: "#000",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ opacity: qrIn, transform: `scale(${0.8 + qrIn * 0.2})` }}>
                <FakeQR size={330} seed="H7K2MD" />
              </div>
              {!detected && (
                <div
                  style={{
                    position: "absolute",
                    left: 30,
                    right: 30,
                    top: scanY,
                    height: 3,
                    backgroundColor: `${C.accent}cc`,
                    boxShadow: `0 0 18px 5px ${C.accent}55`,
                  }}
                />
              )}
              {/* flash de detección */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: C.positive,
                  opacity: flash,
                }}
              />
              {detected && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontFamily: MONO,
                    fontSize: 22,
                    color: C.positive,
                    backgroundColor: "#0c1a14ee",
                    border: `1.5px solid ${C.positive}66`,
                    borderRadius: 10,
                    padding: "10px 22px",
                  }}
                >
                  QR válido · Depto 3B · H7K2MD
                </div>
              )}
            </div>
          </Card>

          <Confetti startFrame={FLIP + 4} originX={830} originY={70} />

          {/* Overlay auditoría */}
          <div
            style={{
              position: "absolute",
              left: 40,
              right: 40,
              bottom: -36,
              opacity: shieldIn,
              transform: `translateY(${(1 - shieldIn) * 30}px)`,
            }}
          >
            <Card
              style={{
                padding: "20px 30px",
                display: "flex",
                alignItems: "center",
                gap: 20,
                backgroundColor: C.cardAlt,
              }}
            >
              <svg width={44} height={44} viewBox="0 0 24 24">
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
              <div style={{ fontFamily: FONT, fontSize: 24, color: C.textSoft, lineHeight: 1.4 }}>
                Cada movimiento queda auditado:{" "}
                <span style={{ color: C.text, fontWeight: 600 }}>
                  quién recibió, quién entregó y cuándo.
                </span>
              </div>
            </Card>
          </div>
        </div>

        {/* Narrativa lateral */}
        <div
          style={{
            flex: 1,
            fontFamily: FONT,
            opacity: sideIn,
            transform: `translateX(${(1 - sideIn) * 50}px)`,
          }}
        >
          <SectionLabel>Paso 3 · El retiro</SectionLabel>
          <div style={{ color: C.text, fontSize: 58, fontWeight: 800, lineHeight: 1.15, margin: "18px 0 26px" }}>
            Escanear el QR, o tipear el código
          </div>
          <div style={{ color: C.textSoft, fontSize: 30, lineHeight: 1.5 }}>
            El guardia apunta la cámara y listo. ¿Sin batería? El código de 6 caracteres
            también funciona.
          </div>
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

// ─── ESCENA 6 · Dashboard ────────────────────────────────────────────────────

const Kpi: React.FC<{
  label: string;
  target: number;
  suffix?: string;
  color?: string;
  index: number;
}> = ({ label, target, suffix = "", color = C.text, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 8 - index * 6, fps, config: { damping: 14 } });
  const value = useCountUp(14 + index * 6, 60, target);
  return (
    <Card
      style={{
        flex: 1,
        padding: "34px 38px",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 40}px)`,
        borderColor: color === C.text ? C.border : `${color}55`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: C.textDim,
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 72, fontWeight: 700, color }}>
        {value.toLocaleString("es-AR")}
        {suffix}
      </div>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleIn = spring({ frame, fps, config: { damping: 16 } });
  const barW = interpolate(frame, [40, 120], [0, 95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barIn = spring({ frame: frame - 36, fps, config: { damping: 15 } });

  return (
    <Bg>
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 130px", gap: 44 }}>
        <div style={{ opacity: titleIn, transform: `translateY(${(1 - titleIn) * 30}px)` }}>
          <SectionLabel>Administración</SectionLabel>
          <div style={{ fontFamily: FONT, color: C.text, fontSize: 62, fontWeight: 800, marginTop: 14 }}>
            Todo el ciclo, trazable y auditado
          </div>
        </div>

        <div style={{ display: "flex", gap: 26 }}>
          <Kpi label="Pendientes" target={12} color={C.accent} index={0} />
          <Kpi label=">3 días" target={2} color={C.warn} index={1} />
          <Kpi label="Recibidos / mes" target={248} index={2} />
          <Kpi label="Retirados / mes" target={236} color={C.positive} index={3} />
        </div>

        <Card style={{ padding: "30px 38px", opacity: barIn, transform: `translateY(${(1 - barIn) * 30}px)` }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: FONT,
              marginBottom: 16,
            }}
          >
            <span style={{ color: C.textSoft, fontSize: 24 }}>Tasa de retiro del mes</span>
            <span style={{ color: C.accent, fontSize: 24, fontFamily: MONO, fontWeight: 700 }}>
              {Math.round(barW)}%
            </span>
          </div>
          <div style={{ height: 16, borderRadius: 999, backgroundColor: C.cardAlt, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${barW}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${C.accent}, ${C.positive})`,
              }}
            />
          </div>
        </Card>
      </AbsoluteFill>
    </Bg>
  );
};

// ─── ESCENA 7 · Cierre ───────────────────────────────────────────────────────

export const Cierre: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const logoIn = spring({ frame, fps, config: { damping: 13 } });
  const ctaIn = spring({ frame: frame - 18, fps, config: { damping: 13 } });
  const fadeOut = interpolate(frame, [durationInFrames - 22, durationInFrames - 4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Bg>
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", gap: 50, opacity: fadeOut }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            transform: `scale(${logoIn})`,
          }}
        >
          <LogoIcon size={120} />
          <Wordmark size={110} okProgress={logoIn} />
        </div>
        <div
          style={{
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * 30}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              backgroundColor: C.accent,
              color: C.accentFg,
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 38,
              borderRadius: 20,
              padding: "26px 64px",
              boxShadow: `0 0 60px ${C.accent}44`,
            }}
          >
            Sumá tu edificio
          </div>
          <div style={{ fontFamily: MONO, fontSize: 30, color: C.textDim }}>paqueteok.app</div>
        </div>
      </AbsoluteFill>
    </Bg>
  );
};
