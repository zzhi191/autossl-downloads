import {Audio} from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {SCENES} from "./storyboard.mjs";
import "./autossl.css";

type Scene = (typeof SCENES)[number];

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const SceneCopy: React.FC<{scene: Scene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const copyProgress = interpolate(frame, [10, 34], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="scene-copy"
      style={{
        opacity: copyProgress,
        transform: `translateY(${(1 - copyProgress) * 34}px)`,
      }}
    >
      {scene.eyebrow ? <div className="eyebrow">{scene.eyebrow}</div> : null}
      <div className="scene-title">{scene.title}</div>
      {scene.detail ? <div className="scene-detail">{scene.detail}</div> : null}
    </div>
  );
};

const Certificate = ({label = "SSL"}: {label?: string}) => (
  <div className="certificate-card">
    <div className="certificate-mark">✓</div>
    <div>
      <div className="certificate-label">{label}</div>
      <div className="certificate-meta">已受保护</div>
    </div>
  </div>
);

const ProblemVisual = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [0, 54, 74], [0.2, 0.9, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="problem-visual">
      <div className="alert-orbit" style={{opacity: pulse, transform: `scale(${0.86 + pulse * 0.16})`}} />
      <Certificate label="证书" />
      <div className="task-chip task-chip-one">到期检查</div>
      <div className="task-chip task-chip-two">手动部署</div>
      <div className="task-chip task-chip-three">服务器登录</div>
    </div>
  );
};

const ControlVisual = () => {
  const frame = useCurrentFrame();
  const converge = interpolate(frame, [8, 62], [130, 0], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="control-visual">
      <div className="connector connector-left" style={{width: `${220 - converge}px`}} />
      <div className="connector connector-right" style={{width: `${220 - converge}px`}} />
      <div className="entity-card domain-card" style={{transform: `translateX(${-converge}px)`}}>example.com</div>
      <div className="entity-card central-card"><Certificate /></div>
      <div className="entity-card server-card" style={{transform: `translateX(${converge}px)`}}>服务器节点</div>
    </div>
  );
};

const RequestVisual = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [14, 66], [0, 100], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="request-visual">
      <div className="domain-hero">example.com</div>
      <div className="validation-line"><div style={{width: `${progress}%`}} /></div>
      <div className="validation-steps"><span>提交申请</span><span>DNS 验证</span><span>签发完成</span></div>
    </div>
  );
};

const DeployVisual = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [8, 64], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="deploy-visual">
      <div className="deploy-source"><Certificate /></div>
      <div className="deploy-path"><div style={{width: `${progress * 100}%`}} /></div>
      <div className="server-stack">
        <div className="server-node">WEB-01</div>
        <div className="server-node">WEB-02</div>
        <div className="server-node">API-01</div>
      </div>
    </div>
  );
};

const ProtectVisual = () => {
  const frame = useCurrentFrame();
  const health = interpolate(frame, [6, 56], [0.24, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="protect-visual">
      <div className="health-ring" style={{transform: `scale(${0.76 + health * 0.24})`, opacity: health}}>
        <div className="health-check">✓</div>
        <strong>持续守护</strong>
        <span>监控已开启</span>
      </div>
      <div className="renewal-chip" style={{opacity: health, transform: `translateX(${(1 - health) * 65}px)`}}>自动续期已就绪</div>
    </div>
  );
};

const EndVisual = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [8, 42], [0.88, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="end-visual" style={{transform: `scale(${scale})`, opacity: Math.min(scale * 1.2, 1)}}>
      <div className="brand-lockup">
        <Img className="brand-shield" src={staticFile("autossl-shield.png")} />
        <span className="brand-wordmark"><span>auto</span>SSL</span>
      </div>
      <div className="brand-rule" />
    </div>
  );
};

const SceneVisual: React.FC<{id: Scene["id"]}> = ({id}) => {
  switch (id) {
    case "problem": return <ProblemVisual />;
    case "control": return <ControlVisual />;
    case "request": return <RequestVisual />;
    case "deploy": return <DeployVisual />;
    case "protect": return <ProtectVisual />;
    case "end": return <EndVisual />;
  }
};

const ProductScene: React.FC<{scene: Scene}> = ({scene}) => {
  return (
    <AbsoluteFill className={`scene scene-${scene.id}`}>
      <div className="scene-grid" />
      <SceneCopy scene={scene} />
      <div className="scene-visual"><SceneVisual id={scene.id} /></div>
    </AbsoluteFill>
  );
};

export const AutoSSLProductIntro = () => {
  return (
    <AbsoluteFill className="video-root">
      {SCENES.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.to - scene.from} premountFor={30}>
          <ProductScene scene={scene} />
        </Sequence>
      ))}
      <Audio
        src={staticFile("autossl-background.wav")}
        volume={(frame) => interpolate(frame, [0, 24, 405, 449], [0, 0.12, 0.12, 0], {extrapolateRight: "clamp"})}
      />
    </AbsoluteFill>
  );
};
