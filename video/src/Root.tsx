import React from "react";
import { Composition } from "remotion";
import { PackItODemo } from "./Demo";
import { PackItOQuick, QUICK_DURATION } from "./quick";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Horizontal: web, YouTube, presentaciones */}
      <Composition
        id="PackItODemo"
        component={PackItODemo}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ vertical: false }}
      />
      {/* Vertical: Instagram Reels / Stories, TikTok */}
      <Composition
        id="PackItODemoVertical"
        component={PackItODemo}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ vertical: true }}
      />
      {/* Versión rápida: 15s máx, los 3 pasos + WhatsApp */}
      <Composition
        id="PackItOQuick"
        component={PackItOQuick}
        durationInFrames={QUICK_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ vertical: false }}
      />
      <Composition
        id="PackItOQuickVertical"
        component={PackItOQuick}
        durationInFrames={QUICK_DURATION}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ vertical: true }}
      />
    </>
  );
};
