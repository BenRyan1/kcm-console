/* ─────────────────────────────────────────────────────────────────────────
   KCM CONSOLE — kcm-uhim.js
   Universal Harmonic Identity Mapping (UHIM) — Tri-Axial Coordinate Engine
   Claims: UHIM-1, UHIM-2, UHIM-3, UHIM-4
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var CHROMATIC_COLORS = ['#FFFF00','#FFC400','#FF8000','#FF4000','#FF0000','#C4007F','#8000FF','#4000FF','#0000FF','#007FFF','#00FF80','#80FF00'];
  var CHROMATIC_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  var MODE_INTERVALS = {
    ionian:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],
    lydian:[0,2,4,6,7,9,11],mixolydian:[0,2,4,5,7,9,10],aeolian:[0,2,3,5,7,8,10],locrian:[0,1,3,5,6,8,10]
  };
  var DEGREE_NAMES = ['tonic','supertonic','mediant','subdominant','dominant','submediant','leading tone'];
  function axis1(pc) { return { pitchClass:pc, angleDegrees:pc*30, color:CHROMATIC_COLORS[pc], noteName:CHROMATIC_NAMES[pc] }; }
  function axis2(pc, root, mode) {
    var ivs = MODE_INTERVALS[mode]||MODE_INTERVALS.ionian;
    var offset = (pc-root+12)%12;
    var di = ivs.indexOf(offset);
    return { semitoneOffset:offset, inScale:di!==-1, degreeIndex:di,
      degreeName:di!==-1?DEGREE_NAMES[di]:'chromatic',
      absoluteIdentity:CHROMATIC_NAMES[pc],
      relativeIdentity:di!==-1?(di+1)+' — '+DEGREE_NAMES[di]+' of '+CHROMATIC_NAMES[root]+' '+mode:'chromatic passing tone' };
  }
  function spokeDistance(pc1,pc2) { var d=Math.abs(pc1-pc2)*30; return d>180?360-d:d; }
  function tensionVector(pc,root) { return spokeDistance(pc,root); }
  function tensionLabel(deg) {
    if(deg===0)return'tonic — no tension';if(deg<=30)return'neighbor — minimal tension';
    if(deg<=60)return'mild dissonance';if(deg<=90)return'moderate tension';
    if(deg<=120)return'strong tension';if(deg<=150)return'high dissonance';
    return'tritone — maximum tension';
  }
  function axis3(pc,root,active) {
    var dists=(active||[]).filter(function(p){return p!==pc;}).map(function(p){return{to:CHROMATIC_NAMES[p],degrees:spokeDistance(pc,p)};});
    var tv=tensionVector(pc,root);
    return { spokeDistances:dists, tensionVector:tv, tensionLabel:tensionLabel(tv) };
  }
  function voiceLeadingPath(chordA,chordB) {
    return chordA.map(function(pc){
      var best=null,bestD=Infinity;
      chordB.forEach(function(t){var d=spokeDistance(pc,t);if(d<bestD){bestD=d;best=t;}});
      return {from:{pitchClass:pc,name:CHROMATIC_NAMES[pc]},to:{pitchClass:best,name:CHROMATIC_NAMES[best]},motionDegrees:bestD,direction:((best-pc+12)%12<=6)?'clockwise':'counter-clockwise'};
    });
  }
  function coordinate(midi,root,mode) {
    var pc=midi%12,oct=Math.floor(midi/12)-1;
    var a1=axis1(pc),a2=axis2(pc,root,mode);
    return { p:pc,o:oct,h:a2.degreeIndex,chromatic:a1,modal:a2,midi:midi,
      toJSON:function(){return{p:pc,o:oct,h:a2.degreeIndex,name:a1.noteName,color:a1.color,angle:a1.angleDegrees,degree:a2.relativeIdentity,midi:midi};} };
  }
  function attachToBus() {
    if(!window.KCM||!window.KCM.bus)return;
    window.KCM.bus.subscribe(function(state){
      var rootPC=CHROMATIC_NAMES.indexOf(state.root);
      if(rootPC<0)return;
      var coords=Array.from(state.activeNotes||[]).map(function(m){return coordinate(m,rootPC,state.mode).toJSON();});
      window.KCM.bus.set({uhimCoords:coords});
    });
  }
  window.KCM=window.KCM||{};
  window.KCM.uhim={axis1:axis1,axis2:axis2,axis3:axis3,coordinate:coordinate,spokeDistance:spokeDistance,tensionVector:tensionVector,voiceLeadingPath:voiceLeadingPath,attachToBus:attachToBus};
  if(window.KCM&&window.KCM.bus)attachToBus();
  else window.addEventListener('kcm-bus-ready',attachToBus);
  console.log('[KCM.uhim] Tri-axial coordinate engine ready — UHIM-1/2/3/4');
})();
