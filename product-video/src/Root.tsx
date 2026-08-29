import "./index.css";
import { Composition } from "remotion";
import { AutoSSLProductIntro } from "./AutoSSLProductIntro";

export const RemotionRoot = () => {
  return (
    <Composition
      id="AutoSSLProductIntro"
      component={AutoSSLProductIntro}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
