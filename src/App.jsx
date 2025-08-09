import React, { useEffect, useMemo, useRef, useState } from "react";
// Beast mode web build: Greek‑myth chess with 3D pieces, bot, lessons, puzzles, PGN export.
// Stack: React + Tailwind + chess.js + @react-three/fiber + drei. Stockfish (if available) or minimax fallback.

import * as ChessJS from "chess.js";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, AccumulativeShadows, RandomizedLight, Html } from "@react-three/drei";

// ---------- Chess Core
const Chess = typeof ChessJS === "function" ? ChessJS : (ChessJS).Chess;
const FILES = ["a","b","c","d","e","f","g","h"]; const RANKS = [1,2,3,4,5,6,7,8];
const PIECE_VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

function evaluateMaterial(chess) {
  let score = 0; for (const row of chess.board()) for (const sq of row) if (sq) score += sq.color === "w" ? PIECE_VAL[sq.type] : -PIECE_VAL[sq.type];
  return score;
}
function toUci(m){return m.from + m.to + (m.promotion||"")}
function bestMoveMinimax(fen, depth=2){const g=new Chess(fen);let best=null;for(const m of g.moves({verbose:true})){g.move(m);const s=-negamax(g,depth-1,-1);g.undo();if(!best||s>best.s)best={m,s}}return best?.m?toUci(best.m):null}
function negamax(g,d,c){if(d===0||g.isGameOver())return c*evaluateMaterial(g);let best=-1e9;for(const m of g.moves({verbose:true})){g.move(m);const v=-negamax(g,d-1,-c);g.undo();if(v>best)best=v}return best}

// ---------- Stockfish (optional) — will use if present globally or via worker URL
function useStockfish(){
  const ref=useRef(null); const [ready,setReady]=useState(false);
  useEffect(()=>{try{
    if(window.STOCKFISH){const w=window.STOCKFISH(); ref.current=w; boot(w)}
  }catch{} return ()=>ref.current?.terminate()},[]);
  function boot(w){w.onmessage=(e)=>{const s=e.data||""; if(String(s).includes("uciok")) setReady(true)}; w.postMessage("uci"); setTimeout(()=>{w.postMessage("setoption name Threads value 2"); w.postMessage("setoption name Hash value 32"); w.postMessage("isready")},50)}
  function go(fen,ms=600){return new Promise((res)=>{const w=ref.current;if(!w)return res(null);const h=(e)=>{const t=e.data||""; if(String(t).startsWith("bestmove ")){w.removeEventListener("message",h); res(String(t).split(" ")[1]||null)}}; w.addEventListener("message",h); w.postMessage(`position fen ${fen}`); w.postMessage(`go movetime ${ms}`)})}
  return {ready,go}
}

// ---------- Lessons & Puzzles
const LESSONS = [
  { id:"hoplite", title:"Hoplite’s March (Pawns)", startFEN:"8/8/8/8/4P3/8/8/4k2K w - - 0 1", steps:[{hint:"Advance the pawn from e4 to e5.",force:"e4e5"},{hint:"Advance e5 to e6.",force:"e5e6"}]},
  { id:"pegasus", title:"Flight of Pegasus (Knight Basics)", startFEN:"8/8/8/3N4/8/8/8/4k2K w - - 0 1", steps:[{hint:"Knights move in an L. d5→f6",force:"d5f6"},{hint:"Fork the king: f6→g8",force:"f6g8"}]},
  { id:"athena", title:"Blessings of Athena (Queen Power)", startFEN:"8/8/8/8/3Q4/8/8/4k2K w - - 0 1", steps:[{hint:"Centralise the queen: d4→e5",force:"d4e5"},{hint:"Deliver check on e1: e5→e1",force:"e5e1"}]},
  { id:"apollo", title:"Oracles of Apollo (Tactics: Pins & Skewers)", startFEN:"r3k2r/ppp2ppp/2n5/3b4/3B4/2N5/PPP2PPP/R3K2R w KQkq - 0 1", steps:[{hint:"Pin the knight: Bd4→e3 (imagine)",force:"d4e3"}]},
];

