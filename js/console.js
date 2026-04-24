/* ─────────────────────────────────────────────────────────────────────────
   KCM CONSOLE — console.js  (v0.1.1 hotfix)
   Session 1 scope: render the chromatic clock on the landing hero.
   The state bus is NOT in this file yet — Session 2 adds it.

   HOTFIX v0.1.1:
     - Rotated the chromatic wheel -15° so C is CENTERED at 12 o'clock
       (not starting at 12 o'clock). This matches how a regular clock face
       reads: the "12" is centered at the top, not placed at the 12-to-1
       boundary. This is now the canonical KCM Visual Standard.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── 12-Color Chromatic Spectrum™ ─────────────────────────────────────
  // Canonical order starting at C = 12 o'clock, clockwise.
  // Hex values must match css/console.css :root tokens.
  const CHROMATIC = [
    { pc: 'C',  hex: '#FFFF00' },
    { pc: 'C#', hex: '#FFC400' },
    { pc: 'D',  hex: '#FF8000' },
    { pc: 'D#', hex: '#FF4000' },
    { pc: 'E',  hex: '#FF0000' },
    { pc: 'F',  hex: '#C4007F' },
    { pc: 'F#', hex: '#8000FF' },
    { pc: 'G',  hex: '#4000FF' },
    { pc: 'G#', hex: '#0000FF' },
    { pc: 'A',  hex: '#007FFF' },
    { pc: 'A#', hex: '#00FF80' },
    { pc: 'B',  hex: '#80FF00' }
  ];

  // ── SVG chromatic clock renderer ─────────────────────────────────────
  // Produces 12 pie-slice wedges. C wedge is CENTERED at 12 o'clock.
  // Each wedge spans 30°. Outer radius 180, inner radius 62.
  //
  // Math: SVG 0° is the positive x-axis (3 o'clock). We rotate by -90°
  // to put 0° at 12 o'clock. We ALSO subtract an additional 15° to shift
  // the whole wheel counterclockwise by half a wedge, so that C (the
  // first wedge) straddles 12 instead of starting at 12.
  //
  // Net rotation applied to every wedge: -90° - 15° = -105°
  function renderChromaticClock(groupEl) {
    if (!groupEl) return;

    const cx = 200;
    const cy = 200;
    const rOuter = 180;
    const rInner = 62;
    const wedgeDeg = 30;
    const halfWedge = 15;              // ← the rotation fix
    const svgNS = 'http://www.w3.org/2000/svg';

    CHROMATIC.forEach((note, i) => {
      // Each wedge i spans from angle i*30 to (i+1)*30, clockwise from 12.
      // Apply -90° (put 0 at 12 o'clock) AND -15° (center C on 12).
      const startDeg = i * wedgeDeg - 90 - halfWedge;
      const endDeg   = (i + 1) * wedgeDeg - 90 - halfWedge;

      const startRad = (startDeg * Math.PI) / 180;
      const endRad   = (endDeg   * Math.PI) / 180;

      const xOuterStart = cx + rOuter * Math.cos(startRad);
      const yOuterStart = cy + rOuter * Math.sin(startRad);
      const xOuterEnd   = cx + rOuter * Math.cos(endRad);
      const yOuterEnd   = cy + rOuter * Math.sin(endRad);

      const xInnerStart = cx + rInner * Math.cos(startRad);
      const yInnerStart = cy + rInner * Math.sin(startRad);
      const xInnerEnd   = cx + rInner * Math.cos(endRad);
      const yInnerEnd   = cy + rInner * Math.sin(endRad);

      const largeArc = 0;

      const d = [
        `M ${xInnerStart} ${yInnerStart}`,
        `L ${xOuterStart} ${yOuterStart}`,
        `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${xOuterEnd} ${yOuterEnd}`,
        `L ${xInnerEnd} ${yInnerEnd}`,
        `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xInnerStart} ${yInnerStart}`,
        'Z'
      ].join(' ');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', note.hex);
      path.setAttribute('stroke', '#0a0a15');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('opacity', '0.95');
      path.setAttribute('data-pc', note.pc);
      groupEl.appendChild(path);

      // Label at wedge midpoint
      const midDeg = (startDeg + endDeg) / 2;
      const midRad = (midDeg * Math.PI) / 180;
      const rLabel = (rOuter + rInner) / 2;
      const xLabel = cx + rLabel * Math.cos(midRad);
      const yLabel = cy + rLabel * Math.sin(midRad);

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', xLabel);
      text.setAttribute('y', yLabel + 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'Cinzel, serif');
      text.setAttribute('font-size', '16');
      text.setAttribute('font-weight', '600');
      text.setAttribute('fill', '#0a0a15');
      text.setAttribute('pointer-events', 'none');
      text.textContent = note.pc;
      groupEl.appendChild(text);
    });
  }

  // ── Build version stamp ──────────────────────────────────────────────
  const BUILD = {
    version: '0.1.1',
    session: 1,
    built:   '2026-04-23',
    notes:   'Hotfix: C centered at 12 o\'clock'
  };

  function stampBuildVersion() {
    const el = document.getElementById('build-version');
    if (el) {
      el.textContent = `Build ${BUILD.version} · Session ${BUILD.session} · ${BUILD.built}`;
    }
  }

  // ── State bus (stub — filled in Session 2) ───────────────────────────
  window.KCM = window.KCM || {};
  window.KCM.build = BUILD;
  window.KCM.bus   = null;

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    const group = document.getElementById('chromatic-wedges');
    renderChromaticClock(group);
    stampBuildVersion();

    // eslint-disable-next-line no-console
    console.log(
      '%cKCM Console %cv' + BUILD.version,
      'font-family:Cinzel,serif;font-size:18px;color:#00c0c0;font-weight:600;',
      'font-family:Montserrat,sans-serif;font-size:14px;color:#F4D03F;'
    );
    console.log('Session ' + BUILD.session + ' — ' + BUILD.notes);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
