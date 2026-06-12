import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Intro, Problema, Registro } from "./scenes-1";
import { Cierre, Dashboard, Retiro, WhatsAppScene } from "./scenes-2";
import { C } from "./theme";

// 60s @ 30fps = 1800 frames. Cada transición solapa 20 frames, así que la
// suma de las secuencias es 1800 + 6×20 = 1920.
const T = () =>
  springTiming({ config: { damping: 200 }, durationInFrames: 20 });

export const PaqueteOKDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/*
        Placeholder para música de fondo — descomentá y poné el archivo en
        video/public/music.mp3 cuando haya pista:

        import { Audio, staticFile } from "remotion";
        <Audio src={staticFile("music.mp3")} volume={0.5} />
      */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={200}>
          <Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={200}>
          <Problema />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={440}>
          <Registro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={380}>
          <WhatsAppScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={380}>
          <Retiro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={200}>
          <Dashboard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T()} />

        <TransitionSeries.Sequence durationInFrames={120}>
          <Cierre />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
