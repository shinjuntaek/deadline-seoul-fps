# DEADLINE: SEOUL — Release Gate (2026-11-11)

> Status: **PREVIEW / Draft PR — Not approved for public release**.

## Deployed test builds

- Preview project: `deadline-seoul-fps`, Vercel team `team_gsZG31pNoytLQyqD8yjqk6M4`.
- Source branch: `fix/recovery-bbanana-preview-20261111`.
- Production branch: `main` remains unchanged.
- Merge point: [Draft PR #1](https://github.com/shinjuntaek/deadline-seoul-fps/pull/1).
- First verified working scene: `dpl_H22SBjqxWQs5J2V6jzCfhAe4BNqc`.
- Procedural 3D + PBR weapon enhancements: `dpl_PVbcxD2K869ydBN1hPFxmy4wHzAo`.
- Low-end adaptive WebGL build measured: `dpl_WUaCpFNkegbpFCDwYv5Pv4TnBHAR`.
- Keyboard and mouse synthetic-event QA: `dpl_6hK9wGryJoV8GGx3JK7BvZQsUTPA`.

## Completed verification

| Check | Result | Scope |
|---|---|---|
| Script syntax, assets, PWA, headers, waves | 13/13 PASS | Vercel build |
| Integration regression | 182/182 PASS | Real browser, internal game functions + synthetic events |
| Direct shooting and body hit | PASS | Real `shoot` and raycaster; enemy HP 108 → 20 |
| Reload | PASS | Magazine 29 → 30; reserve 180 → 179 |
| Damage | PASS | Health 100 → 93; armor 50 → 37 |
| WASD key handler + movement | PASS | Synthetic KeyW event; camera moves |
| Mouse button handlers | PASS | Synthetic mousedown/up; `fireHeld` true → false |
| Enemy waves | PASS | 7/11/15/20/24; 1 brute on waves 4 and 5 |
| Extraction | PASS | Simulated 7-second extraction and victory state |
| Software GPU browser FPS | 16.2 FPS avg; 83.3ms p95 | 20-second, 262 frames, Chrome 151 x86_64 / SwiftShader 2 CPU / 4GB |
| Mobile phone GPU FPS | **NOT MEASURED** | Needs physical Android/iOS device |

**Distinction:** Wave checks automatically spawn and defeat enemies to exercise the state machine. They do **not** establish human completion, combat balance, aim feel, difficulty, or mobile device playability.

## Reproduce on a physical mobile phone

Use the current Vercel Preview share link (valid ~23 hours). Append `benchmark=1` to its query string.

1. Open Chrome on a mid-range Android phone, connect to stable Wi-Fi, and disable battery saver.
2. Leave the game page visible in the foreground and keep the screen awake for at least 20 seconds.
3. The full-screen game draws a visible status JSON with `avgFPS`, `p95FrameMs`, `p99FrameMs`, `softwareGPU`, `renderScale`, `width`, `height` and device information.
4. Tap **측정 결과 복사**, then record the exact result separately; the measurement is stored locally under `deadline-seoul-last-benchmark`.
5. Repeat with a mid-range iPhone Safari and desktop GPU to compare. The test performs no data upload.

Use `?qa=release` only on protected Preview deployments to run the engine's synthetic integration tests. Do not enable automated play on a public production domain.

## Production acceptance criteria (targets, not achieved claims)

- Real gameplay: first-person WASD/touch, pointer lock, shooting, recoil, reload, raycast headshots, enemy collision, wave progression, pause/resume, victory, game over and restart all pass on supported browsers.
- Full manual playthrough: all five waves and the 7-second extraction, no soft-lock or progression blocker, 3 consecutive runs.
- Mobile: acceptable play at ≥30 average FPS with p95 frame time <50 ms on an identified mid-range phone; no memory crashes over 15 minutes.
- Desktop with hardware GPU: target 60 FPS average at 1080p; no extreme p99 frame spikes.
- Load speed: first visible menu and textures should load reliably with cache disabled and 4G throttling; inspect largest asset/contentful paint.
- UI: small mobile viewports, touch controls, orientation, sound volume, font readability, settings persistence, and accessibility.
- Production: verified rights for all art/assets, no temporary QA cheat endpoints, no reliance on URLs with expiring signatures, source build repeatable, final privacy/security review.

## Asset quality gap

**Current:** Original BBANANA still art converted into 5 local WebP assets; volumetric articulated procedural zombie meshes with full-body photo-impostor overlays; geometry-enhanced PBR first-person rifle/shotgun models. 3D limbs/torso/head animate procedurally. These are **not** fully rigged photogrammetric 3D human zombies, nor asset-authentic weapon GLBs.

**Remaining:** Generate or license character GLBs with humanoid skeletons, attack/walk/run/stagger/death clips and proper PBR textures, then implement animation retargeting, skinning, LOD, animation blending and GPU budget. Same for weapon models and hands. New BBANANA paid 3D generation is deferred until model/credit cost approval; no paid 3D generation was charged in this patch.

## Before merging PR #1

- [ ] Physical desktop playthrough and real mouse/pointer lock test
- [ ] Mid-range Android and iPhone hardware benchmarks
- [ ] Rigged 3D character replacement verified
- [ ] Realistic weapon GLB and animations verified
- [ ] Human balance testing and smoke/regression QA
- [ ] Remove preview-only QA shortcuts and finalize production access/caching
- [ ] Approve PR and promote only after all gates pass
