---
name: stickman-shorts
description: Create and improve original animated stickman Shorts using this repository's deterministic local Swift/AVFoundation production tools. Use for research, scripting, storyboard authoring, rendering, repair, QA, and export.
---

# Original stickman production

The user's output is an original video with coherent actions and clear causality. Tools execute structured plans; prose alone is not a finished video. Communicate in Spanish; narration is natural American English. Never publish publicly or upload anything. No Anthropic API key is required for local production in Claude Code.

## Establish the environment

1. Read `AGENTS.md`, `docs/SETUP.md`, `studio/lib/types.ts`, and `examples/feather.json`.
2. Run `npm run doctor`. Explain exact missing prerequisites. Do not modify global SDK files or download assets silently. Do not read or print credentials.
3. Check `npm run shorts -- list` and existing project JSON titles to avoid duplicate topics. Topic research must use real sources, not invented citations.

## Research and direct

1. Select a concrete event or physical explanation with a surprising first frame and a visual payoff. Preserve source URL, specific evidence, and fact IDs in project metadata. Separate factual narration from reconstructed visuals. Never invent dialogue and call it history.
2. Write an original script, aiming for intelligible fast speech and roughly 60 seconds. Voice duration sets the timeline. Revise the script when pacing fails; do not force duration with excessive audio acceleration.
3. Use ~18–30 purposeful beats. Every scene's narration must correspond to its action and props. Keep person/object identities stable across cuts. State release heights, targets, direction and reactions consistently. A static pose with unrelated props is not meaningful storytelling.
4. Author a project JSON using the version-1 types. Only use registered actions, props and camera modes. Add missing mechanics in the renderer and tests before referencing them. Do not execute generated source from a storyboard.
5. Characters have round white heads, dark jointed limbs, two eyes, and fixed proportions. Observer is a separate canonical hooded figure with two pale cyan eyes and no facial details; it is silent.

## Produce and inspect

1. Validate: `npm run shorts -- validate --project projects/<id>.json`.
2. Preview: `npm run shorts -- render --project projects/<id>.json --profile preview`.
3. Inspect `outputs/<id>/preview/qa/contact.png` and every affected scene PNG. Listen to the actual MP4 narration; inspect caption synchronization and pauses. Read status, alignment diagnostics, and the technical QA report. If your environment cannot play audio, say so and keep editorial approval pending.
4. Repair the smallest affected scenes, then rerun. Cached audio and scenes are reused. Limit creative revisions to three passes before marking unresolved issues clearly. Never mark a run approved just because it rendered.
5. Final: `npm run shorts -- render --project projects/<id>.json --profile final`. Inspect final-resolution frames and audio; a preview review does not approve a different final MP4.
6. A technical pass is separate from editorial acceptance. Review hook, clarity, continuity, character consistency, captions, narration, pacing, facts and ending. Each must be ≥8/10 to approve. Keep scene-specific notes, frame paths actually inspected, whether actual audio was listened to, reviewer identity, and exact SHA-256 from `run.json`. Never fabricate evidence.
7. Use `examples/review.json` as the shape. Save it in the project folder and run `npm run shorts -- review --id <id> --file <review.json>` only after real review. `NEEDS_REVIEW` is an honest useful output, not a failure to hide.
8. Export locally: `npm run shorts -- export --id <id> --destination <local-output-folder>`. Export rejects stale QA/review and preview renders. Report paths, actual checks and measured production time. Do not promise full autonomy or 100% quality from an untested integration.

## Performance and repairs

Use preview resolution for composition changes. Parallel scene rendering defaults to two workers; cap at four. Never launch multiple jobs with the same project ID. Reuse cached stages. Do not delete shared caches or outputs to make a benchmark look better. Stage logs and failed partial artifacts are diagnostic evidence. Cached renders must be keyed by all behavior-affecting inputs; update cache versions after changing alignment logic or audio models.

The legacy bridge's code and docs retain their MIT license. Its reference frames and contact sheets are study materials; never incorporate them into a produced video. Missing GLB assets in the legacy template do not affect the procedural native engine.
