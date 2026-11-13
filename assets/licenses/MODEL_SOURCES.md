# Runtime character assets

The infected civilian, infected worker and first-person hands are derived from
the MakeHuman core base mesh and default skin weights, explicitly released as
CC0. They are not assets from Left 4 Dead, Mixamo or a paid generation service.

- Upstream: https://github.com/makehumancommunity/makehuman
- Pinned source commit: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`
- Files: `makehuman/data/3dobjs/base.obj`, `makehuman/data/rigs/default.mhskel`,
  `makehuman/data/rigs/default_weights.mhw`.
- License: https://www.makehumancommunity.org/about/license.html
- Full asset license is preserved in `MakeHuman-CC0.md`.
- Blender used: 4.3.2, command-line Python API. Blender MCP was not connected.
- Modifications: exposed-skin selection, separate garment mesh, clothing colours,
  pockets/collar/reflectors, eyes/hair, 37-joint reduction, four normalized skin
  influences, two material draws per infected, near/far geometry, curved grip.
- Two original garment colourways; existing original generated fabric texture.
- Locomotion, anticipation, attack, hit and death poses are authored in
  `client/characters.js`, blended against the imported bind pose. These are
  procedural skeletal animation, not motion-capture clips or ragdolls.
- `.glb.gz` files are repository compression only. Build expands to normal GLB.
  GPU texture compression (KTX2/Basis) is not claimed.
- Runtime GLTFLoader and SkeletonUtils come from the pinned Three.js 0.164.1
  dependency, under its MIT license.

Offline reproduction: download the three pinned upstream files to a temporary
directory, run both `scripts/modeling/build_*.py` using Blender, gzip the GLBs,
then run `npm run build`. Production builds need neither Blender nor upstream
MakeHuman downloads. Model budgets are recorded in `assets/models/model-audit.json`.

The AI-generated material textures are recorded in
`docs/STABILITY_VISUALS_20261113.md`. The original BBANANA images remain only as
load-failure fallback art and are not represented as rigged 3D models.
