# AutoSSL Product Intro Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a previewable 15-second, 1920x1080 AutoSSL product-introduction composition that communicates automated certificate application, deployment, monitoring, and renewal.

**Architecture:** Add an isolated `product-video/` Remotion project inside `autoSSL`, so Electron and Vite dependencies remain untouched. Keep timing and on-screen copy in a framework-neutral storyboard module, render the six scenes from one React composition, and generate a small original WAV soundbed locally rather than using the application's notification sound.

**Tech Stack:** Remotion 4, React, TypeScript, CSS, Node.js built-in test runner, Node.js WAV generation, Remotion Studio.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `product-video/package.json` | Isolated Remotion commands and Node test script. |
| `product-video/tsconfig.json` | TypeScript configuration created by the Remotion scaffold. |
| `product-video/remotion.config.ts` | Remotion project configuration when required by the scaffold version. |
| `product-video/src/index.ts` | Remotion entry point. |
| `product-video/src/Root.tsx` | Registers the single `AutoSSLProductIntro` composition and fixed metadata. |
| `product-video/src/storyboard.mjs` | One source of truth for six scene frame ranges and copy. |
| `product-video/src/AutoSSLProductIntro.tsx` | Scene sequencing and animated visual composition. |
| `product-video/src/autossl.css` | Video-only layout, typography, color, and safe-area styling. |
| `product-video/scripts/generate-background-bed.mjs` | Creates the original 15-second WAV soundbed. |
| `product-video/test/storyboard.test.mjs` | Verifies the storyboard covers exactly 450 non-overlapping frames. |
| `product-video/public/autossl-shield.png` | Reused AutoSSL shield icon copied from `../public/logo.png`. |
| `product-video/public/autossl-background.wav` | Generated soundtrack used by the composition. |

### Task 1: Create The Isolated Remotion Workspace

**Files:**
- Create: `product-video/` through the official Remotion scaffold
- Modify: `product-video/package.json`
- Modify: `product-video/src/index.ts`
- Create: `product-video/src/Root.tsx`

- [ ] **Step 1: Scaffold the blank project**

Run from `autoSSL/`:

```bash
npx create-video@latest --yes --blank --no-tailwind product-video
cd product-video
npm install
```

Expected: a standalone Remotion project exists under `product-video/`; the parent Electron application's `package.json` is unchanged.

- [ ] **Step 2: Add a test command before adding the composition**

Add this script to `product-video/package.json`:

```json
"test": "node --test test/*.test.mjs"
```

Expected: `npm test` currently fails because `test/storyboard.test.mjs` does not exist.

- [ ] **Step 3: Register only the fixed product composition**

Replace the scaffold root with:

```tsx
import {Composition} from 'remotion';
import {AutoSSLProductIntro} from './AutoSSLProductIntro';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AutoSSLProductIntro"
    component={AutoSSLProductIntro}
    durationInFrames={450}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

Update `src/index.ts` to register `RemotionRoot` with `registerRoot`.

- [ ] **Step 4: Inspect composition metadata**

Run:

```bash
npx remotion compositions src/index.ts
```

Expected: `AutoSSLProductIntro` reports 1920x1080, 30 fps, and 450 frames.

- [ ] **Step 5: Commit the isolated project baseline**

```bash
git add product-video/package.json product-video/package-lock.json product-video/tsconfig.json product-video/src/index.ts product-video/src/Root.tsx
test ! -f product-video/remotion.config.ts || git add product-video/remotion.config.ts
git commit -m "feat: scaffold AutoSSL product video"
```

### Task 2: Lock The Storyboard Contract With Tests

**Files:**
- Create: `product-video/src/storyboard.mjs`
- Create: `product-video/test/storyboard.test.mjs`

- [ ] **Step 1: Write the failing timing contract test**

Create `test/storyboard.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {SCENES, TOTAL_FRAMES} from '../src/storyboard.mjs';

test('AutoSSL storyboard has six contiguous scenes covering 15 seconds', () => {
  assert.equal(TOTAL_FRAMES, 450);
  assert.equal(SCENES.length, 6);
  assert.equal(SCENES[0].from, 0);
  assert.equal(SCENES.at(-1).to, TOTAL_FRAMES);
  for (let index = 1; index < SCENES.length; index += 1) {
    assert.equal(SCENES[index - 1].to, SCENES[index].from);
  }
});
```

- [ ] **Step 2: Run the test to confirm the missing module failure**

Run: `npm test`

Expected: FAIL because `src/storyboard.mjs` does not yet exist.

- [ ] **Step 3: Add the minimal storyboard source of truth**

Create `src/storyboard.mjs` with `TOTAL_FRAMES = 450` and six entries using these exact ranges and copy:

```js
export const TOTAL_FRAMES = 450;

