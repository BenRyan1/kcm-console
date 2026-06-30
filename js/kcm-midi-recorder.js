/**
 * kcm-midi-recorder.js — Keys, Codes & Modes™
 * Option C: MIDI capture + OfflineAudioContext WAV render
 * No microphone. No feedback. No webm. Real .wav every time.
 * Flow: REC → play notes → STOP → PLAY (instant) → WAV (real .wav file)
 */
(function(global) {
  'use strict';

  const NOTE_TO_MIDI = {
    'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,
    'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,
    'A':9,'A#':10,'Bb':10,'B':11
  };
  const MIDI_TO_HZ = midi => 440 * Math.pow(2, (midi - 69) / 12);

  function noteNameToMidi(name, octave) {
    const b = NOTE_TO_MIDI[name];
    return b === undefined ? null : b + ((octave + 1) * 12);
  }

  let isRecording=false, startTime=null;
  let events=[], takes=[], timerInterval=null;

  // Stub for API compatibility
  function connectSynthOutput(){}

  function now(){ return startTime ? Math.max(0, performance.now()-startTime) : 0; }

  function noteOn(midiNote, velocity){
    if(!isRecording) return;
    events.push({type:'on', note:midiNote, velocity:velocity||100, time:now()});
    flashDot();
  }
  function noteOff(midiNote){
    if(!isRecording) return;
    events.push({type:'off', note:midiNote, time:now()});
  }
  function noteOnByName(name, octave, velocity){
    const m=noteNameToMidi(name, octave||4); if(m!==null) noteOn(m, velocity);
  }
  function noteOffByName(name, octave){
    const m=noteNameToMidi(name, octave||4); if(m!==null) noteOff(m);
  }

  // ── Render MIDI events to real WAV via OfflineAudioContext ───────────────
  async function renderToWav(evts, durationMs) {
    const sampleRate = 44100;
    const durationSec = Math.max(durationMs/1000 + 1.5, 2); // extra tail for reverb
    const numCh = 2;
    const ctx = new OfflineAudioContext(numCh, Math.ceil(sampleRate*durationSec), sampleRate);

    // Build note-on/off pairs
    const noteOns = evts.filter(e=>e.type==='on');
    const noteOffs = evts.filter(e=>e.type==='off');

    noteOns.forEach(on => {
      const off = noteOffs.find(o=>o.note===on.note && o.time>on.time);
      const startSec = on.time/1000;
      const endSec   = off ? off.time/1000 : startSec + 0.8;
      const freq     = MIDI_TO_HZ(on.note);
      const vel      = (on.velocity||100)/127 * 0.22;

      // Sine oscillator
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startSec);

      // Envelope: attack 20ms, sustain, release 200ms
      gain.gain.setValueAtTime(0, startSec);
      gain.gain.linearRampToValueAtTime(vel, startSec + 0.02);
      gain.gain.setValueAtTime(vel, endSec);
      gain.gain.linearRampToValueAtTime(0, endSec + 0.2);

      // Slight harmonic richness — add 2nd harmonic quietly
      const osc2  = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq*2, startSec);
      gain2.gain.setValueAtTime(0, startSec);
      gain2.gain.linearRampToValueAtTime(vel*0.3, startSec+0.02);
      gain2.gain.setValueAtTime(vel*0.3, endSec);
      gain2.gain.linearRampToValueAtTime(0, endSec+0.2);

      osc.connect(gain);   gain.connect(ctx.destination);
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc.start(startSec);   osc.stop(endSec+0.3);
      osc2.start(startSec);  osc2.stop(endSec+0.3);
    });

    const audioBuffer = await ctx.startRendering();
    return encodeWav(audioBuffer);
  }

  // ── PCM WAV encoder ───────────────────────────────────────────────────────
  function encodeWav(buf) {
    const numCh=buf.numberOfChannels, sr=buf.sampleRate, len=buf.length;
    const bps=2, block=numCh*bps, dataSize=len*block;
    const ab=new ArrayBuffer(44+dataSize), view=new DataView(ab);
    const ws=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
    ws(0,'RIFF'); view.setUint32(4,36+dataSize,true); ws(8,'WAVE');
    ws(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
    view.setUint16(22,numCh,true); view.setUint32(24,sr,true);
    view.setUint32(28,sr*block,true); view.setUint16(32,block,true);
    view.setUint16(34,16,true); ws(36,'data'); view.setUint32(40,dataSize,true);
    const ch=[];
    for(let c=0;c<numCh;c++) ch.push(buf.getChannelData(c));
    let off=44;
    for(let i=0;i<len;i++){
      for(let c=0;c<numCh;c++){
        const s=Math.max(-1,Math.min(1,ch[c][i]));
        view.setInt16(off,s<0?s*0x8000:s*0x7FFF,true); off+=2;
      }
    }
    return new Blob([ab],{type:'audio/wav'});
  }

  // ── MIDI file builder ─────────────────────────────────────────────────────
  function buildMidiFile(evts,bpm){
    bpm=bpm||120;
    const tpb=480,uspb=Math.round(60000000/bpm);
    // Convert to standard on/off events
    const mevts=evts.map(e=>({
      type:e.type==='on'?0x90:0x80,
      note:e.note,
      velocity:e.type==='on'?(e.velocity||100):0,
      time:e.time
    })).sort((a,b)=>a.time-b.time);
    const td=[];
    const vl=v=>{const b=[];b.push(v&0x7F);v>>=7;while(v>0){b.push((v&0x7F)|0x80);v>>=7;}return b.reverse();};
    const i32=v=>[(v>>24)&0xFF,(v>>16)&0xFF,(v>>8)&0xFF,v&0xFF];
    const i16=v=>[(v>>8)&0xFF,v&0xFF];
    td.push(...vl(0),0xFF,0x51,0x03,(uspb>>16)&0xFF,(uspb>>8)&0xFF,uspb&0xFF);
    let prev=0;
    mevts.forEach(e=>{
      const tick=Math.round((e.time/1000)*(tpb*bpm/60));
      const d=Math.max(0,tick-prev);prev=tick;
      td.push(...vl(d),e.type,e.note&0x7F,e.velocity&0x7F);
    });
    td.push(...vl(0),0xFF,0x2F,0x00);
    return new Uint8Array([0x4D,0x54,0x68,0x64,...i32(6),...i16(0),...i16(1),...i16(tpb),0x4D,0x54,0x72,0x6B,...i32(td.length),...td]);
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────
  function el(id){return document.getElementById(id);}
  function setBtn(id,on){const e=el(id);if(!e)return;e.style.opacity=on?'1':'0.35';e.style.pointerEvents=on?'auto':'none';}
  function fmt(ms){const t=Math.floor(ms/100),s=Math.floor(t/10)%60,m=Math.floor(t/600);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+t%10;}
  function setStatus(msg,color){const s=el('kr-status');if(s){s.textContent=msg;s.style.color=color||'rgba(0,192,192,0.7)';}}

  function flashDot(){
    const d=el('kr-dot'); if(!d)return;
    d.style.background='#00c0c0';
    setTimeout(()=>{if(isRecording)d.style.background='#FF3B3B';},80);
    const c=el('kr-count');
    if(c) c.textContent=events.filter(e=>e.type==='on').length+' notes';
  }

  // ── Transport bar ─────────────────────────────────────────────────────────
  function createTransport(){
    if(el('kcm-recorder-bar'))return;
    const bar=document.createElement('div');
    bar.id='kcm-recorder-bar';
    bar.innerHTML=`<style>
#kcm-recorder-bar{
  position:fixed;bottom:0;left:0;right:0;z-index:99999;
  background:rgba(8,8,20,0.97);
  border-top:2px solid rgba(0,192,192,0.35);
  padding:10px 24px;
  display:flex;align-items:center;justify-content:center;
  gap:10px;flex-wrap:wrap;
  font-family:'Cinzel','Georgia',serif;
  user-select:none;
  box-shadow:0 -4px 30px rgba(0,0,0,0.8);
}
#kcm-recorder-bar .kr-dot{
  width:10px;height:10px;border-radius:50%;
  background:#444;flex-shrink:0;transition:background 0.15s;
}
#kcm-recorder-bar .kr-dot.rec{
  background:#FF3B3B;
  box-shadow:0 0 10px rgba(255,59,59,0.8);
  animation:krpulse 1s ease-in-out infinite;
}
@keyframes krpulse{0%,100%{opacity:1}50%{opacity:0.25}}
#kcm-recorder-bar .kr-time{
  font-family:'Courier New',monospace;font-size:13px;
  color:#F4D03F;min-width:64px;letter-spacing:0.1em;
}
#kcm-recorder-bar .kr-sep{width:1px;height:22px;background:rgba(0,192,192,0.2);flex-shrink:0;}
#kcm-recorder-bar .kr-count{font-size:11px;color:rgba(0,192,192,0.75);min-width:52px;}
#kcm-recorder-bar .kr-status{font-size:10px;min-width:80px;text-align:left;color:rgba(0,192,192,0.6);}
#kcm-recorder-bar button{
  border:1px solid rgba(0,192,192,0.3);background:transparent;
  color:#b0b0cc;border-radius:20px;padding:5px 14px;
  font-family:'Cinzel','Georgia',serif;font-size:11px;
  letter-spacing:0.05em;cursor:pointer;transition:all 0.2s;white-space:nowrap;
}
#kcm-recorder-bar button:hover{color:#fff;border-color:rgba(0,192,192,0.8);background:rgba(0,192,192,0.08);}
#kcm-recorder-bar #kr-rec{border-color:rgba(255,59,59,0.6);color:#FF9090;}
#kcm-recorder-bar #kr-rec.active{border-color:#FF3B3B;color:#fff;background:rgba(255,59,59,0.18);}
#kcm-recorder-bar #kr-play{border-color:rgba(0,255,128,0.5);color:#00FF80;}
#kcm-recorder-bar #kr-wav{border-color:rgba(244,208,63,0.5);color:#F4D03F;}
#kcm-recorder-bar #kr-midi{border-color:rgba(139,107,163,0.5);color:#c8a8e8;}
#kcm-recorder-bar #kr-clear{border-color:rgba(207,122,90,0.4);color:#CF7A5A;}
</style>
<div class="kr-dot" id="kr-dot"></div>
<span class="kr-time" id="kr-time">00:00.0</span>
<div class="kr-sep"></div>
<button id="kr-rec"   onclick="KCMRecorder._rec()">⏺ REC</button>
<button id="kr-stop"  onclick="KCMRecorder._stop()"        style="opacity:0.35;pointer-events:none;">■ STOP</button>
<div class="kr-sep"></div>
<button id="kr-play"  onclick="KCMRecorder._play()"        style="opacity:0.35;pointer-events:none;">▶ PLAY</button>
<button id="kr-wav"   onclick="KCMRecorder._exportWav()"   style="opacity:0.35;pointer-events:none;">⬇ WAV</button>
<button id="kr-midi"  onclick="KCMRecorder._exportMidi()"  style="opacity:0.35;pointer-events:none;">⬇ MIDI</button>
<div class="kr-sep"></div>
<span class="kr-count" id="kr-count">0 notes</span>
<div class="kr-sep"></div>
<button id="kr-clear" onclick="KCMRecorder._clear()"       style="opacity:0.35;pointer-events:none;">✕ CLEAR</button>
<span class="kr-status" id="kr-status"></span>`;
    document.body.appendChild(bar);
    document.body.style.paddingBottom='60px';
  }

  // ── Transport controls ────────────────────────────────────────────────────
  function _rec(){
    if(isRecording){ _stop(); return; }
    events=[]; startTime=performance.now(); isRecording=true;
    timerInterval=setInterval(()=>{const e=el('kr-time');if(e)e.textContent=fmt(now());},100);
    const dot=el('kr-dot'),btn=el('kr-rec');
    if(dot) dot.className='kr-dot rec';
    if(btn){btn.textContent='■ STOP REC';btn.classList.add('active');}
    setBtn('kr-stop',true);setBtn('kr-play',false);setBtn('kr-wav',false);
    setBtn('kr-midi',false);setBtn('kr-clear',false);
    el('kr-count').textContent='0 notes';
    setStatus('● recording','#FF6060');
  }

  function _stop(){
    if(!isRecording)return;
    clearInterval(timerInterval);
    const duration=now(); isRecording=false;
    const hasNotes=events.filter(e=>e.type==='on').length>0;
    const dot=el('kr-dot'),btn=el('kr-rec');
    if(dot){dot.className='kr-dot';dot.style.background='#00c0c0';}
    if(btn){btn.textContent='⏺ REC';btn.classList.remove('active');}
    takes.push({events:events.slice(),duration,wavBlob:null,name:'KCM-Take-'+(takes.length+1)});
    setBtn('kr-stop',false);
    setBtn('kr-play',hasNotes);
    setBtn('kr-wav',hasNotes);
    setBtn('kr-midi',hasNotes);
    setBtn('kr-clear',true);
    el('kr-count').textContent=events.filter(e=>e.type==='on').length+' notes';
    el('kr-time').textContent=fmt(duration);
    setStatus(hasNotes?'ready':'no notes','#00FF80');
  }

  // Play — renders MIDI to audio on the fly via OfflineAudioContext
  async function _play(){
    if(!takes.length)return;
    const take=takes[takes.length-1];
    if(!take.events.length){setStatus('no notes','#FF6060');return;}
    setStatus('rendering...','#F4D03F');
    try{
      const wavBlob=await renderToWav(take.events, take.duration);
      take.wavBlob=wavBlob; // cache it for WAV export
      const url=URL.createObjectURL(wavBlob);
      const audio=new Audio(url);
      setStatus('▶ playing','#00FF80');
      await audio.play();
      audio.onended=()=>{ URL.revokeObjectURL(url); setStatus('done','rgba(0,192,192,0.6)'); };
    }catch(e){
      setStatus('error','#FF6060');
      console.error('[KCMRecorder] Render failed:',e);
    }
  }

  function _clear(){
    takes=[];events=[];
    clearInterval(timerInterval);
    isRecording=false;startTime=null;
    const dot=el('kr-dot'),btn=el('kr-rec');
    if(dot){dot.className='kr-dot';dot.style.background='#444';}
    if(btn){btn.textContent='⏺ REC';btn.classList.remove('active');}
    el('kr-time').textContent='00:00.0';
    el('kr-count').textContent='0 notes';
    setBtn('kr-stop',false);setBtn('kr-play',false);setBtn('kr-wav',false);
    setBtn('kr-midi',false);setBtn('kr-clear',false);
    setStatus('','');
  }

  async function _exportWav(){
    if(!takes.length)return;
    const take=takes[takes.length-1];
    if(!take.events.length){alert('No notes recorded.');return;}
    setStatus('building wav...','#F4D03F');
    try{
      const wavBlob=take.wavBlob||await renderToWav(take.events,take.duration);
      take.wavBlob=wavBlob;
      const url=URL.createObjectURL(wavBlob);
      const a=document.createElement('a');a.href=url;a.download=take.name+'.wav';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      setStatus('⬇ saved!','#00FF80');
    }catch(e){
      setStatus('error','#FF6060');
      console.error('[KCMRecorder] WAV export failed:',e);
    }
  }

  function _exportMidi(bpm){
    if(!takes.length)return;
    const take=takes[takes.length-1];
    if(!take.events.length){alert('No notes recorded.');return;}
    const bytes=buildMidiFile(take.events,bpm||120);
    const blob=new Blob([bytes],{type:'audio/midi'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=take.name+'.mid';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    setStatus('⬇ midi saved','#c8a8e8');
  }

  function init(){
    createTransport();
    console.log('%cKCM Recorder — No mic. No feedback. Real WAV.','color:#00c0c0;font-weight:bold;font-size:13px;');
  }

  global.KCMRecorder={
    init,noteOn,noteOff,noteOnByName,noteOffByName,noteNameToMidi,
    connectSynthOutput,getTakes:()=>takes,getEvents:()=>events,
    renderToWav,
    _rec,_stop,_play,_clear,_exportMidi,_exportWav,
    _toggleRecord:_rec,_rewind:_play
  };
})(window);
