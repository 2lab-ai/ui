// After the lib build: dist/THIRD_PARTY_NOTICES.md — the MIT notices of code bundled into dist (Cuelume, in
// dist/sound-cuelume.js) or ported from (Morphin UI's sound policy, in dist/sound.js and the elements; bencho.dev's
// free blocks, in six elements; Libraries.dev, in the effects; Paper Shaders, in the liquid metal effect).
import { readFileSync, writeFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../licenses/${f}`, import.meta.url), 'utf8').trim();
const out = `# Third-party notices

@2lab.ai/ui is UNLICENSED. It bundles or adapts the following MIT-licensed work (and one Apache-2.0 shader).

## Cuelume 0.2.8 — https://github.com/danielwh2/cuelume

Bundled into \`dist/sound-cuelume.js\` (the interface sounds, synthesized with Web Audio).

\`\`\`
${read('cuelume.LICENSE')}
\`\`\`

## Morphin UI — https://github.com/sikkeep/morphinui

The sound policy (\`dist/sound.js\`: the cue set, the cue queue, the Cuelume mapping) is ported from its \`sound\` and
\`sound-cuelume\` registry items (https://morphin.dev/docs/sound).

\`\`\`
${read('morphinui.LICENSE')}
\`\`\`

## bencho.dev free blocks — https://bencho.dev

Six elements are ported from bencho.dev's MIT-licensed blocks (https://bencho.dev/licence): \`ui-slide-confirm\`
(Slide to confirm), \`ui-agent-island\` (Dynamic island), \`ui-step-track\` (Step player), \`ui-action-node\` (Action
node), \`ui-image-compare\` (Image compare) and \`ui-ascii-wake\` (ASCII wake). No Bencho Pro block is included.

\`\`\`
${read('bencho.LICENSE')}
\`\`\`

## Libraries.dev — https://github.com/Jakubantalik/Libraries.dev

The effects (\`group: 'Effects'\`) are ported from its MIT-licensed React libraries (https://libraries.dev): the
distortion wave (\`distortion-waves\`), the border beam (\`border-beam\`), the thinking orb (\`thinking-orbs\`), gooey
(\`liquid-gooey\`), the voice glow (\`voice-glow\`), the voice ring (\`voice-ring\`), magnetic UI (\`magnetkit\`'s field
and bridge client — no model file), liquid metal (\`metal-fx\`), the image reveal (\`img-fx\`, redrawn without three.js)
and bot avatars (\`bot-avatars\`); the mood HUD and the replayed showcase route come from the Mood recognition page's
source (\`sites/home/src/mood-hud.ts\`, \`mood-recognition.tsx\`). No Pro preset, Studio export, model file or model kit
(Libraries.dev Model License — the Mood recognition model, its React kit and its loader included) is included; the mood
reader is this library's own heuristic.

\`\`\`
${read('librariesdev.LICENSE')}
\`\`\`

## Paper Shaders 0.0.80 — https://github.com/paper-design/shaders

The liquid metal effect (\`ui-metal\`) inlines Paper Shaders' \`liquidMetal\` fragment shader and its sizing vertex
shader, unmodified, under the Apache License 2.0.

\`\`\`
${read('paper-shaders.NOTICE')}
\`\`\`

\`\`\`
${read('paper-shaders.LICENSE')}
\`\`\`
`;
writeFileSync(new URL('../dist/THIRD_PARTY_NOTICES.md', import.meta.url), out);
console.log('dist/THIRD_PARTY_NOTICES.md', out.length, 'bytes');