export const SCENES = [
  {id: 'problem', from: 0, to: 75, eyebrow: 'AUTOSSL', title: '证书管理，不该是待办事项'},
  {id: 'control', from: 75, to: 150, title: '服务器、域名、证书，一处管理'},
  {id: 'request', from: 150, to: 225, title: 'ACME 自动申请', detail: 'DNS 验证'},
  {id: 'deploy', from: 225, to: 300, title: 'SSH 自动部署', detail: '证书即刻生效'},
  {id: 'protect', from: 300, to: 375, title: '到期监控', detail: '自动续期'},
  {id: 'end', from: 375, to: 450, title: '把证书管理交给自动化', detail: '申请 · 部署 · 续期，一处完成'},
];
```

- [ ] **Step 4: Re-run the contract test**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit storyboard data and its test**

```bash
git add product-video/src/storyboard.mjs product-video/test/storyboard.test.mjs
git commit -m "feat: define AutoSSL video storyboard"
```

### Task 3: Implement Visual Flow And Original Audio

**Files:**
- Create: `product-video/src/AutoSSLProductIntro.tsx`
- Create: `product-video/src/autossl.css`
- Create: `product-video/scripts/generate-background-bed.mjs`
- Create: `product-video/public/autossl-shield.png`
- Create: `product-video/public/autossl-background.wav`

- [ ] **Step 1: Copy the approved local logo asset**

Run from `product-video/`:

```bash
cp ../public/logo.png public/autossl-shield.png
```

Expected: `file public/autossl-shield.png` reports the copied 1024x1024 PNG shield icon. Do not use customer or third-party logos.

- [ ] **Step 2: Implement one scene renderer per storyboard entry**

In `AutoSSLProductIntro.tsx`, use `Sequence`, `useCurrentFrame`, `interpolate`, and `spring` to render scene-local animation from `SCENES`. Create only these visual motifs:

```tsx
<Sequence from={scene.from} durationInFrames={scene.to - scene.from}>
  <SceneFrame tone={scene.id}>
    <DomainCard />
    <CertificateCard />
    <ServerNode />
    <FlowConnector />
    <SceneCopy title={scene.title} detail={scene.detail} />
  </SceneFrame>
</Sequence>
```

Use the deep blue, blue, teal, and green progression from the approved design. Keep all title copy inside a 140px horizontal safe area and avoid full desktop UI reconstruction.

The existing asset is an icon, not a wordmark. Render the end-card brand in code so it always displays the approved name:

```tsx
<div className="brand-lockup">
  <Img className="brand-shield" src={staticFile('autossl-shield.png')} />
  <span className="brand-wordmark"><span>auto</span>SSL</span>
</div>
```

Style `auto` in light blue and `SSL` in white, matching the existing application header.

- [ ] **Step 3: Add the video-only style sheet**

In `autossl.css`, use fixed 1920x1080 layout primitives. Use ordinary color fills, borders, and subtle shadows; do not add unrelated gradients, stock imagery, or decorative effects. Ensure title text can fit without wrapping beyond two lines at every key frame.

- [ ] **Step 4: Generate the original 15-second background bed**

Implement `scripts/generate-background-bed.mjs` to write a stereo 48kHz PCM WAV with low-volume, slowly changing sine tones and a brief fade in/out. Then run:

```bash
node scripts/generate-background-bed.mjs
```

Expected: `public/autossl-background.wav` exists, is 15 seconds long, and is not copied from `../public/notification.mp3`.

- [ ] **Step 5: Add background audio at a restrained level**

Use `staticFile('autossl-background.wav')` and an `Audio` component covering all 450 frames. Set a fixed volume at or below `0.14` so copy remains the focus. Do not add a voice-over or subtitles.

- [ ] **Step 6: Run the composition and storyboard checks**

Run:

```bash
npm test
npx remotion compositions src/index.ts
```

Expected: tests pass and the registered composition metadata matches the specification.

- [ ] **Step 7: Commit visual and audio source**

```bash
git add product-video/src product-video/scripts product-video/public/autossl-shield.png product-video/public/autossl-background.wav
git commit -m "feat: add AutoSSL product intro composition"
```

### Task 4: Preview And Approve The Video Before Final Export

**Files:**
- Create: `product-video/out/frame-000.png`
- Create: `product-video/out/frame-075.png`
- Create: `product-video/out/frame-150.png`
- Create: `product-video/out/frame-225.png`
- Create: `product-video/out/frame-300.png`
- Create: `product-video/out/frame-375.png`
- Create: `product-video/out/frame-449.png`
- Modify: `product-video/.gitignore`

- [ ] **Step 1: Ignore disposable preview output**

Add `out/` to `product-video/.gitignore` before generating stills.

- [ ] **Step 2: Render representative preview frames**

Run one command for each frame:

```bash
npx remotion still src/index.ts AutoSSLProductIntro out/frame-000.png --frame=0 --scale=0.25
npx remotion still src/index.ts AutoSSLProductIntro out/frame-075.png --frame=75 --scale=0.25
npx remotion still src/index.ts AutoSSLProductIntro out/frame-150.png --frame=150 --scale=0.25
npx remotion still src/index.ts AutoSSLProductIntro out/frame-225.png --frame=225 --scale=0.25
npx remotion still src/index.ts AutoSSLProductIntro out/frame-300.png --frame=300 --scale=0.25
npx remotion still src/index.ts AutoSSLProductIntro out/frame-375.png --frame=375 --scale=0.25
npx remotion still src/index.ts AutoSSLProductIntro out/frame-449.png --frame=449 --scale=0.25
```

Expected: every command exits 0; the frames show no clipped copy, empty canvas, or overlapping scene titles.

- [ ] **Step 3: Open the full interactive preview**

Run:

```bash
npx remotion studio src/index.ts --no-open
```

Expected: Studio exposes `AutoSSLProductIntro` and scrubbing the 0-449 timeline shows the six scenes in the approved order.

- [ ] **Step 4: Present preview frames to the user and request export authorization**

Report the still-image paths and Studio URL. Do not render an MP4 yet; final media export requires explicit user authorization under the approved design.

- [ ] **Step 5: Commit only source-control changes**

```bash
git add product-video/.gitignore
git commit -m "chore: ignore AutoSSL video previews"
```
