# Stability and visual improvement candidate — 2026-11-13

Based on PR #5 commit `7579315`. Existing PRs and the public alias are unchanged.

## Implemented

- Session-scoped resume token, bounded reconnect backoff, heartbeat timeout,
  generation guards for stale sockets, full resume snapshot and client re-entry.
- Explicit leave clears session/lobby UI. Temporary lobby disconnect retains a
  seat for 30 seconds; all-team transport loss no longer immediately loses the match.
- All 14 spawn anchors moved into walkable space. Obstacle-aware pursuit finds a
  route around checkpoints, vehicles and buildings for all three enemy sizes.
- A 110 ms snapshot buffer interpolates positions and shortest-arc rotations;
  extrapolation is capped at 80 ms and bounded speed. Old samples are discarded.
- Shared Sprite geometry is not disposed when removing a teammate. Invisible
  photographic hitboxes remain raycastable but skip rendering/shadow submissions.
- Original AI-generated asphalt, concrete, fabric and gunmetal WebP textures:
  512 px each, about 308 KiB total. Wet-road light pools use one instanced draw.
  High/medium use four faint mist cards; low/software GPU omits them.
- Teammate limbs now animate from actual interpolated travel. Shadow coverage
  follows the camera on a snapped grid; map resolution is bounded.
- Raw frame-time diagnostics, 180 bounded samples, JS heap if available,
  draw/triangle/texture/geometry counts and WebSocket state/RTT. These counters
  are **not a measurement of GPU memory bytes**.
- Game handles WebGL context loss/restoration and suspends hidden-tab rendering.

## Validation and limits

`npm run build` runs engine, actual loopback WebSocket and regression checks.
`scripts/browser-stability.cjs` adds two independent Chromium contexts, reload
resume and lobby reset assertions to CI. Chromium CI uses SwiftShader; it is
not a real Android/desktop GPU performance certification.

All 14 spawn anchors × three classes must approach the center in a 70-second
simulation. This test boosts player health and is a navigation regression,
**not** proof of a full five-wave human playthrough. Existing five-wave tests
clear enemies synthetically. Long physical-device play and thermal/memory QA remain.

The cloud browser currently cannot initialize WebGL, including for the original
public build. Do not interpret this as a newly reproduced game browser crash.

## Dedicated co-op deployment gate

The Vercel fallback still stores rooms per process. **Cross-instance room routing
is not fixed by a frontend change.** The Dockerfile and Railway configuration
prepare a one-replica persistent Node service; Railway is not connected yet.

For an isolated test environment:

1. Deploy this branch's Dockerfile with one replica on a connected server host.
2. Set `COOP_ALLOWED_ORIGINS` to the exact approved Preview origins.
3. Verify `/api/multiplayer` reports `dedicated-single-process`.
4. Build a Preview with `COOP_SERVER_URL=wss://<server>/api/multiplayer`.
5. Test room creation/join/reconnect from two separate networks for 30+ minutes.

Server restarts still lose rooms; no durable database or automatic scaling is
claimed. Do not scale beyond one replica without a room coordinator.
No production promotion, alias replacement or PR merge is authorized.

## Visual asset provenance and next gate

New material textures were generated specifically for this game by the built-in
image generator. Prompt: four equal atlas quadrants: dark cracked Seoul asphalt,
rain-streaked concrete, worn olive tactical fabric and scratched gunmetal;
photographic diffuse texture, no objects/logos/text, flat lighting. The generated
atlas was cropped/resized/compressed for runtime use. No external game art was copied.

Existing BBANANA zombie cutouts remain in use. They are **not fully rigged 3D
characters**, and this candidate is not claimed to match Left 4 Dead fidelity.
New animated anatomical character meshes are the next visual gate.

Plugin discovery found unconnected fal (3D assets) and Railway (persistent
co-op host). Connection requires the user's account connection flow. Existing
BBANANA offers Meshy 3D: 2K/4K texture + standard geometry 15 credits per model;
8K or higher geometry 17.5 credits, both 20 credits. A 2K, PBR, 8–12k polygon
infected model at 15 credits is proposed first, subject to the tool-required price
confirmation. No paid generation was submitted and no subscription purchased.
