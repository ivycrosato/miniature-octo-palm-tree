// The interface's look (plan Part H.1 and I.4): read at ten feet. Body text 28 px at 1920 x 1080 (2.6% of the window's
// height), headings 44 px and up, rows 64 px, a 5% safe margin, a frost-blue focus glow. No font files: system stacks.
export const THEME = { ink: '#e8eef6', paper: 'rgba(11,18,32,.84)', accent: '#8fd8ff', muted: '#9fb4cc', danger: '#ff6b5a', line: '#2f4766', gold: '#f2b23c', good: '#8fe0a8' };
export const SERIF = 'Georgia, "Times New Roman", serif', SANS = 'system-ui, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';
const CSS = `
.sly{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;color:${THEME.ink};font-family:${SANS};font-size:var(--k,clamp(12px,2.6vh,44px));line-height:1.3;z-index:15;overflow:hidden;-webkit-user-select:none;user-select:none}
.sly *{box-sizing:border-box}
.sly .safe{position:absolute;inset:5% 5% 5% 5%}
.sly .t{font-family:${SERIF};font-variant:small-caps;letter-spacing:.06em}
.sly .muted{color:${THEME.muted}}.sly .gold{color:${THEME.gold}}.sly .bad{color:${THEME.danger}}.sly .good{color:${THEME.good}}
.sly .panel{background:${THEME.paper};border:2px solid ${THEME.line};border-radius:.45em;box-shadow:0 .3em 1.6em rgba(0,0,0,.45)}
/* the HUD */
.sly .compass{position:absolute;left:20%;width:60%;top:4%;height:1.7em;border-radius:.3em;background:linear-gradient(90deg,transparent,rgba(11,18,32,.66) 12%,rgba(11,18,32,.66) 88%,transparent);overflow:hidden}
.sly .compass canvas{width:100%;height:100%;display:block}
.sly .quest{position:absolute;left:20%;width:60%;top:calc(4% + 2em);text-align:center;font-size:.82em;color:${THEME.ink};text-shadow:0 0 .3em #000}
.sly .enemy{position:absolute;left:30%;width:40%;top:calc(4% + 3.6em);text-align:center;font-size:.72em;letter-spacing:.12em}
.sly .enemy .bar{height:.5em;margin-top:.2em}
.sly .boss .bar{height:.8em}.sly .boss{font-size:.9em}
.sly .bar{height:.55em;border-radius:.3em;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18);overflow:hidden;position:relative}
.sly .bar i{position:absolute;left:0;top:0;bottom:0;display:block;border-radius:.3em}
.sly .bar.flash{box-shadow:0 0 .6em ${THEME.danger};border-color:${THEME.danger}}
.sly .bars{position:absolute;left:5%;right:5%;bottom:5%;height:1.2em;transition:opacity .6s}
.sly .bars .mp{position:absolute;left:0;width:24%;bottom:0}.sly .bars .hp{position:absolute;left:33%;width:34%;bottom:0}.sly .bars .sp{position:absolute;right:0;width:24%;bottom:0}
.sly .shout{position:absolute;left:5%;bottom:calc(5% + 1.5em);font-size:.75em;display:flex;gap:.4em;align-items:center;letter-spacing:.1em}
.sly .shout b{display:inline-block;width:.75em;height:.75em;border-radius:50%;border:2px solid ${THEME.accent};}
.sly .shout b.on{background:${THEME.accent};box-shadow:0 0 .5em ${THEME.accent}}
.sly .shout .ring{width:1.3em;height:1.3em;border-radius:50%}
.sly .msgs{position:absolute;left:5%;top:5%;max-width:30%;font-size:.78em;display:flex;flex-direction:column;gap:.25em}
.sly .msgs div{text-shadow:0 0 .3em #000,0 0 .1em #000;transition:opacity .5s}
.sly .banner{position:absolute;left:10%;right:10%;top:30%;text-align:center;font-size:1.65em;text-shadow:0 0 .5em #000;transition:opacity .4s}
.sly .banner small{display:block;font-size:.55em;color:${THEME.muted};font-family:${SANS};font-variant:normal;letter-spacing:.04em}
.sly .cross{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:.4em;height:.4em;border-radius:50%;background:rgba(232,238,246,.85);box-shadow:0 0 .2em #000}
.sly .cross.hand{width:1.1em;height:1.1em;background:none;box-shadow:none;border:3px solid ${THEME.ink};border-radius:.3em .3em .5em .5em}
.sly .cross.steal{border-color:${THEME.danger}}
.sly .eye{position:absolute;left:50%;top:calc(50% - 2.3em);transform:translateX(-50%);width:2.4em;height:1.2em}
.sly .prompt{position:absolute;left:50%;top:60%;transform:translateX(-50%);white-space:nowrap;font-size:.95em;padding:.25em .8em;text-shadow:0 0 .3em #000;display:flex;gap:.5em;align-items:baseline}
.sly .prompt.steal .verb{color:${THEME.danger}}
.sly kbd{display:inline-block;min-width:1.5em;text-align:center;font:700 .8em ${SANS};padding:.05em .4em;border:2px solid ${THEME.accent};border-bottom-width:4px;border-radius:.35em;color:${THEME.accent};background:rgba(11,18,32,.6)}
.sly .corner{position:absolute;right:5%;top:5%;text-align:right;font-size:.85em;line-height:1.5}
.sly .dev{position:absolute;right:5%;bottom:calc(5% + 2em);font:700 .7em ${SANS};color:#ffd36a;border:2px solid #ffd36a;padding:.1em .5em;border-radius:.3em;letter-spacing:.2em}
.sly .center{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);text-align:center;font-size:3em;text-shadow:0 0 .4em #000}
.sly .tut{position:absolute;left:5%;bottom:calc(5% + 4em);max-width:34%;padding:.6em .9em;font-size:.8em}
.sly .tut b{display:block;color:${THEME.accent};font-size:.8em;letter-spacing:.14em;margin-bottom:.2em}
.sly .sub{position:absolute;left:15%;right:15%;bottom:calc(5% + 2.6em);text-align:center;font-size:.85em;text-shadow:0 0 .3em #000,0 0 .2em #000}
.sly .sub b{color:${THEME.gold}}
.sly .ghostname{position:absolute;transform:translate(-50%,-100%);font-size:.6em;font-weight:700;text-shadow:0 0 .3em #000;white-space:nowrap}
/* screens */
.sly.screen{pointer-events:auto;background:radial-gradient(ellipse at center,rgba(11,18,32,.62),rgba(5,8,15,.9));z-index:18}
.sly.screen.clear{background:none}.sly.screen.dim{background:rgba(5,8,15,.45)}
.sly .head{position:absolute;left:5%;right:5%;top:5%;display:flex;align-items:baseline;gap:1em;flex-wrap:wrap}
.sly .head h1{margin:0;font:600 1.6em ${SERIF};font-variant:small-caps;letter-spacing:.08em}
.sly .tabs{display:flex;gap:.3em;align-items:center;flex-wrap:wrap;font-size:.85em}
.sly .tabs span{padding:.15em .6em;border-radius:.3em;color:${THEME.muted};cursor:pointer}
.sly .tabs span.on{color:#0b1220;background:${THEME.accent}}
.sly .body{position:absolute;left:5%;right:5%;top:calc(5% + 2.8em);bottom:calc(5% + 2.6em);display:flex;gap:3%}
.sly .col{flex:1;min-width:0;position:relative;display:flex;flex-direction:column}
.sly .list{flex:1;overflow:hidden;display:flex;flex-direction:column;gap:.15em}
.sly .row{min-height:2.3em;display:flex;align-items:center;gap:.6em;padding:0 .7em;border-radius:.35em;border:2px solid transparent;cursor:pointer;white-space:nowrap;overflow:hidden}
.sly .row .r{margin-inline-start:auto;color:${THEME.muted};font-size:.85em}
.sly .row.focus{border-color:${THEME.accent};background:rgba(143,216,255,.12);box-shadow:0 0 .8em rgba(143,216,255,.35)}
.sly .row.off{opacity:.45}.sly .row.stolen .n::after{content:" ✋";color:${THEME.danger}}
.sly .detail{padding:.8em 1em;flex:1;overflow:hidden}
.sly .detail h2{margin:0 0 .3em;font:600 1.3em ${SERIF};font-variant:small-caps}
.sly .detail p{margin:.4em 0;line-height:1.35;white-space:pre-line}
.sly .stat{display:flex;justify-content:space-between;gap:1em;padding:.15em 0}
.sly .up{color:${THEME.good}}.sly .down{color:${THEME.danger}}
.sly .bar-line{position:absolute;left:5%;right:5%;bottom:5%;display:flex;gap:1.6em;align-items:center;font-size:.85em;flex-wrap:wrap}
.sly .bar-line .act{cursor:pointer;display:flex;gap:.35em;align-items:baseline;pointer-events:auto}
.sly .bar-line .info{margin-inline-end:auto;color:${THEME.muted}}
.sly .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2em;width:min(70%,32em);margin:auto}
.sly .tile{aspect-ratio:1.25;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4em;border-radius:.6em;border:2px solid ${THEME.line};background:${THEME.paper};cursor:pointer;font-family:${SERIF};font-variant:small-caps;letter-spacing:.08em;font-size:1.1em}
.sly .tile.focus{border-color:${THEME.accent};box-shadow:0 0 1em rgba(143,216,255,.45)}
.sly .tile canvas{width:2.6em;height:2.6em}
.sly .title-menu{position:absolute;left:0;right:0;top:46%;display:flex;flex-direction:column;align-items:center;gap:.25em}
.sly .title-menu .row{justify-content:center;min-width:9em;font-size:1.05em}
.sly .logo{position:absolute;left:0;right:0;top:12%;text-align:center}
.sly .logo .name{font:700 4.4em ${SERIF};letter-spacing:.32em;background:linear-gradient(#ffffff,#cfe3f5 55%,#7fa6cf);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 .06em 0 #2f4766) drop-shadow(0 0 .08em #0b1220)}
.sly .logo .tag{font:italic 1.05em ${SERIF};color:${THEME.muted};margin-top:.1em}
.sly .logo img{width:3.6em;height:3.6em}
.sly .version{position:absolute;right:5%;bottom:5%;font-size:.6em;color:${THEME.muted}}
.sly .modal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:min(80%,22em);max-width:90%;padding:1.2em 1.6em}
.sly .modal h2{margin:0 0 .5em;font:600 1.3em ${SERIF};font-variant:small-caps}
.sly .scroll{overflow:hidden;position:relative}
.sly .scroll .inner{position:absolute;left:0;right:0;top:0;transition:transform .15s}
.sly .slider{display:flex;align-items:center;gap:.6em;flex:1;justify-content:flex-end}
.sly .slider .track{width:7em;height:.4em;background:rgba(255,255,255,.18);border-radius:.2em;position:relative}
.sly .slider .track i{position:absolute;left:0;top:0;bottom:0;background:${THEME.accent};border-radius:.2em}
.sly textarea{width:100%;height:6em;font:.6em monospace;background:#05080f;color:${THEME.ink};border:2px solid ${THEME.line};border-radius:.3em;pointer-events:auto}
.sly .book{position:absolute;left:8%;right:8%;top:10%;bottom:14%;display:flex;gap:4%;background:#e8dcc0;color:#2a2018;border-radius:.4em;padding:2.5em 3em;box-shadow:0 0 2em #000}
.sly .book .page{flex:1;font:1em/1.5 ${SERIF};white-space:pre-line}
.sly .book h2{font:600 1.3em ${SERIF};font-variant:small-caps;margin:0 0 .6em}
.sly .dlg{position:absolute;left:12%;right:12%;bottom:12%;padding:1em 1.4em}
.sly .dlg .who{font:600 1.1em ${SERIF};font-variant:small-caps;letter-spacing:.1em;color:${THEME.gold}}
.sly .dlg .say{font-size:1.05em;margin:.3em 0 .6em;min-height:2.6em}
.sly .center-text{text-align:center}
`;
export function injectCss() { if (document.getElementById('sly-css')) return; const st = document.createElement('style'); st.id = 'sly-css'; st.textContent = CSS; document.head.appendChild(st); }
