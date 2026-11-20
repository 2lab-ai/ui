/** The ring's box is `size` square; the canvas may reach past it on either side (negative margins) as it leans. */
export const styles = `
:host { display: inline-block; vertical-align: middle; line-height: 0; }
.vr { position: relative; width: var(--vr-size, 160px); height: var(--vr-size, 160px); }
.vr canvas { display: block; pointer-events: none; }
`;
