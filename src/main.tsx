import React, { useState, useEffect, useRef, useMemo, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Tone from 'tone';
import { motion } from 'motion/react';
import { 
  Play, 
  Square, 
  Trash2, 
  Music, 
  Clock, 
  Volume2,
  Activity,
  Share2,
  Copy,
  Download,
  Upload,
  X
} from 'lucide-react';
import './index.css';

// --- Types & Constants ---
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface NoteData {
  id: string;
  pitch: string;
  startStep: number;
  duration: number;
}

export interface SynthSettings {
  waveform: WaveformType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
}

export const SCALES = {
  chromatic: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  major: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  minor: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  pentatonic: ['C', 'D', 'E', 'G', 'A'],
};

export const OCTAVES = [5, 4, 3];
const INITIAL_STEPS = 16;
const CELL_SIZE = 40;

// --- Main App Component ---
function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [currentStep, setCurrentStep] = useState(-1);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [selectedScale, setSelectedScale] = useState<keyof typeof SCALES>('major');
  const [synthSettings, setSynthSettings] = useState<SynthSettings>({
    waveform: 'sawtooth',
    attack: 0.05,
    decay: 0.2,
    sustain: 0.3,
    release: 0.8,
    volume: -12,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null);
  const [previewNote, setPreviewNote] = useState<NoteData | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState('');

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  const pitchList = useMemo(() => {
    const scale = SCALES[selectedScale];
    const allPitches: string[] = [];
    OCTAVES.forEach((oct) => {
      [...scale].reverse().forEach((note) => {
        allPitches.push(`${note}${oct}`);
      });
    });
    return allPitches;
  }, [selectedScale]);

  useEffect(() => {
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.volume.value = synthSettings.volume;
    synthRef.current = synth;
    return () => { synth.dispose(); };
  }, []);

  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.set({
        oscillator: { type: synthSettings.waveform },
        envelope: {
          attack: synthSettings.attack,
          decay: synthSettings.decay,
          sustain: synthSettings.sustain,
          release: synthSettings.release,
        },
      });
      synthRef.current.volume.value = synthSettings.volume;
    }
  }, [synthSettings]);

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (partRef.current) partRef.current.dispose();
    const scheduledNotes = notes.map((n) => ({
      time: `${n.startStep} * 8n`,
      note: n.pitch,
      duration: `${n.duration} * 8n`,
    }));
    partRef.current = new Tone.Part((time, value) => {
      synthRef.current?.triggerAttackRelease(value.note, value.duration, time);
    }, scheduledNotes).start(0);
    return () => { partRef.current?.dispose(); };
  }, [notes]);

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        const ticksPerStep = Tone.getTransport().PPQ / 2;
        const step = Math.floor(Tone.getTransport().ticks / ticksPerStep) % steps;
        setCurrentStep(step);
      }, 30);
    } else {
      setCurrentStep(-1);
    }
    return () => clearInterval(interval);
  }, [isPlaying, steps]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    const hashData = window.location.hash.replace('#', '');
    if (hashData) {
      try {
        const decoded = JSON.parse(atob(hashData));
        if (decoded.notes) setNotes(decoded.notes);
        if (decoded.bpm) setBpm(decoded.bpm);
        if (decoded.steps) setSteps(decoded.steps);
        if (decoded.selectedScale) setSelectedScale(decoded.selectedScale);
        if (decoded.synthSettings) setSynthSettings(decoded.synthSettings);
      } catch (e) {
        console.error('Failed to load project from URL');
      }
    }
  }, []);

  const handleExport = () => {
    const data = { notes, bpm, steps, selectedScale, synthSettings };
    const code = btoa(JSON.stringify(data));
    setShareCode(code);
    window.location.hash = code;
    setShowShareModal(true);
  };

  const handleImport = () => {
    try {
      const decoded = JSON.parse(atob(shareCode));
      if (decoded.notes) setNotes(decoded.notes);
      if (decoded.bpm) setBpm(decoded.bpm);
      if (decoded.steps) setSteps(decoded.steps);
      if (decoded.selectedScale) setSelectedScale(decoded.selectedScale);
      if (decoded.synthSettings) setSynthSettings(decoded.synthSettings);
      setShowShareModal(false);
    } catch (e) { alert('Invalid code'); }
  };

  const downloadProject = () => {
    const data = { notes, bpm, steps, selectedScale, synthSettings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neongrid-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePlay = async () => {
    if (Tone.getContext().state !== 'running') await Tone.start();
    if (isPlaying) {
      Tone.getTransport().stop();
      setIsPlaying(false);
    } else {
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  const onCellMouseDown = (r: number, c: number) => {
    const pitch = pitchList[r];
    const existing = notes.find(n => n.pitch === pitch && n.startStep <= c && (n.startStep + n.duration) > c);
    if (existing) {
      setNotes(prev => prev.filter(n => n.id !== existing.id));
      return;
    }
    setIsDragging(true);
    setDragStart({ r, c });
    const newNote: NoteData = { id: Math.random().toString(36).substr(2, 9), pitch, startStep: c, duration: 1 };
    setPreviewNote(newNote);
    synthRef.current?.triggerAttackRelease(pitch, '8n');
  };

  const onCellMouseEnter = (r: number, c: number) => {
    if (isDragging && dragStart && r === dragStart.r) {
      const newDuration = Math.max(1, c - dragStart.c + 1);
      setPreviewNote(prev => prev ? { ...prev, duration: newDuration } : null);
    }
  };

  useEffect(() => {
    const onGlobalMouseUp = () => {
      if (isDragging && previewNote) setNotes(prev => [...prev, previewNote]);
      setIsDragging(false);
      setDragStart(null);
      setPreviewNote(null);
    };
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, [isDragging, previewNote]);

  const isCellActive = (r: number, c: number) => {
    const pitch = pitchList[r];
    return notes.some(n => n.pitch === pitch && n.startStep <= c && (n.startStep + n.duration) > c);
  };

  const isCellPreview = (r: number, c: number) => {
    if (!previewNote) return false;
    return previewNote.pitch === pitchList[r] && previewNote.startStep <= c && (previewNote.startStep + previewNote.duration) > c;
  };

  const isNoteStart = (r: number, c: number) => {
    const pitch = pitchList[r];
    return notes.some(n => n.pitch === pitch && n.startStep === c) || (previewNote?.pitch === pitch && previewNote.startStep === c);
  };

  return (
    <div className="min-h-screen flex flex-col select-none bg-[#0F0F11] overflow-hidden">
      <header className="h-16 flex items-center justify-between px-6 bg-[#18181B] border-b border-zinc-800 shadow-xl z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center">
              <Activity className="w-5 h-5 text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-sky-400 uppercase italic">NEON-PHASE V1</span>
          </div>
          <div className="flex items-center gap-4 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
            <button onClick={togglePlay} className={`w-8 h-8 rounded-full flex items-center justify-center ${isPlaying ? 'bg-rose-500' : 'bg-zinc-800 text-green-500'}`}>
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button onClick={() => setNotes([])} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"><Trash2 className="w-4 h-4" /></button>
            <div className="h-4 w-px bg-zinc-700"></div>
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-500 uppercase font-black">Tempo</span>
              <span className="text-sm font-mono text-sky-400">{bpm} BPM</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleExport} className="px-4 py-2 bg-zinc-800 text-sky-400 rounded-lg border border-zinc-700 text-[10px] uppercase font-black tracking-widest">Share</button>
        </div>
      </header>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#18181B] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black uppercase text-sky-400">Share Project</h3>
              <X className="cursor-pointer" onClick={()=>setShowShareModal(false)} />
            </div>
            <textarea value={shareCode} onChange={(e)=>setShareCode(e.target.value)} className="w-full h-32 bg-[#0F0F11] border border-zinc-800 rounded p-4 text-[10px] text-sky-300 font-mono mb-4" />
            <div className="flex gap-2">
              <button onClick={()=>{navigator.clipboard.writeText(window.location.href); alert('URL Copied');}} className="flex-1 py-3 bg-zinc-800 text-sky-400 rounded-xl text-[10px] font-black uppercase tracking-widest">Copy URL</button>
              <button onClick={handleImport} className="flex-1 py-3 bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Import Code</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-[#18181B] p-6 border-r border-zinc-800/50 flex flex-col gap-6 overflow-y-auto">
          <section>
            <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-2">Engine</h3>
            <div className="grid grid-cols-2 gap-2">
              {['sine', 'square', 'sawtooth', 'triangle'].map(type => (
                <button
                  key={type}
                  onClick={() => setSynthSettings(s => ({ ...s, waveform: type as WaveformType }))}
                  className={`py-2 rounded border text-[10px] font-black uppercase ${synthSettings.waveform === type ? 'border-sky-500 text-sky-400 bg-zinc-800' : 'border-zinc-800 text-zinc-500'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-4">
             <h3 className="text-[10px] font-black uppercase text-zinc-500">Envelope</h3>
             {['attack', 'decay', 'sustain', 'release'].map(key => (
               <div key={key} className="space-y-1">
                 <div className="flex justify-between text-[8px] text-zinc-500"><span>{key.toUpperCase()}</span><span>{(synthSettings as any)[key]}s</span></div>
                 <input type="range" min={0} max={key==='release'?5:2} step="0.01" value={(synthSettings as any)[key]} onChange={(e)=>setSynthSettings(s=>({...s, [key]: Number(e.target.value)}))} className="w-full h-1 bg-zinc-800 accent-sky-500 rounded appearance-none" />
               </div>
             ))}
          </section>
        </aside>

        <div className="flex-1 relative flex overflow-hidden bg-[#0F0F11]">
          <div className="w-16 bg-zinc-900 border-r border-zinc-800 shrink-0">
            {pitchList.map(pitch => {
              const isSharp = pitch.includes('#') || pitch.includes('b');
              return (
                <div key={pitch} className={isSharp ? "bg-[#1E293B] text-[8px] text-slate-500 flex items-center justify-end pr-2" : "bg-[#E2E8F0] text-[#475569] text-[9px] font-bold flex items-center justify-end pr-2"} style={{ height: CELL_SIZE }}>
                  {pitch}
                </div>
              );
            })}
          </div>
          <div className="flex-1 grid-bg overflow-auto">
            <div className="relative" style={{ height: pitchList.length * CELL_SIZE, width: steps * CELL_SIZE }}>
              {currentStep >= 0 && <div className="absolute top-0 bottom-0 w-px bg-sky-400 z-30" style={{ left: currentStep * CELL_SIZE }} />}
              {pitchList.map((pitch, r) => {
                const isSharp = pitch.includes('#') || pitch.includes('b');
                return Array.from({ length: steps }).map((_, c) => {
                  const active = isCellActive(r, c);
                  const preview = isCellPreview(r, c);
                  const noteStart = isNoteStart(r, c);
                  return (
                    <div 
                      key={`${r}-${c}`} 
                      onMouseDown={()=>onCellMouseDown(r, c)} 
                      onMouseEnter={()=>onCellMouseEnter(r, c)}
                      className={`absolute border-r border-b border-zinc-800/10 cursor-crosshair ${isSharp ? 'bg-zinc-950/40' : ''} ${active || preview ? 'z-10 bg-sky-500/20' : 'hover:bg-zinc-800/30'}`}
                      style={{ width: CELL_SIZE, height: CELL_SIZE, left: c * CELL_SIZE, top: r * CELL_SIZE }}
                    >
                      {(active || preview) && noteStart && (
                        <div className={`absolute top-1 left-1 bottom-1 rounded border ${preview ? 'bg-sky-400/30' : 'bg-sky-500 shadow-lg shadow-sky-500/20'}`} style={{ width: (preview ? previewNote!.duration : notes.find(n=>n.pitch===pitch && n.startStep===c)!.duration) * CELL_SIZE - 4 }} />
                      )}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Render ---
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