const SAMPLE_PUZZLES = [
  { name:"Mate in 2 — Trial of Heracles", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3" },
  { name:"Tactics — Forks", fen:"8/8/3k4/8/2N5/8/5K2/8 w - - 0 1" },
];

// ---------- 3D Materials
function useBronzeMaterial(){
  const ref = useRef();
  useFrame(({clock})=>{ if(ref.current){ ref.current.roughness = 0.45 + 0.05*Math.sin(clock.elapsedTime*0.5); } });
  return (<meshStandardMaterial ref={ref} metalness={0.9} roughness={0.45} color="#996633" />);
}
function useMarbleMaterial(){
  const ref = useRef();
  useFrame(({clock})=>{ if(ref.current){ ref.current.roughness = 0.25 + 0.05*Math.sin(clock.elapsedTime*0.4); } });
  return (<meshStandardMaterial ref={ref} metalness={0.1} roughness={0.28} color="#e7e1d6" />);
}

// ---------- 3D Piece Library
function ZeusKing(props){ const bronze = useBronzeMaterial(); return (
  <group {...props}>
    <mesh castShadow receiveShadow><cylinderGeometry args={[0.5,0.6,1.1,12]} />{bronze}</mesh>
    <mesh castShadow position={[0,0.8,0]}><coneGeometry args={[0.35,0.5,12]} />{bronze}</mesh>
    <mesh castShadow position={[0,1.1,0]}><icosahedronGeometry args={[0.2,0]} />{bronze}</mesh>
  </group>
)}
function AthenaQueen(props){ const bronze = useBronzeMaterial(); return (
  <group {...props}>
    <mesh castShadow><cylinderGeometry args={[0.45,0.55,1.0,12]} />{bronze}</mesh>
    <mesh castShadow position={[0,0.75,0]}><torusGeometry args={[0.25,0.06,8,24]} />{bronze}</mesh>
    <mesh castShadow position={[0.3,0.6,0]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[0.05,0.9,0.05]} />{bronze}</mesh>
    <mesh castShadow position={[-0.3,0.6,0]} rotation={[0,0,-Math.PI/4]}><boxGeometry args={[0.05,0.9,0.05]} />{bronze}</mesh>
  </group>
)}
function PegasusKnight(props){ const bronze = useBronzeMaterial(); return (
  <group {...props}>
    <mesh castShadow><sphereGeometry args={[0.45,16,12]} />{bronze}</mesh>
    <mesh castShadow position={[0.5,0.2,0]} rotation={[0,Math.PI/2,0]}><coneGeometry args={[0.2,0.6,10]} />{bronze}</mesh>
    <mesh castShadow position={[-0.5,0.2,0]} rotation={[0,-Math.PI/2,0]}><coneGeometry args={[0.2,0.6,10]} />{bronze}</mesh>
  </group>
)}
function LyreBishop(props){ const bronze = useBronzeMaterial(); return (
  <group {...props}>
    <mesh castShadow><cylinderGeometry args={[0.4,0.5,1.0,10]} />{bronze}</mesh>
    <mesh castShadow position={[0,0.7,0]}><torusGeometry args={[0.2,0.05,8,20]} />{bronze}</mesh>
  </group>
)}
function TempleRook(props){ const marble = useMarbleMaterial(); const bronze = useBronzeMaterial(); return (
  <group {...props}>
    <mesh castShadow><cylinderGeometry args={[0.5,0.5,0.3,12]} />{bronze}</mesh>
    <mesh castShadow position={[0,0.45,0]}><boxGeometry args={[0.9,0.9,0.9]} />{marble}</mesh>
    <mesh castShadow position={[0,0.95,0]}><boxGeometry args={[1.0,0.2,1.0]} />{bronze}</mesh>
  </group>
)}
function HoplitePawn(props){ const bronze = useBronzeMaterial(); return (
  <group {...props}>
    <mesh castShadow><sphereGeometry args={[0.35,16,12]} />{bronze}</mesh>
    <mesh castShadow position={[0,0.55,0]}><cylinderGeometry args={[0.25,0.3,0.5,10]} />{bronze}</mesh>
  </group>
)}

function MythPiece({ type, color, pos }){
  const y=0.55;
  const common={position:[pos[0],y,pos[2]], scale:[0.8,0.8,0.8]};
  switch(type){
    case 'k': return <ZeusKing {...common} />
    case 'q': return <AthenaQueen {...common} />
    case 'n': return <PegasusKnight {...common} />
    case 'b': return <LyreBishop {...common} />
    case 'r': return <TempleRook {...common} />
    case 'p': return <HoplitePawn {...common} />
    default: return null
  }
}

// ---------- 3D Board
function MythBoard({ chess, orientation, onSquareClick }){
  const squares = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++){
    const file=FILES[c], rank=RANKS[r]; const sq=`${file}${rank}`;
    const x = (orientation==='w'?c:7-c) - 3.5; const z = (orientation==='w'?7-r:r) - 3.5;
    const light = (r+c)%2===0; const piece=chess.get(sq);
    squares.push({sq,x,z,light,piece});
  }
  return (
    <group>
      <mesh receiveShadow position={[0,-0.05,0]}>
        <boxGeometry args={[9.2,0.2,9.2]} />
        <meshStandardMaterial color="#6b4e2e" metalness={0.2} roughness={0.7} />
      </mesh>
      {squares.map(({sq,x,z,light})=> (
        <mesh key={sq} position={[x,0,z]} receiveShadow onClick={(e)=>{e.stopPropagation(); onSquareClick(sq)}}>
          <boxGeometry args={[1,0.06,1]} />
          <meshStandardMaterial color={light?"#e8dcc7":"#8b6a3d"} />
        </mesh>
      ))}
      {squares.filter(s=>s.piece).map(({sq,x,z,piece})=> (
        <MythPiece key={sq} type={piece.type} color={piece.color} pos={[x,0,z]} />
      ))}

      <AccumulativeShadows frames={60} color="#351f0a" opacity={0.6} scale={12} position={[0,0,0]}>
        <RandomizedLight amount={6} radius={6} ambient={0.3} intensity={0.8} position={[5,6,5]} />
      </AccumulativeShadows>
      <Environment preset="sunset" />
    </group>
  )
}

