<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#008080">
    <title>Interactive Circle of Fifths | Keys, Codes & Modes</title>
    <meta name="description" content="Explore the Circle of Fifths interactively — click any note to hear major and minor triads, play arpeggios and chords. Free visual music theory tool by Benjamin Ryan.">
    <meta name="author" content="Benjamin Ryan">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://keyscodesandmodes.com/apps/circle-of-fifths.html">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Keys, Codes & Modes">
    <meta property="og:title" content="Interactive Circle of Fifths | Keys, Codes & Modes">
    <meta property="og:description" content="Click any note to hear major and minor triads. Play arpeggios and chords around the full Circle of Fifths.">
    <meta property="og:url" content="https://keyscodesandmodes.com/apps/circle-of-fifths.html">
    <meta property="og:image" content="https://keyscodesandmodes.com/images/kcm-social-share.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@keyscodesandmodes">
    <meta name="twitter:title" content="Interactive Circle of Fifths | Keys, Codes & Modes">
    <meta name="twitter:description" content="Click any note to hear major and minor triads. Play arpeggios and chords.">
    <meta name="twitter:image" content="https://keyscodesandmodes.com/images/kcm-social-share.jpg">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Interactive Circle of Fifths","url":"https://keyscodesandmodes.com/apps/circle-of-fifths.html","applicationCategory":"EducationalApplication","isAccessibleForFree":true,"author":{"@type":"Person","name":"Benjamin Ryan","address":{"@type":"PostalAddress","streetAddress":"1187 Coast Village Rd #110","addressLocality":"Santa Barbara","addressRegion":"CA","postalCode":"93108","addressCountry":"US"}}}</script>

    <!-- KCM Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Montserrat:wght@300;400;600;700&display=swap" rel="stylesheet">

    <!-- Cookie Consent -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cookieconsent@3/build/cookieconsent.min.css">
    <script src="https://cdn.jsdelivr.net/npm/cookieconsent@3/build/cookieconsent.min.js"></script>
    <script>
    window.addEventListener('load',function(){
      window.cookieconsent.initialise({
        palette:{popup:{background:"#0a0a15",text:"#E8E8E8"},button:{background:"#008080",text:"#ffffff"}},
        theme:'classic',position:'bottom',
        content:{message:"We use cookies to enhance your experience.",dismiss:"Accept",deny:"Decline",link:"Privacy Policy",href:"/privacy-policy.html"},
        onInitialise:function(s){if(s==='allow')loadAnalytics();},
        onStatusChange:function(s){if(s==='allow')loadAnalytics();}
      });
    });
    function loadAnalytics(){
      if(window._gaLoaded)return;window._gaLoaded=true;
      var s=document.createElement('script');s.async=true;
      s.src='https://www.googletagmanager.com/gtag/js?id=G-6EGC5ZNZPF';
      document.head.appendChild(s);
      window.dataLayer=window.dataLayer||[];
      function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
      gtag('js',new Date());
      gtag('config','G-6EGC5ZNZPF',{'anonymize_ip':true,'allow_google_signals':false,'allow_ad_personalization_signals':false,'cookie_flags':'SameSite=None;Secure'});
    }
    function trackEvent(n,p){if(typeof gtag==='function')gtag('event',n,p);}
    </script>

    <!-- React (no Tone.js — replaced with Web Audio API in Session 5) -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <style>
        /* ══════════════════════════════════
           KCM DESIGN TOKENS
           ══════════════════════════════════ */
        :root {
            --primary-teal:   #008080;
            --primary-gold:   #F4D03F;
            --primary-purple: #8B6BA3;
            --primary-coral:  #CF7A5A;
            --dark-bg:        #0f0f1e;
            --light-text:     #E8E8E8;
            --font-display:   'Cinzel', serif;
            --font-body:      'Montserrat', sans-serif;
        }
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:var(--font-body);background:radial-gradient(ellipse at center,#1a1a2e 0%,#0a0a15 100%);color:var(--light-text);min-height:100vh;}

        /* ── Accessibility ── */
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
        .skip-link{position:absolute;top:-44px;left:0;background:var(--primary-gold);color:#0a0a15;padding:10px 18px;font-weight:700;font-family:var(--font-body);text-decoration:none;z-index:10000;border-radius:0 0 6px 0;}
        .skip-link:focus{top:0;}
        :focus-visible{outline:3px solid var(--primary-gold);outline-offset:3px;}

        /* ══ FIX: No rectangles on SVG circles ══
           Browsers draw a default focus rectangle on ANY focusable element.
           SVG circles must never have tabIndex or role=button.
           We handle clicks only — no keyboard focus on circles. */
        svg circle{outline:none !important;}
        svg *:focus{outline:none !important;}

        /* ══════════════════════════════════
           HEADER (exact APP_HEADER_TEMPLATE)
           ══════════════════════════════════ */
        .app-header{background:linear-gradient(135deg,rgba(15,15,30,0.95),rgba(26,26,46,0.95));backdrop-filter:blur(10px);border-bottom:3px solid var(--primary-teal);padding:1rem 2rem;position:sticky;top:0;z-index:1000;box-shadow:0 4px 20px rgba(0,128,128,0.2);}
        .app-header-content{max-width:1400px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;}
        .app-logo-section{display:flex;align-items:center;gap:1rem;}
        .app-logo-svg{width:50px;height:50px;filter:drop-shadow(0 2px 8px rgba(244,208,63,0.3));transition:transform 0.3s ease;}
        .app-logo-section:hover .app-logo-svg{transform:scale(1.1) rotate(5deg);}
        .app-title{font-family:var(--font-display);font-size:1.5rem;background:linear-gradient(135deg,var(--primary-gold),var(--primary-teal),var(--primary-purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0;line-height:1.2;letter-spacing:2px;}
        .app-nav-links{display:flex;gap:1.5rem;align-items:center;}
        .app-nav-links a{color:var(--light-text);text-decoration:none;font-family:var(--font-body);font-size:1rem;font-weight:500;padding:0.5rem 1rem;border-radius:25px;transition:all 0.3s ease;min-height:44px;display:inline-flex;align-items:center;}
        .app-nav-links a:hover{color:var(--primary-gold);background:rgba(0,128,128,0.1);}
        .upgrade-link{background:linear-gradient(135deg,var(--primary-teal),#006666) !important;color:white !important;padding:0.75rem 1.5rem !important;border-radius:50px;font-weight:700;box-shadow:0 4px 15px rgba(0,128,128,0.3);}
        .upgrade-link:hover{background:linear-gradient(135deg,#006666,var(--primary-teal)) !important;transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,128,128,0.5) !important;}

        #root{width:100%;}

        /* ══════════════════════════════════
           FOOTER (exact APP_FOOTER_TEMPLATE)
           ══════════════════════════════════ */
        .app-footer{background:linear-gradient(135deg,rgba(15,15,30,0.95),rgba(26,26,46,0.95));backdrop-filter:blur(10px);border-top:3px solid var(--primary-teal);padding:2.5rem 2rem 2rem;margin-top:4rem;}
        .app-footer-content{max-width:1400px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:2rem;}
        .app-social-section{display:flex;flex-direction:column;align-items:center;gap:1.5rem;}
        .app-social-title{font-family:var(--font-display);color:var(--primary-gold);font-size:1.3rem;margin:0;letter-spacing:1px;}
        .app-social-links{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;}
        .app-social-links a{width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(0,128,128,0.2),rgba(139,107,163,0.2));border:2px solid rgba(0,128,128,0.3);border-radius:50%;color:var(--primary-gold);transition:all 0.3s ease;backdrop-filter:blur(5px);text-decoration:none;}
        .app-social-links a:hover{background:linear-gradient(135deg,rgba(0,128,128,0.4),rgba(139,107,163,0.4));border-color:var(--primary-teal);transform:translateY(-5px) scale(1.1);box-shadow:0 8px 25px rgba(0,128,128,0.5);}
        .app-social-links svg{width:22px;height:22px;fill:currentColor;}
        .app-footer-divider{width:100%;max-width:600px;height:2px;background:linear-gradient(90deg,transparent,rgba(0,128,128,0.3),transparent);}
        .app-copyright{text-align:center;color:rgba(232,232,232,0.6);font-size:0.95rem;line-height:1.8;}
        .app-copyright strong{color:var(--primary-gold);}
        .app-copyright p{margin:0.5rem 0;}
        .app-legal-links{display:flex;gap:2rem;justify-content:center;flex-wrap:wrap;}
        .app-legal-links a{color:rgba(232,232,232,0.5);text-decoration:none;font-size:0.9rem;transition:color 0.3s ease;min-height:44px;display:inline-flex;align-items:center;}
        .app-legal-links a:hover{color:var(--primary-gold);}

        /* ══════════════════════════════════
           RESPONSIVE
           ══════════════════════════════════ */
        @media(max-width:1023px)and (min-width:768px){.app-title{font-size:1.25rem;}}
        @media(max-width:767px){
            .app-header{padding:1rem;}
            .app-title{font-size:1.1rem;letter-spacing:1px;}
            .app-logo-svg{width:40px;height:40px;}
            .app-nav-links{gap:0.75rem;}
            .app-nav-links a{font-size:0.9rem;padding:0.5rem 0.75rem;}
            .upgrade-link{padding:0.6rem 1rem !important;}
            .app-footer{padding:2rem 1rem 1.5rem;}
            .app-social-links{gap:0.75rem;}
            .app-social-links a{width:45px;height:45px;}
            .app-legal-links{flex-direction:column;gap:0.5rem;text-align:center;}
            .app-copyright{font-size:0.85rem;}
        }
        @media(max-width:479px){
            .app-title{font-size:0.95rem;letter-spacing:0;}
            .app-logo-svg{width:32px;height:32px;}
            .upgrade-link{padding:0.5rem 0.75rem !important;font-size:0.82rem;}
        }
        @media(hover:none)and (pointer:coarse){
            .app-logo-section:hover .app-logo-svg{transform:none;}
            .upgrade-link:hover{transform:none !important;}
            .app-social-links a:hover{transform:none;}
        }
        @media(prefers-reduced-motion:reduce){*{transition-duration:0.01ms !important;animation-duration:0.01ms !important;}}
        @media(forced-colors:active){.upgrade-link{border:2px solid ButtonText;}.app-social-links a{border:2px solid ButtonText;}}
        @media print{.app-header,.app-footer{display:none;}body{background:white;color:black;}}
    </style>
</head>
<body>
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <!-- KCM STANDARD HEADER -->
    <header class="app-header" role="banner">
        <div class="app-header-content">
            <div class="app-logo-section">
                <svg class="app-logo-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                    <circle cx="100" cy="100" r="98" fill="#4A7BA7" stroke="#008080" stroke-width="2"/>
                    <polygon points="100,15 185,185 15,185" fill="#F4D03F" opacity="0.9"/>
                    <polygon points="100,15 15,185 15,55" fill="#8B6BA3" opacity="0.75"/>
                    <polygon points="100,15 185,55 185,185" fill="#6FA5A5" opacity="0.75"/>
                    <polygon points="15,55 100,100 15,185" fill="#CF7A5A" opacity="0.65"/>
                    <polygon points="185,55 100,100 185,185" fill="#9AAF7A" opacity="0.65"/>
                    <polygon points="100,55 145,100 100,145 55,100" fill="#E8D77F" opacity="0.6"/>
                    <circle cx="100" cy="100" r="50" fill="none" stroke="#008080" stroke-width="3"/>
                    <circle cx="100" cy="100" r="7" fill="#F4D03F"/>
                    <line x1="40" y1="40" x2="160" y2="160" stroke="#008080" stroke-width="2" opacity="0.3"/>
                    <line x1="160" y1="40" x2="40" y2="160" stroke="#008080" stroke-width="2" opacity="0.3"/>
                </svg>
                <h1 class="app-title">KEYS, CODES & MODES</h1>
            </div>
            <nav class="app-nav-links" role="navigation" aria-label="App navigation">
                <a href="/index.html">Home</a>
                <a href="../insights.html">All Apps</a>
                <a href="/about.html">About</a>
                <a href="/contact.html">Contact</a>
            </nav>
        </div>
    </header>

    <main id="main-content" role="main" aria-label="Interactive Circle of Fifths music theory tool">
        <div id="root"></div>
    </main>

    <!-- REACT APP — Session 5: Tone.js → Web Audio API + KCM bridge listener -->
    <script type="text/babel">
        const { useState, useEffect, useRef } = React;

        // ── Web Audio helpers ────────────────────────────────────────────────
        // Replaces Tone.js entirely. Uses a shared AudioContext ref.
        // noteToFreq: converts note name + octave → Hz via equal temperament.
        const NOTE_SEMITONES = {
            'C':0,'Db':1,'D':2,'Eb':3,'E':4,'F':5,
            'Gb':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11
        };
        function noteToHz(note, octave = 4) {
            const semi = NOTE_SEMITONES[note];
            if (semi === undefined) return 440;
            // A4 = 440 Hz, MIDI note 69
            const midi = (octave + 1) * 12 + semi;
            return 440 * Math.pow(2, (midi - 69) / 12);
        }

        function playNotes(ctx, notes, octave, duration, delay = 0) {
            // Plays an array of note-name strings simultaneously as sine waves.
            notes.forEach(note => {
                const osc   = ctx.createOscillator();
                const gain  = ctx.createGain();
                const freq  = noteToHz(note, octave);
                osc.type    = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                // Envelope: quick attack, sustain, release
                gain.gain.setValueAtTime(0, ctx.currentTime + delay);
                gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
                gain.gain.setValueAtTime(0.18, ctx.currentTime + delay + duration - 0.1);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + duration);
            });
        }

        // ── Main React component ─────────────────────────────────────────────
        const MusicCircle = () => {
            const [activeNote,     setActiveNote]     = useState(null);
            const [activeType,     setActiveType]     = useState(null);
            const [isPlayingOuter, setIsPlayingOuter] = useState(false);
            const [isPlayingInner, setIsPlayingInner] = useState(false);
            const [startNoteOuter, setStartNoteOuter] = useState('C');
            const [startNoteInner, setStartNoteInner] = useState('A');
            const audioCtxRef = useRef(null);

            // Expose state setters on window so the KCM bridge listener can drive them
            useEffect(() => {
                window._kcmCoF = {
                    setStartNoteOuter,
                    setStartNoteInner,
                    setActiveNote,
                    setActiveType,
                    noteOrder: ['C','G','D','A','E','B','Gb','Db','Ab','Eb','Bb','F']
                };
                return () => { delete window._kcmCoF; };
            }, [setStartNoteOuter, setStartNoteInner]);

            const noteOrder  = ['C','G','D','A','E','B','Gb','Db','Ab','Eb','Bb','F'];
            const noteColors = {
                'C':'#FFFF00','Db':'#FFC400','D':'#FF8000','Eb':'#FF4000',
                'E':'#FF0000','F':'#C4007F','Gb':'#8000FF','G':'#4000FF',
                'Ab':'#0000FF','A':'#007FFF','Bb':'#00FF80','B':'#80FF00'
            };

            // Enharmonic map: KCM bus uses sharps; CoF uses flats for some notes
            const sharpToFlat = {
                'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb'
            };

            function getAudioCtx() {
                if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioCtxRef.current.state === 'suspended') {
                    audioCtxRef.current.resume();
                }
                return audioCtxRef.current;
            }

            // Publish root change to Console bus → all panels follow
            const postToConsole = (patch) => {
                try { window.parent.postMessage({ type: 'KCM_STATE_PATCH', payload: patch }, '*'); }
                catch(e) { /* silent if no parent */ }
            };

            // CoF uses flat notation; KCM bus uses sharps — convert for bus
            const FLAT_TO_SHARP = {
                'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'
            };
            const toSharp = note => FLAT_TO_SHARP[note] || note;

            const getTriad      = root => { const c=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']; const i=c.indexOf(root); return [root, c[(i+4)%12], c[(i+7)%12]]; };
            const getMinorTriad = root => { const c=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']; const i=c.indexOf(root); return [root, c[(i+3)%12], c[(i+7)%12]]; };

            const playTriad = async (note, isMinor = false) => {
                if (isPlayingOuter || isPlayingInner) return;
                const ctx   = getAudioCtx();
                const triad = isMinor ? getMinorTriad(note) : getTriad(note);
                isMinor ? setIsPlayingInner(true) : setIsPlayingOuter(true);
                setActiveNote(note); setActiveType(isMinor ? 'inner' : 'outer');
                playNotes(ctx, triad, 4, 0.9);
                if (typeof trackEvent === 'function') trackEvent('note_click', { event_category:'circle_of_fifths', event_label: note + (isMinor?'_minor':'_major') });
                // Publish to Console bus so MTP and MSP follow
                postToConsole({
                    root: toSharp(note),
                    mode: isMinor ? 'aeolian' : 'ionian'
                });
                await new Promise(r => setTimeout(r, 700));
                setActiveNote(null); setActiveType(null);
                isMinor ? setIsPlayingInner(false) : setIsPlayingOuter(false);
            };

            const playSequence = async (notes, isMinor, arpeggiate) => {
                if (isPlayingOuter || isPlayingInner) return;
                const ctx = getAudioCtx();
                isMinor ? setIsPlayingInner(true) : setIsPlayingOuter(true);
                for (let i = 0; i < notes.length; i++) {
                    const note  = notes[i];
                    const triad = isMinor ? getMinorTriad(note) : getTriad(note);
                    if (arpeggiate) {
                        for (let j = 0; j < triad.length; j++) {
                            playNotes(ctx, [triad[j]], 4, 0.25);
                            setActiveNote(triad[j]); setActiveType(isMinor ? 'inner' : 'outer');
                            await new Promise(r => setTimeout(r, 150));
                        }
                    } else {
                        playNotes(ctx, triad, 4, 0.7);
                        setActiveNote(note); setActiveType(isMinor ? 'inner' : 'outer');
                        await new Promise(r => setTimeout(r, 600));
                    }
                }
                setActiveNote(null); setActiveType(null);
                isMinor ? setIsPlayingInner(false) : setIsPlayingOuter(false);
            };

            const buildSeq  = (base, start) => { const i = base.indexOf(start); return [...base.slice(i), ...base.slice(0,i)]; };
            const outerBase = ['C','G','D','A','E','B','Gb','Db','Ab','Eb','Bb','F'];
            const innerBase = ['A','E','B','Gb','Db','Ab','Eb','Bb','F','C','G','D'];

            const btn = (bg, mb='8px') => ({
                width:'100%', padding:'12px', marginBottom:mb,
                fontSize:'clamp(0.85rem,2.5vw,0.95rem)', fontWeight:'700',
                fontFamily:"'Montserrat',sans-serif",
                background:bg, color:'white', border:'none',
                borderRadius:'50px', cursor:'pointer', minHeight:'48px',
                boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
                transition:'all 0.3s ease', letterSpacing:'0.5px'
            });

            const renderCircle = () => {
                const outerRadius=190, innerRadius=135, cx=250, cy=250, outerR=28, innerR=20;
                return noteOrder.map((note, index) => {
                    const outerAngle = (index*30-90)*(Math.PI/180);
                    const outerX = cx + outerRadius*Math.cos(outerAngle);
                    const outerY = cy + outerRadius*Math.sin(outerAngle);
                    const innerAngle = (index*30-180)*(Math.PI/180);
                    const innerX = cx + innerRadius*Math.cos(innerAngle);
                    const innerY = cy + innerRadius*Math.sin(innerAngle);
                    const isOuterActive = activeNote===note && (activeType==='outer' || activeType==='tick');
                    const isInnerActive = activeNote===note && (activeType==='inner' || activeType==='tick');

                    return React.createElement('g', {key:note},
                        React.createElement('circle', {
                            cx:outerX, cy:outerY, r:outerR,
                            fill:noteColors[note],
                            stroke:isOuterActive?'#F4D03F':'rgba(255,255,255,0.35)',
                            strokeWidth:isOuterActive?4:2,
                            opacity:isOuterActive?1:0.88,
                            style:{cursor:'pointer'},
                            onClick:()=>playTriad(note, false)
                        }),
                        isOuterActive ? React.createElement('circle', {
                            cx:outerX, cy:outerY, r:outerR+7,
                            fill:'none', stroke:'#F4D03F', strokeWidth:2, opacity:0.5,
                            style:{pointerEvents:'none'}
                        }) : null,
                        React.createElement('text', {
                            x:outerX, y:outerY+6, textAnchor:'middle',
                            fontSize:'16', fontWeight:'bold', fill:'#000',
                            style:{pointerEvents:'none', userSelect:'none'}
                        }, note),
                        React.createElement('circle', {
                            cx:innerX, cy:innerY, r:innerR,
                            fill:noteColors[note],
                            stroke:isInnerActive?'#F4D03F':'rgba(255,255,255,0.35)',
                            strokeWidth:isInnerActive?3:1.5,
                            opacity:isInnerActive?1:0.88,
                            style:{cursor:'pointer'},
                            onClick:()=>playTriad(note, true)
                        }),
                        isInnerActive ? React.createElement('circle', {
                            cx:innerX, cy:innerY, r:innerR+6,
                            fill:'none', stroke:'#F4D03F', strokeWidth:2, opacity:0.5,
                            style:{pointerEvents:'none'}
                        }) : null,
                        React.createElement('text', {
                            x:innerX, y:innerY+5, textAnchor:'middle',
                            fontSize:'12', fontWeight:'bold', fill:'#000',
                            style:{pointerEvents:'none', userSelect:'none'}
                        }, note)
                    );
                });
            };

            const card = (borderColor, bgFrom, bgTo) => ({
                background:`linear-gradient(135deg,${bgFrom},${bgTo})`,
                border:`2px solid ${borderColor}`,
                borderRadius:'16px', padding:'1.5rem',
                boxShadow:`0 4px 20px ${borderColor}33`
            });

            return React.createElement('div', {style:{
                background:'radial-gradient(ellipse at center,#1a1a2e 0%,#0a0a15 100%)',
                minHeight:'100vh', padding:'2rem 1rem',
                fontFamily:"'Montserrat',sans-serif"
            }},
                React.createElement('div', {style:{textAlign:'center', marginBottom:'2rem'}},
                    React.createElement('h2', {style:{
                        fontFamily:"'Cinzel',serif",
                        fontSize:'clamp(1.5rem,5vw,2.5rem)',
                        background:'linear-gradient(135deg,#F4D03F,#008080)',
                        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                        backgroundClip:'text', marginBottom:'0.5rem'
                    }}, 'Circle of Fifths'),
                    React.createElement('p', {style:{color:'rgba(232,232,232,0.65)', fontSize:'clamp(0.88rem,2.5vw,1rem)'}},
                        'Outer ring = Major • Inner ring = Minor • Click any note to play instantly')
                ),

                React.createElement('div', {style:{
                    maxWidth:'1100px', margin:'0 auto',
                    display:'grid',
                    gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)',
                    gap:'2rem', alignItems:'start'
                }},
                    React.createElement('div', {style:{display:'flex', justifyContent:'center'}},
                        React.createElement('div', {style:{
                            width:'100%', maxWidth:'520px',
                            background:'linear-gradient(135deg,rgba(0,128,128,0.08),rgba(139,107,163,0.08))',
                            border:'2px solid rgba(0,128,128,0.3)',
                            borderRadius:'20px', padding:'1.5rem',
                            boxShadow:'0 8px 40px rgba(0,128,128,0.15)'
                        }},
                            React.createElement('svg', {
                                viewBox:'0 0 500 500',
                                style:{
                                    width:'100%', height:'auto',
                                    borderRadius:'50%',
                                    background:'radial-gradient(circle,#e8f4fd 0%,#c8dff0 60%,#9bbbd8 100%)',
                                    boxShadow:'0 8px 32px rgba(0,0,0,0.5),inset 0 0 40px rgba(0,128,128,0.08)',
                                    border:'4px solid rgba(0,128,128,0.45)'
                                },
                                role:'img',
                                'aria-label':'Circle of Fifths — click note circles to play chords'
                            },
                                React.createElement('circle', {cx:'250',cy:'250',r:'240',fill:'none',stroke:'rgba(0,128,128,0.3)',strokeWidth:'2'}),
                                React.createElement('circle', {cx:'250',cy:'250',r:'82',fill:'#1a3d5f',stroke:'rgba(0,128,128,0.6)',strokeWidth:'3'}),
                                React.createElement('text', {x:'250',y:'240',textAnchor:'middle',fontSize:'13',fill:'#F4D03F',fontWeight:'bold',fontFamily:'Cinzel,serif'},'Circle of'),
                                React.createElement('text', {x:'250',y:'258',textAnchor:'middle',fontSize:'13',fill:'#F4D03F',fontWeight:'bold',fontFamily:'Cinzel,serif'},'Fifths'),
                                noteOrder.map((note,index) => {
                                    const angle=(index*30-90)*(Math.PI/180);
                                    const x=250+100*Math.cos(angle), y=250+100*Math.sin(angle);
                                    const ks=['♮','1♯','2♯','3♯','4♯','5♯','6♭','5♭','4♭','3♭','2♭','1♭'];
                                    return React.createElement('text', {key:'ks-'+note,x,y:y+4,textAnchor:'middle',fontSize:'10',fontWeight:'bold',fill:'rgba(0,80,80,0.8)'}, ks[index]);
                                }),
                                renderCircle()
                            )
                        )
                    ),

                    React.createElement('div', {style:{display:'flex', flexDirection:'column', gap:'1.5rem'}},
                        React.createElement('div', {style:card('rgba(0,128,128,0.5)','rgba(0,128,128,0.12)','rgba(0,128,128,0.03)')},
                            React.createElement('h3', {style:{fontFamily:"'Cinzel',serif",color:'#F4D03F',fontSize:'1rem',marginBottom:'1rem',textAlign:'center',letterSpacing:'1px'}}, '⬤ OUTER — MAJOR'),
                            React.createElement('label', {htmlFor:'outerSelect',style:{display:'block',color:'rgba(232,232,232,0.65)',fontSize:'0.8rem',marginBottom:'6px',fontWeight:'600'}}, 'Starting Note'),
                            React.createElement('select', {
                                id:'outerSelect', value:startNoteOuter,
                                onChange:(e)=>setStartNoteOuter(e.target.value),
                                style:{width:'100%',padding:'10px',fontSize:'16px',borderRadius:'8px',border:'2px solid rgba(0,128,128,0.5)',background:'#0f1e1e',color:'#F4D03F',fontFamily:"'Montserrat',sans-serif",fontWeight:'600',marginBottom:'12px',cursor:'pointer'}
                            }, noteOrder.map(n=>React.createElement('option',{key:n,value:n},n))),
                            React.createElement('button', {onClick:()=>playSequence(buildSeq(outerBase,startNoteOuter),false,true),  disabled:isPlayingOuter||isPlayingInner, style:btn('linear-gradient(135deg,#008080,#006666)')},  '🎵 Play Arpeggio'),
                            React.createElement('button', {onClick:()=>playSequence(buildSeq(outerBase,startNoteOuter),false,false), disabled:isPlayingOuter||isPlayingInner, style:btn('linear-gradient(135deg,#8B6BA3,#6a5080)','0')}, '🎹 Play Chords')
                        ),

                        React.createElement('div', {style:card('rgba(139,107,163,0.5)','rgba(139,107,163,0.12)','rgba(139,107,163,0.03)')},
                            React.createElement('h3', {style:{fontFamily:"'Cinzel',serif",color:'#8B6BA3',fontSize:'1rem',marginBottom:'1rem',textAlign:'center',letterSpacing:'1px'}}, '◉ INNER — MINOR'),
                            React.createElement('label', {htmlFor:'innerSelect',style:{display:'block',color:'rgba(232,232,232,0.65)',fontSize:'0.8rem',marginBottom:'6px',fontWeight:'600'}}, 'Starting Note'),
                            React.createElement('select', {
                                id:'innerSelect', value:startNoteInner,
                                onChange:(e)=>setStartNoteInner(e.target.value),
                                style:{width:'100%',padding:'10px',fontSize:'16px',borderRadius:'8px',border:'2px solid rgba(139,107,163,0.5)',background:'#150f1e',color:'#8B6BA3',fontFamily:"'Montserrat',sans-serif",fontWeight:'600',marginBottom:'12px',cursor:'pointer'}
                            }, noteOrder.map(n=>React.createElement('option',{key:n,value:n},n))),
                            React.createElement('button', {onClick:()=>playSequence(buildSeq(innerBase,startNoteInner),true,true),  disabled:isPlayingOuter||isPlayingInner, style:btn('linear-gradient(135deg,#8B6BA3,#6a5080)')},  '🎵 Play Arpeggio'),
                            React.createElement('button', {onClick:()=>playSequence(buildSeq(innerBase,startNoteInner),true,false), disabled:isPlayingOuter||isPlayingInner, style:btn('linear-gradient(135deg,#CF7A5A,#a05840)','0')}, '🎹 Play Chords')
                        ),

                        React.createElement('div', {style:{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(0,128,128,0.2)',borderRadius:'12px',padding:'1.25rem',color:'rgba(232,232,232,0.65)',fontSize:'0.83rem',lineHeight:'1.75'}},
                            React.createElement('p', {style:{fontWeight:'700',color:'#F4D03F',marginBottom:'8px',fontFamily:"'Cinzel',serif",fontSize:'0.9rem'}}, '🎓 HOW TO USE'),
                            React.createElement('p', {style:{marginBottom:'5px'}}, 'Click any note on the wheel to hear its chord instantly.'),
                            React.createElement('p', {style:{marginBottom:'5px'}}, 'Outer ring → Major chords'),
                            React.createElement('p', {style:{marginBottom:'5px'}}, 'Inner ring → Minor chords'),
                            React.createElement('p', null, 'Select a starting note then play the full sequence around the circle.')
                        )
                    )
                )
            );
        };

        ReactDOM.render(React.createElement(MusicCircle), document.getElementById('root'));

        // ── KCM Console bridge listener ───────────────────────────────────────
        // Receives KCM_STATE from Console host (bridge.js).
        // Maps bus root (sharp notation) → CoF note (flat notation where needed).
        // Sets startNoteOuter to the root's major key.
        // Sets startNoteInner to the relative minor (root - 3 semitones in CoF order).
        // Added: Session 5 — 2026-04-25
        (function mountKCMListener() {
            // KCM bus uses sharps; CoF uses flats for black keys
            var SHARP_TO_FLAT = {
                'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb'
            };
            // Circle of Fifths order — used to find relative minor
            var COF_ORDER = ['C','G','D','A','E','B','Gb','Db','Ab','Eb','Bb','F'];
            // Relative minor for each major (3 semitones down = 5 positions back in CoF)
            var RELATIVE_MINOR = {
                'C':'A','G':'E','D':'B','A':'Gb','E':'Db','B':'Ab',
                'Gb':'Eb','Db':'Bb','Ab':'F','Eb':'C','Bb':'G','F':'D'
            };

            window.addEventListener('message', function(ev) {
                try {
                    if (!ev.data) return;

                    // ── TICK (master clock beat) ──────────────────────
                    // Fired by bridge.js on every beat — highlight the
                    // wedge/note on the CoF wheel that matches the tick.
                    if (ev.data.type === 'KCM_TICK') {
                        var tk = ev.data.payload;
                        if (!window._kcmCoF) return;

                        // Map MIDI notePC (0-11 chromatic) → CoF flat notation
                        var PC_TO_COF = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
                        var cofNote = PC_TO_COF[tk.notePC];
                        if (!cofNote) return;

                        // Flash the note on the wheel
                        window._kcmCoF.setActiveNote(cofNote);
                        window._kcmCoF.setActiveType('tick');

                        // Clear after 75% of the beat duration so it pulses cleanly
                        var clearAfter = Math.max(tk.beatMs * 0.7, 120);
                        setTimeout(function() {
                            if (window._kcmCoF) {
                                window._kcmCoF.setActiveNote(null);
                                window._kcmCoF.setActiveType(null);
                            }
                        }, clearAfter);
                        return;
                    }

                    // ── TICK STOP ─────────────────────────────────────
                    if (ev.data.type === 'KCM_TICK_STOP') {
                        if (window._kcmCoF) {
                            window._kcmCoF.setActiveNote(null);
                            window._kcmCoF.setActiveType(null);
                        }
                        return;
                    }

                    // ── STOP ALL ─────────────────────────────────────
                    if (ev.data.type === 'KCM_STOP') {
                        if (audioCtxRef && audioCtxRef.current) {
                            audioCtxRef.current.suspend();
                        }
                        if (window._kcmCoF) {
                            window._kcmCoF.setActiveNote(null);
                            window._kcmCoF.setActiveType(null);
                        }
                        console.log('[KCM→CoF] stop received.');
                        return;
                    }

                    if (ev.data.type !== 'KCM_STATE') return;
                    var payload = ev.data.payload;
                    if (!payload || !payload.root) return;

                    // Normalise root to CoF notation (sharps → flats)
                    var root = SHARP_TO_FLAT[payload.root] || payload.root;

                    // Verify root exists in CoF wheel
                    if (COF_ORDER.indexOf(root) === -1) return;

                    // Drive React state via the exposed _kcmCoF handle
                    if (window._kcmCoF) {
                        window._kcmCoF.setStartNoteOuter(root);
                        var relMinor = RELATIVE_MINOR[root];
                        if (relMinor) window._kcmCoF.setStartNoteInner(relMinor);
                        // Flash active note briefly so user sees the update
                        window._kcmCoF.setActiveNote(root);
                        window._kcmCoF.setActiveType('outer');
                        setTimeout(function() {
                            if (window._kcmCoF) {
                                window._kcmCoF.setActiveNote(null);
                                window._kcmCoF.setActiveType(null);
                            }
                        }, 800);
                    }

                    console.log('[KCM→CoF] root=' + payload.root + '→' + root +
                                ' relMinor=' + RELATIVE_MINOR[root]);
                } catch(e) {
                    console.error('[KCM→CoF] listener error:', e);
                }
            });

            console.log('[KCM→CoF] bridge listener ready (circle-of-fifths).');
        })();
        // ── end KCM Console bridge listener ──────────────────────────────────
    </script>
    <!-- KCM STANDARD FOOTER -->
    <footer class="app-footer" role="contentinfo">
        <div class="app-footer-content">
            <div class="app-footer-divider"></div>
            <div class="app-copyright">
                <p>&copy; 2026 <strong>Keys, Codes & Modes™</strong> | Created by <strong>Benjamin Ryan</strong> | All Rights Reserved</p>
                <p>Based on the book <em>"Keys, Codes, and Modes: A Visual Approach to Understanding Music"</em></p>
                <p>1187 Coast Village Rd #110 · Santa Barbara, CA 93108</p>
            </div>
            <div class="app-legal-links">
                <a href="../privacy-policy.html">Privacy Policy</a>
                <a href="/terms.html">Terms of Service</a>
                <a href="/contact.html">Contact Us</a>
            </div>
        </div>
    </footer>
</body>
</html>
