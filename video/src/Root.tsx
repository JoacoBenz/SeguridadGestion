import React from "react";
import { Composition } from "remotion";
import { PaqueteOKDemo } from "./Demo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PaqueteOKDemo"
      component={PaqueteOKDemo}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
