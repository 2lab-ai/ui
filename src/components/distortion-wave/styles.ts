/* The two views share one grid cell, so the element takes the size of the larger; the overlay lies over both and
   takes no clicks itself (its children do). The engine lays its canvas over the stage at z-index 1. */
export const styles = `
:host { display: block; position: relative; border-radius: inherit; }
:host([hidden]) { display: none; }
.ui-root { border-radius: inherit; }
.dw { display: grid; isolation: isolate; position: relative; border-radius: inherit; min-width: 0; }
.dw-layer { grid-area: 1 / 1; min-width: 0; min-height: 0; isolation: isolate; border-radius: inherit; }
.dw-layer[hidden] { display: none; }
.dw-overlay { grid-area: 1 / 1; min-width: 0; min-height: 0; position: relative; z-index: 2; pointer-events: none; }
::slotted([slot="overlay"]) { pointer-events: auto; }
`;
