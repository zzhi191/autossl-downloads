# AutoSSL Product Intro Video Design

## Goal

Create a 15-second horizontal product-introduction video for AutoSSL's public website. The video should help a general enterprise audience understand that certificate work can be automated, without requiring prior knowledge of ACME, DNS, or SSH.

## Approved Direction

- Format: 1920x1080, 30 fps, 450 frames (15 seconds).
- Narrative: an automation capability flow, not a product-interface tutorial or a fear-based alert story.
- Audience: general enterprise website visitors.
- End card: value proposition only, with no download button.
- Audio: restrained electronic ambient background music, no voice-over. Use only a commercial-use licensed track or an original generated track.

## Product Facts To Show

The video may only portray capabilities implemented in this repository:

- Manage servers, domains, and certificates in one desktop client.
- Request certificates through ACME with DNS validation.
- Deploy certificate files to configured remote servers through SSH.
- Monitor expiry and trigger renewal.
- Store local sensitive data with encryption.

It must not display customer names, real credentials, fabricated usage metrics, or claims of unsupported automation.

## Storyboard

| Time | Scene | On-screen copy | Motion |
| --- | --- | --- | --- |
| 0.0-2.5s | Brand and problem | "证书管理，不该是待办事项" | A certificate card appears against the AutoSSL deep-blue field. |
| 2.5-5.0s | Centralized control | "服务器、域名、证书，一处管理" | Separate domain, server, and certificate cards converge into one workspace. |
| 5.0-7.5s | Certificate request | "ACME 自动申请" / "DNS 验证" | A domain card progresses through a concise validation path. |
| 7.5-10.0s | Deployment | "SSH 自动部署" / "证书即刻生效" | The issued certificate travels from AutoSSL to server nodes. |
| 10.0-12.5s | Ongoing protection | "到期监控" / "自动续期" | A healthy status ring replaces an approaching-expiry marker. |
| 12.5-15.0s | End card | "把证书管理交给自动化" / "申请 · 部署 · 续期，一处完成" | The flow resolves into the AutoSSL wordmark and value proposition. |

## Visual System

- Start from the existing desktop application's dark blue, light blue, teal, and green status language.
- Use abstract cards, nodes, connecting lines, certificate symbols, and status markers rather than reproducing a full UI in 15 seconds.
- Move from visual fragmentation to a connected flow. Use clear, short Chinese copy with generous safe margins for website embedding.
- Avoid faux terminal output, unverified logos, stock imagery, gradients, and decorative effects unrelated to the certificate flow.

## Composition Contract

Create one Remotion composition named `AutoSSLProductIntro`.

- `width`: 1920
- `height`: 1080
- `fps`: 30
- `durationInFrames`: 450
- All copy and scene timing live in code so a later update changes one source of truth.
- Each scene receives a stable frame interval and an entrance/exit transition that cannot overlap the next scene's primary copy.

## Assets And Audio

- Reuse the local AutoSSL logo when it remains sharp at the required size; otherwise recreate the wordmark as text using a visually comparable system font.
- Do not use `public/notification.mp3` as background music because it is a UI notification asset rather than a soundtrack.
- Keep the music level below the visual experience and make it simple to replace by a single asset path.

## Verification

Before claiming the composition complete:

1. Confirm the composition metadata is 1920x1080, 30 fps, and 450 frames.
2. Render representative stills at frames 0, 75, 150, 225, 300, 375, and 449 to check copy, clipping, contrast, and scene transitions.
3. Open the composition in Remotion Studio and scrub the full timeline for timing and visual overlap.
4. Only render an MP4 after explicit user authorization; report the output path and the final media metadata.

## Out Of Scope

- Product UI changes in AutoSSL.
- A voice-over, subtitles, external stock footage, or custom sound design.
- Publishing the rendered file to a website or social platform.