// ---------- UI helpers
function Button({children,onClick,variant='solid',className=''}){
  const base = "px-3 py-2 rounded-xl text-sm font-medium transition";
  const map={solid:"bg-amber-600 text-white hover:bg-amber-700",ghost:"hover:bg-amber-100",outline:"border border-amber-600 text-amber-700 hover:bg-amber-50"}
  return <button onClick={onClick} className={`${base} ${map[variant]} ${className}`}>{children}</button>
}
function Slider({value,min,max,step,onChange}){
  return <input type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))} className="w-full" />
}

// ---------- Main App
export default function App(){
  const [game] = useState(()=>new Chess());
  const [fen,setFen]=useState(game.fen());
  const [mode,setMode]=useState('bot');
  const [orientation,setOrientation]=useState('w');
  const [skill,setSkill]=useState(12);
  const [status,setStatus]=useState("White to move");
  const [lessonIdx,setLessonIdx]=useState(0); const [stepIdx,setStepIdx]=useState(0);
  const [puzzleFEN,setPuzzleFEN]=useState("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3");
  const [use3D,setUse3D]=useState(true);
  const sf=useStockfish();

  useEffect(()=>{updateStatus()},[fen])
  useEffect(()=>{ if(mode==='bot') setTimeout(botTurnIfNeeded,50)},[fen,mode,skill])

  function updateStatus(){
    if(game.isCheckmate()) setStatus('Checkmate');
    else if(game.isDraw()) setStatus('Draw');
    else if(game.isCheck()) setStatus('Check');
    else setStatus(game.turn()==='w'? 'White to move':'Black to move');
  }

  function reset(){ game.reset(); setFen(game.fen()); setStepIdx(0) }

  function clickSquare(sq){
    const piece = game.get(sq);
    if(!window.__sel){ if(piece && piece.color===orientation) (window.__sel=sq); return; }
    const from = window.__sel; const to = sq;
    if(!from){return}
    const mv = game.moves({square:from, verbose:true}).find((m)=>m.to===to);
    if(!mv){ window.__sel = piece && piece.color===orientation ? sq : null; return; }
    const res = game.move({from,to, promotion: 'q'}); if(!res) return; setFen(game.fen());
    window.__sel=null;

    if(mode==='learn'){
      const L=LESSONS[lessonIdx]; const step=L.steps[stepIdx]; const uci=toUci(res);
      if(step?.force && uci!==step.force){ game.undo(); setFen(game.fen()); return; }
      setStepIdx(stepIdx+1);
    }
  }

  async function botTurnIfNeeded(){
    if(mode!=='bot') return; const side=game.turn(); const humanSide=orientation; const botSide = humanSide==='w' ? 'b':'w';
    if(side!==botSide) return; if(game.isGameOver()) return;
    let mv=null; const f=game.fen(); if(sf.ready){ mv = await sf.go(f, Math.min(4000, 400+skill*150)); }
    if(!mv) mv = bestMoveMinimax(f, 3);
    if(mv){ const from=mv.slice(0,2), to=mv.slice(2,4), promo=mv.slice(4,5)||undefined; try{game.move({from,to,promotion:promo}); setFen(game.fen())}catch{}}
  }

  function loadLesson(i){ const L=LESSONS[i]; game.load(L.startFEN); setFen(game.fen()); setLessonIdx(i); setStepIdx(0); setMode('learn') }
  function startPuzzle(f){ game.load(f); setFen(game.fen()); setMode('puzzle') }
  function importPGN(pgn){ try{ game.reset(); game.loadPgn(pgn); setFen(game.fen()); }catch(e){ alert('Invalid PGN') } }
  function downloadPGN(){ const p=game.pgn(); const blob=new Blob([p],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='aegis_game.pgn'; a.click(); URL.revokeObjectURL(url) }

  const statusText = status;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-200 via-amber-100 to-yellow-50 text-stone-900">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold">Aegis</div>
            <div className="text-xl">Greek Myth Chess</div>
            <div className="text-xs ml-2 px-2 py-1 rounded bg-amber-200/70 border border-amber-400">Beast Mode</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={()=>setUse3D(!use3D)}>{use3D? 'Switch to 2D':'Switch to 3D'}</Button>
            <Button variant="outline" onClick={downloadPGN}>Download PGN</Button>
            <Button onClick={()=>window.location.reload()}>Hard Reload</Button>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl border border-amber-300/60 bg-white/60 p-3 md:p-5 shadow-2xl">
            {use3D ? (
              <div className="w-full" style={{aspectRatio:1}}>
                <Canvas shadows camera={{position:[7,8,7], fov:40}}>
                  <directionalLight position={[6,9,6]} castShadow intensity={1.1} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
                  <ambientLight intensity={0.4} />
                  <MythBoard chess={new Chess(fen)} orientation={orientation} onSquareClick={clickSquare} />
                  <OrbitControls maxPolarAngle={Math.PI/2.05} minDistance={7} maxDistance={16} />
                  <Html position={[0,0.2,0]} center>
                    {new Chess(fen).isCheck() && (<div className="px-2 py-1 text-xs rounded bg-red-600 text-white">Check!</div>)}
                  </Html>
                </Canvas>
              </div>
            ) : (
              <Board2D fen={fen} orientation={orientation} onSquareClick={clickSquare} />
            )}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-lg font-medium">{statusText}</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=>reset()}>Reset</Button>
                <Button onClick={()=>setOrientation(orientation==='w'?'b':'w')}>Flip</Button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <Section title="Mode">
              <div className="flex gap-2 flex-wrap">
                <Button variant={mode==='bot'?'solid':'outline'} onClick={()=>{setMode('bot'); reset();}}>Play vs Bot</Button>
                <Button variant={mode==='free'?'solid':'outline'} onClick={()=>{setMode('free'); reset();}}>Free Explore</Button>
                <Button variant={mode==='learn'?'solid':'outline'} onClick={()=>loadLesson(0)}>Learn</Button>
                <Button variant={mode==='puzzle'?'solid':'outline'} onClick={()=>startPuzzle(puzzleFEN)}>Puzzles</Button>
              </div>
            </Section>

            <Section title="Bot Difficulty">
              <div className="text-sm">{skill}</div>
              <Slider value={skill} min={0} max={20} step={1} onChange={(v)=>setSkill(v)} />
              <div className="text-xs text-stone-600 mt-1">Olympian around 18–20.</div>
            </Section>

            <Section title="Lessons">
              {LESSONS.map((L,i)=> (
                <div key={L.id} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <div className="font-medium">{L.title}</div>
                    <div className="text-xs text-stone-500">Steps: {L.steps.length}</div>
                  </div>
                  <Button variant={mode==='learn' && lessonIdx===i? 'solid':'outline'} onClick={()=>loadLesson(i)}>Start</Button>
                </div>
              ))}
              {mode==='learn' && (
                <div className="mt-2 p-2 rounded bg-amber-50 border text-sm">
                  {LESSONS[lessonIdx].steps[stepIdx]?.hint || "Lesson complete — Athena smiles upon you."}
                </div>
              )}
            </Section>

            <Section title="Puzzles (import FEN/PGN)">
              <div className="space-y-2">
                <select className="w-full border rounded p-2" value={puzzleFEN} onChange={(e)=>setPuzzleFEN(e.target.value)}>
                  {SAMPLE_PUZZLES.map(p=>(<option key={p.name} value={p.fen}>{p.name}</option>))}
                </select>
                <Button onClick={()=>startPuzzle(puzzleFEN)}>Load FEN</Button>
                <textarea placeholder="Paste PGN here" className="w-full border rounded p-2 h-28" id="pgnbox"></textarea>
                <div className="flex gap-2">
                  <Button onClick={()=>importPGN((document.getElementById('pgnbox')).value)}>Import PGN</Button>
                  <Button variant="outline" onClick={downloadPGN}>Download Current PGN</Button>
                </div>
              </div>
            </Section>

            <Section title="Theme (Olympus UI)">
              <div className="text-sm text-stone-700">3D bronze & marble pieces, marble board, sunset HDRI. Fully Greek‑myth aesthetic. More detailed sculpt meshes can be swapped in later.</div>
            </Section>

            <Section title="Deploy (Vite → Netlify/Vercel)">
              <ol className="list-decimal ml-5 text-sm space-y-1">
                <li>Create Vite app (already done here)</li>
                <li>Install deps: <code>npm install</code></li>
                <li>Run dev: <code>npm run dev</code> • Build: <code>npm run build</code></li>
                <li>Deploy the <code>dist/</code> folder to Netlify/Vercel.</li>
              </ol>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({title, children}){
  return (
    <div className="p-4 rounded-2xl border bg-white/70 shadow">
      <div className="text-xs uppercase tracking-wide text-stone-600 mb-2">{title}</div>
      {children}
    </div>
  )
}

// ---------- 2D Board fallback
function Board2D({ fen, orientation, onSquareClick }){
  const g = useMemo(()=>new Chess(fen),[fen]);
  const order = [];
  for(let r=8;r>=1;r--) for(let c=0;c<8;c++) order.push(`${FILES[c]}${r}`);
  const view = orientation==='w'? order : [...order].reverse();
  return (
    <div className="relative">
      <div className="grid grid-cols-8 rounded-2xl overflow-hidden shadow-2xl border border-amber-300" style={{aspectRatio:1}}>
        {view.map((sq,i)=>{
          const p=g.get(sq); const light=((Math.floor(i/8)+i)%2)===0;
          return (
            <div key={sq} onClick={()=>onSquareClick(sq)} className={`relative flex items-center justify-center text-3xl cursor-pointer select-none ${light? 'bg-[#e8dcc7]':'bg-[#8b6a3d] text-white'}`}>
              <span>{glyphFor(p)}</span>
              <div className={`absolute bottom-1 left-1 text-[10px] ${light? 'text-stone-700':'text-amber-100'}`}>{sq}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function glyphFor(p){ if(!p) return ""; const map={p:"🛡️",n:"🐎",b:"🎶",r:"🏛️",q:"👑",k:"⚡️"}; const g=map[p.type]; return g }
