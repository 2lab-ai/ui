// After the lib build: dist/THIRD_PARTY_NOTICES.md — the MIT notices of code bundled into dist (Cuelume, in
// dist/sound-cuelume.js) or ported from (Morphin UI's sound policy, in dist/sound.js and the elements; bencho.dev's
// free blocks, in six elements).
import { readFileSync, writeFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../licenses/${f}`, import.meta.url), 'utf8').trim();
const out = `# Third-party notices

@2lab.ai/ui is UNLICENSED. It bundles or adapts the following MIT-licensed work.

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
`;
writeFileSync(new URL('../dist/THIRD_PARTY_NOTICES.md', import.meta.url), out);
console.log('dist/THIRD_PARTY_NOTICES.md', out.length, 'bytes');
