
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { motion } from 'motion/react';
import { 
  Play, 
  Square, 
  Trash2, 
  Settings2, 
  Music, 
  Clock, 
  Layers, 
  Volume2,
  ChevronRight,
  Maximize2,
  Activity,
  Share2,
  Copy,
  Download,
  Upload,
  X
} from 'lucide-react';
import { NoteData, SynthSettings, SCALES, OCTAVES, WaveformType } from './types';

const INITIAL_STEPS = 16;
const CELL_SIZE = 40;

export default function App() {
  // --- State ---
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

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null);
  const [previewNote, setPreviewNote] = useState<NoteData | null>(null);

  // --- Refs ---
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  // --- Derived Data ---
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

  // --- Audio Setup ---
  useEffect(() => {
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.set({
      oscillator: { type: synthSettings.waveform },
      envelope: {
        attack: synthSettings.attack,
        decay: synthSettings.decay,
        sustain: synthSettings.sustain,
        release: synthSettings.release,
      },
    });
    synth.volume.value = synthSettings.volume;
    synthRef.current = synth;

    return () => {
      synth.dispose();
    };
  }, []);

  // Update synth settings
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

  // BPM Handling
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  // Sequencer Logic
  useEffect(() => {
    if (partRef.current) {
      partRef.current.dispose();
    }

    const scheduledNotes = notes.map((n) => ({
      time: `${n.startStep} * 8n`,
      note: n.pitch,
      duration: `${n.duration} * 8n`,
    }));

    partRef.current = new Tone.Part((time, value) => {
      synthRef.current?.triggerAttackRelease(value.note, value.duration, time);
    }, scheduledNotes).start(0);

    return () => {
      partRef.current?.dispose();
    };
  }, [notes]);

  // Playhead update
  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        // Calculate current 8th note step
        const ticksPerStep = Tone.getTransport().PPQ / 2;
        const step = Math.floor(Tone.getTransport().ticks / ticksPerStep) % steps;
        setCurrentStep(step);
      }, 30);
    } else {
      setCurrentStep(-1);
    }
    return () => clearInterval(interval);
  }, [isPlaying, steps]);

  // keyboard shortcuts
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

  // --- Handlers ---
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState('');

  // --- Handlers ---
  const handleExport = () => {
    const data = {
      notes,
      bpm,
      steps,
      selectedScale,
      synthSettings,
    };
    const code = btoa(JSON.stringify(data));
    setShareCode(code);
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
      alert('Project imported successfully!');
    } catch (e) {
      alert('Invalid share code.');
    }
  };

  const togglePlay = async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    if (isPlaying) {
      Tone.getTransport().stop();
      setIsPlaying(false);
    } else {
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  const handleClear = () => {
    setNotes([]);
  };

  const onCellMouseDown = (r: number, c: number) => {
    const pitch = pitchList[r];
    // Check if clicking on an existing note to delete it
    const existing = notes.find(n => n.pitch === pitch && n.startStep <= c && (n.startStep + n.duration) > c);

    if (existing) {
      setNotes(prev => prev.filter(n => n.id !== existing.id));
      return;
    }

    setIsDragging(true);
    setDragStart({ r, c });
    const newNote: NoteData = {
      id: Math.random().toString(36).substr(2, 9),
      pitch,
      startStep: c,
      duration: 1,
    };
    setPreviewNote(newNote);
    // Play a preview sound
    synthRef.current?.triggerAttackRelease(pitch, '8n');
  };

  const onCellMouseEnter = (r: number, c: number) => {
    if (isDragging && dragStart && r === dragStart.r) {
      const newDuration = Math.max(1, c - dragStart.c + 1);
      setPreviewNote(prev => prev ? { ...prev, duration: newDuration } : null);
    }
  };

  const onGlobalMouseUp = () => {
    if (isDragging && previewNote) {
      setNotes(prev => [...prev, previewNote]);
    }
    setIsDragging(false);
    setDragStart(null);
    setPreviewNote(null);
  };

  useEffect(() => {
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, [isDragging, previewNote]);

  // --- Helpers ---
  const isCellActive = (r: number, c: number) => {
    const pitch = pitchList[r];
    return notes.some(n => n.pitch === pitch && n.startStep <= c && (n.startStep + n.duration) > c);
  };

  const isCellPreview = (r: number, c: number) => {
    if (!previewNote) return false;
    return previewNote.pitch === pitchList[r] && 
           previewNote.startStep <= c && 
           (previewNote.startStep + previewNote.duration) > c;
  };

  const isNoteStart = (r: number, c: number) => {
    const pitch = pitchList[r];
    return notes.some(n => n.pitch === pitch && n.startStep === c) || (previewNote?.pitch === pitch && previewNote.startStep === c);
  };

  return (
    <div className="min-h-screen flex flex-col select-none bg-[#0F0F11] overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-[#18181B] border-b border-zinc-800 shadow-xl z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center">
              <Activity className="w-5 h-5 text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-sky-400 uppercase italic">NEON-PHASE V1</span>
          </div>
          
          <div className="flex items-center gap-4 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800 shadow-inner group transition-all hover:border-zinc-700">
            <div className="flex items-center gap-2">
              <button 
                onClick={togglePlay}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isPlaying ? 'bg-rose-500 text-white shadow-rose-900/40' : 'bg-zinc-800 text-green-500 hover:bg-zinc-700 shadow-black/40'
                }`}
              >
                {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button 
                onClick={handleClear}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                title="Clear All"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="h-4 w-px bg-zinc-700 mx-1"></div>
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-500 font-black uppercase leading-none tracking-widest">Tempo</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-sky-400 font-bold">{bpm.toFixed(2)}</span>
                <input 
                  type="range" 
                  min="40" 
                  max="240" 
                  value={bpm} 
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-16 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-sky-500 hidden sm:block"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Grid</span>
            <select 
              value={steps} 
              onChange={(e) => setSteps(Number(e.target.value))}
              className="bg-transparent border-none text-[10px] font-bold text-zinc-300 cursor-pointer outline-none"
            >
              {[8, 16, 24, 32, 48, 64].map(s => <option key={s} value={s}>{s} Steps</option>)}
            </select>
          </div>

          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Scale</span>
            <select 
              value={selectedScale} 
              onChange={(e) => setSelectedScale(e.target.value as any)}
              className="bg-transparent border-none text-[10px] font-bold text-zinc-300 cursor-pointer outline-none capitalize"
            >
              {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sky-400 rounded-lg border border-zinc-700 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest"
          >
            <Share2 className="w-3 h-3" />
            Share
          </button>

          <button className="px-5 py-2 bg-sky-600 text-white rounded shadow-lg shadow-sky-950/40 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-sky-500 active:scale-95 transition-all">
            Export MIDI
          </button>
        </div>
      </header>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#18181B] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-sky-400">Share Project</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                Copy the code below to share your project, or paste a code to import a new one.
              </p>
              
              <textarea 
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                className="w-full h-32 bg-[#0F0F11] border border-zinc-800 rounded-xl p-4 text-[10px] font-mono text-sky-300 focus:outline-none focus:border-sky-500/50 resize-none custom-scrollbar"
                spellCheck={false}
              />
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareCode);
                    alert('Copied to clipboard!');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Copy className="w-4 h-4" />
                  Copy Code
                </button>
                <button 
                  onClick={handleImport}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Import Code
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Control Panel */}
        <aside className="w-72 bg-[#18181B] p-6 border-r border-zinc-800/50 flex flex-col gap-8 overflow-y-auto">
          <section>
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-1 h-3 bg-sky-500 rounded-full"></span>Oscillator A
            </h3>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {(['sine', 'square', 'sawtooth', 'triangle'] as WaveformType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setSynthSettings(s => ({ ...s, waveform: type }))}
                  className={`
                    py-2.5 rounded border text-[10px] font-bold uppercase transition-all
                    ${synthSettings.waveform === type 
                      ? 'bg-zinc-800 border-sky-500/50 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.1)]' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-1 h-3 bg-pink-500 rounded-full"></span>Envelope
            </h3>
            <div className="space-y-5">
              {[
                { label: 'ATTACK', key: 'attack', min: 0.01, max: 2, step: 0.01 },
                { label: 'DECAY', key: 'decay', min: 0.1, max: 2, step: 0.01 },
                { label: 'SUSTAIN', key: 'sustain', min: 0, max: 1, step: 0.01 },
                { label: 'RELEASE', key: 'release', min: 0.1, max: 5, step: 0.01 },
              ].map(({ label, key, min, max, step }) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between text-[9px] text-zinc-500 font-black tracking-[0.1em]">
                    <span>{label}</span>
                    <span className="text-pink-400 font-mono">{(synthSettings as any)[key]}s</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden relative group">
                    <div 
                      className="absolute top-0 left-0 h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)] transition-all duration-300"
                      style={{ width: `${((synthSettings as any)[key] - min) / (max - min) * 100}%` }}
                    />
                    <input 
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={(synthSettings as any)[key]}
                      onChange={(e) => setSynthSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-auto space-y-6">
            <div className="p-4 bg-sky-500/5 rounded-xl border border-sky-500/10 backdrop-blur-sm">
              <p className="text-[10px] font-medium text-sky-300/80 leading-relaxed text-center">
                Drag notes to extend length. Sequence automatically snaps to high-precision grid.
              </p>
            </div>

            <div className="space-y-2 px-1">
              <div className="flex justify-between text-[9px] font-black text-zinc-500 tracking-[0.2em] mb-1">
                <span>MASTER GAIN</span>
                <span className="text-sky-400">{synthSettings.volume}dB</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden relative">
                 <div 
                  className="absolute top-0 left-0 h-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)] transition-all duration-200"
                  style={{ width: `${(synthSettings.volume + 60) / 60 * 100}%` }}
                />
                <input 
                  type="range"
                  min="-60"
                  max="0"
                  step="1"
                  value={synthSettings.volume}
                  onChange={(e) => setSynthSettings(s => ({ ...s, volume: Number(e.target.value) }))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Sequencer Grid */}
        <div className="flex-1 relative flex overflow-hidden bg-[#0F0F11]">
          {/* Piano Rolls */}
          <div className="w-20 bg-zinc-900 border-r border-zinc-800/50 flex flex-col z-20 shadow-2xl shrink-0">
            {pitchList.map((pitch, r) => {
              const isSharp = pitch.includes('#') || pitch.includes('b');
              return (
                <div 
                  key={pitch} 
                  className={isSharp ? "piano-key-black flex items-center justify-end pr-2 text-[8px] font-black text-slate-500" : "piano-key-white"}
                  style={{ 
                    height: `${CELL_SIZE}px`,
                    width: isSharp ? '80%' : '100%',
                    position: 'relative'
                  }}
                >
                  <span className="truncate">{pitch}</span>
                </div>
              );
            })}
          </div>

          {/* Grid View */}
          <div className="flex-1 grid-bg relative overflow-auto custom-scrollbar">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sky-500/[0.03] to-transparent pointer-events-none"></div>
            
            <div 
              className="relative"
              style={{ 
                height: `${pitchList.length * CELL_SIZE}px`,
                width: `${steps * CELL_SIZE}px`
              }}
            >
              {/* Active Playhead */}
              {currentStep >= 0 && (
                <div 
                  className="absolute top-0 bottom-0 w-px bg-sky-400 z-30 pointer-events-none shadow-[0_0_20px_rgba(56,189,248,0.8)]"
                  style={{ left: `${currentStep * CELL_SIZE}px` }}
                />
              )}

              {/* Step Highlighting in background */}
              {currentStep >= 0 && (
                <div 
                  className="absolute top-0 bottom-0 bg-sky-500/[0.03] z-0 pointer-events-none"
                  style={{ left: `${currentStep * CELL_SIZE}px`, width: CELL_SIZE }}
                />
              )}

              {pitchList.map((pitch, r) => (
                Array.from({ length: steps }).map((_, c) => {
                  const active = isCellActive(r, c);
                  const preview = isCellPreview(r, c);
                  const noteStart = isNoteStart(r, c);

                  return (
                    <div 
                      key={`${r}-${c}`}
                      onMouseDown={() => onCellMouseDown(r, c)}
                      onMouseEnter={() => onCellMouseEnter(r, c)}
                      className={`
                        absolute border-r border-b border-zinc-800/10 cursor-crosshair
                        ${active || preview ? 'z-10' : 'hover:bg-zinc-800/30'}
                      `}
                      style={{ 
                        width: CELL_SIZE, 
                        height: CELL_SIZE,
                        left: c * CELL_SIZE,
                        top: r * CELL_SIZE
                      }}
                    >
                      {(active || preview) && noteStart && (
                        <div 
                          className={`
                            absolute h-[32px] top-1 left-1 rounded-sm border border-white/20 flex items-center px-3 text-[9px] font-black shadow-xl transition-all duration-200
                            ${preview ? 'bg-sky-400/40 opacity-70 border-white/40' : 'bg-sky-500 text-sky-950 shadow-sky-500/20'}
                          `}
                          style={{ 
                            width: (preview ? previewNote!.duration : notes.find(n => n.pitch === pitch && n.startStep === c)!.duration) * CELL_SIZE - 8,
                          }}
                        >
                          <span className="whitespace-nowrap uppercase tracking-widest opacity-80 overflow-hidden">
                            {preview ? 'DRAWING...' : `${synthSettings.waveform.toUpperCase()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="h-10 bg-[#18181B] border-t border-zinc-800 px-6 flex items-center justify-between text-zinc-600 text-[9px] font-black tracking-widest uppercase">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span>DSP ENGINE: TONAL_SYNTH_CORE</span>
          </div>
          <div className="h-3 w-px bg-zinc-800"></div>
          <div>ARRANGEMENT VIEW // PATTERN_01</div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
             <span>CPU</span>
             <div className="w-16 h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="w-[14%] h-full bg-emerald-500 opacity-60"></div>
             </div>
          </div>
          <div className="tabular-nums">LATENCY: 1.2MS</div>
          <div className="text-zinc-700">BUILD: R2026-v4</div>
        </div>
      </footer>
    </div>

  );
}
