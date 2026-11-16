---
name: stickman-shorts
description: Research and develop the requested stickman Shorts workflow, with scene-specific visual direction and local native rendering experiments. The current native look is rejected for production.
---

# Stickman visual development

Read `AGENTS.md`, `CLAUDE.md`, `docs/VISUAL_REVIEW.md`, and `studio/production-status.json` first. Communicate in Spanish; channel-facing stories must use natural American English. Never publish or upload.

## Current decision

The native `feather` demo was rejected for visual quality. It is not the desired look, not a production template, and not the default renderer. Its successful encoding, cache speed and technical QA do not approve its direction. Do not make another full Short by replacing narration and props in that layout. Do not change the status to approved based on tests or invented scores.

The original repository's bridge/audio code and style studies remain engineering references for camera grammar, depth, lighting, motion, sound and scene-specific staging. Do not copy third-party footage, scripts, voices, branding or copyrighted reference images. Keep the requested stickman identity and the Observer's canonical silhouette and eyes.

## Corrective workflow

1. Research the story using reliable sources. Preserve evidence and distinguish facts from reconstructed visuals.
2. Design each scene for its action and narration. Show cause and effect, character intention and reactions. Avoid repeated poses, floating props, large unused areas and arbitrary camera changes.
3. Develop a short sequence that demonstrates a complete interaction and intentional shot changes. Keep rendering local with Swift/AVFoundation according to the project rules. Adapt useful techniques from the original source instead of silently discarding its visual sophistication.
4. Use `studio/lib/types.ts` and `studio/story.schema.json` only as current experimental interfaces. Add missing mechanics before referencing them. Never execute source code generated inside a storyboard.
5. Native render experiments require the explicit `--experimental-native` flag. Example: `npm run shorts -- render --project projects/test.json --profile preview --experimental-native`. Label the output as experimental. `npm run smoke` is a rig test, not a demonstration of accepted production quality.
6. Inspect actual motion, representative full-resolution frames and actual audio. Technical metadata alone is insufficient. If actual audio cannot be listened to, record that limit. Preserve the rejection while visual deficiencies remain unresolved.
7. Keep deterministic improvements such as content caching, bounded workers, accurate timing, resource validation and diagnostic reports where useful. Do not trade acting, staging or visual richness for render speed.
8. Approval and export of the current prototype are disabled. A new visual direction must be substantively rebuilt and evaluated before production is re-enabled; do not bypass this by adding a positive review JSON.

No Anthropic API key is needed for local technical tools. Integration with an authenticated Claude Code session remains unverified. Do not claim full autonomous production is complete.
