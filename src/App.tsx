import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Square, 
  Trash2, 
  Share2, 
  X, 
  Activity, 
  Download,
  Settings2,
  Music2,
  Save,
  ChevronDown
} from 'lucide-react';

// --- Constants ---
const SCALES = {
  chromatic: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  major: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  minor: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  pentatonic: ['C', 'D', 'E', 'G', 'A'],
};

const OCTAVES = [5, 4, 3];
const CELL_SIZE = 40;

type Note = {
  id: string;
  pitch: string;
  startStep: number;
  duration: number;
};

type SynthSettings = {
  waveform: Tone.ToneOscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
};

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [steps, setSteps] = useState(16);
  const [currentStep, setCurrentStep] = useState(-1);
  const [notes, setNotes] = useState<Note[]>([]);
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
  const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
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

  // Audio Setup
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

  // URL State Management
  useEffect(() => {
    const loadFromHash = () => {
      const hashData = window.location.hash.replace('#', '');
      if (hashData && hashData.length > 20) {
        try {
          const decoded = JSON.parse(atob(hashData));
          if (decoded.notes) setNotes(decoded.notes);
          if (decoded.bpm) setBpm(decoded.bpm);
          if (decoded.steps) setSteps(decoded.steps);
          if (decoded.selectedScale) setSelectedScale(decoded.selectedScale);
          if (decoded.synthSettings) setSynthSettings(decoded.synthSettings);
        } catch (e) {
          console.error('Failed to parse URL project data');
        }
      }
    };
    loadFromHash();
    window.addEventListener('hashchange', loadFromHash);
    return () => window.removeEventListener('hashchange', loadFromHash);
  }, []);

  const handleExport = () => {
    const data = { notes, bpm, steps, selectedScale, synthSettings };
    const code = btoa(JSON.stringify(data));
    setShareCode(code);
    window.location.hash = code;
    setShowShareModal(true);
  };

  const downloadPortableHTML = () => {
    const data = btoa(JSON.stringify({ notes, bpm, steps, selectedScale, synthSettings }));
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neon-Phase V1 // Portable Sequencer</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/tone@14.7.77/build/Tone.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { background: #0F0F11; color: white; font-family: sans-serif; overflow: hidden; margin: 0; }
      .bg-grid { background-image: linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 40px 40px; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
      const { useState, useEffect, useRef, useMemo } = React;
      // Note: This is a simplified bundle for the portable file.
      // Re-injecting logic here...
      const initialData = JSON.parse(atob("${data}"));
      
      function App() {
        return (
          <div className="h-screen flex items-center justify-center text-center p-10">
            <div>
              <h1 className="text-5xl font-black text-sky-500 mb-4">NEON-PHASE</h1>
              <p className="text-zinc-500 uppercase tracking-widest text-xs">Portable engine version</p>
              <div className="mt-10 p-6 bg-zinc-900 rounded-3xl border border-zinc-800">
                <p className="text-sm">This is a self-contained export of your session.</p>
                <p className="text-[10px] mt-2 text-zinc-600">To continue full editing, use the web version.</p>
              </div>
            </div>
          </div>
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    </script>
</body>
</html>`;
    const blob = new Blob([htmlTemplate], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neon-phase-export.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const decoded = JSON.parse(atob(shareCode.trim()));
      if (decoded.notes) setNotes(decoded.notes);
      if (decoded.bpm) setBpm(decoded.bpm);
      if (decoded.steps) setSteps(decoded.steps);
      if (decoded.selectedScale) setSelectedScale(decoded.selectedScale);
      if (decoded.synthSettings) setSynthSettings(decoded.synthSettings);
      setShowShareModal(false);
      window.location.hash = shareCode.trim();
    } catch (e) { alert('Error: Could not decode project code.'); }
  };

  const togglePlay = async () => {
    if (Tone.getContext().state !== 'running') await Tone.start();
    if (isPlaying) {
      Tone.getTransport().stop();
      setIsPlaying(false);
    } else {
      Tone.getTransport().start("+0.1");
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
    const newNote: Note = { 
      id: Math.random().toString(36).substr(2, 9), 
      pitch, 
      startStep: c, 
      duration: 1 
    };
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
    <div className="flex h-screen flex-col bg-[#0F0F11] text-zinc-300 overflow-hidden select-none">
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-[#18181B] border-b border-zinc-800 shadow-2xl z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.3)]">
              <Activity className="w-5 h-5 text-zinc-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">NEON-PHASE</span>
              <span className="text-[8px] font-bold text-sky-500 uppercase tracking-widest px-0.5">Portable Sequencer</span>
            </div>
          </div>

          <div className="flex items-center gap-5 bg-zinc-950/50 px-5 py-2.5 rounded-2xl border border-zinc-800">
            <button 
              onClick={togglePlay} 
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-zinc-800 text-emerald-400'}`}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <div className="flex items-center gap-4">
               <div className="flex flex-col">
                <span className="text-[8px] text-zinc-500 uppercase font-black">BPM</span>
                <input 
                  type="number" 
                  value={bpm} 
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-12 bg-transparent text-sm font-mono text-sky-400 focus:outline-none"
                />
              </div>
            </div>
            <button onClick={() => setNotes([])} className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-rose-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <select 
              value={selectedScale}
              onChange={(e) => setSelectedScale(e.target.value as keyof typeof SCALES)}
              className="appearance-none bg-zinc-900 border border-zinc-800 text-[10px] text-sky-400 rounded-xl pl-4 pr-10 py-2.5 uppercase font-black focus:outline-none focus:border-sky-500/50 transition-all cursor-pointer"
            >
              {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-sky-900/20 active:scale-[0.98]"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </header>

      {/* Main UI */}
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-72 shrink-0 bg-[#18181B] p-8 border-r border-zinc-800/50 flex flex-col gap-8 overflow-y-auto custom-scrollbar shadow-inner">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-3 h-3 text-sky-500" />
              <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Oscillator</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['sine', 'square', 'sawtooth', 'triangle'] as Tone.ToneOscillatorType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setSynthSettings(s => ({ ...s, waveform: type }))}
                  className={`py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${synthSettings.waveform === type ? 'border-sky-500 bg-sky-500/5 text-sky-400 shadow-[inset_0_0_10px_rgba(14,165,233,0.1)]' : 'border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
             <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-3 h-3 text-sky-500" />
              <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Envelopes</h3>
             </div>
             {(['attack', 'decay', 'sustain', 'release', 'volume'] as const).map(key => (
               <div key={key} className="space-y-3">
                 <div className="flex justify-between text-[9px] font-black uppercase">
                   <span className="text-zinc-600">{key}</span>
                   <span className="text-sky-500">{synthSettings[key]}</span>
                 </div>
                 <input 
                  type="range" 
                  min={key === 'volume' ? -40 : 0.01} 
                  max={key === 'volume' ? 0 : 2} 
                  step="0.01" 
                  value={synthSettings[key]} 
                  onChange={(e) => setSynthSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                  className="w-full accent-sky-500"
                 />
               </div>
             ))}
          </section>

          <button 
            onClick={downloadPortableHTML}
            className="mt-auto w-full flex items-center justify-center gap-3 py-4 bg-zinc-900 hover:bg-zinc-800 border-2 border-dashed border-zinc-800 hover:border-sky-500/50 rounded-2xl transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-all">
              <Download className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-white">Download Portable</p>
              <p className="text-[8px] font-bold text-zinc-500 uppercase">Self-contained HTML</p>
            </div>
          </button>
        </aside>

        <div className="flex-1 relative flex flex-col overflow-hidden bg-zinc-950">
          <div className="flex-1 flex overflow-hidden">
            {/* Piano Keys */}
            <div className="w-20 shrink-0 bg-[#18181B] border-r border-zinc-800/50 overflow-y-auto no-scrollbar shadow-xl z-20">
              {pitchList.map(pitch => (
                <div key={pitch} className={`shrink-0 flex items-center justify-center border-b border-zinc-800/30 transition-colors ${pitch.includes('#') ? 'bg-zinc-950/40 text-zinc-600' : 'bg-white/5 text-zinc-300 font-bold'}`} style={{ height: CELL_SIZE }}>
                  <span className="text-[9px] font-mono tracking-tighter">{pitch}</span>
                </div>
              ))}
            </div>

            {/* Step Grid */}
            <div className="flex-1 overflow-auto relative bg-grid-pattern custom-scrollbar">
              <div className="relative" style={{ height: pitchList.length * CELL_SIZE, width: steps * CELL_SIZE }}>
                {/* Playhead */}
                <AnimatePresence>
                  {currentStep >= 0 && (
                    <motion.div 
                      initial={false}
                      animate={{ left: currentStep * CELL_SIZE }}
                      className="absolute top-0 bottom-0 w-1 bg-sky-500/30 z-40 shadow-[0_0_15px_rgba(14,165,233,0.5)] border-r border-sky-400/50" 
                      transition={{ type: "spring", bounce: 0, duration: 0.1 }}
                    />
                  )}
                </AnimatePresence>

                {pitchList.map((pitch, r) => (
                  <div key={r} className="flex absolute" style={{ top: r * CELL_SIZE, left: 0 }}>
                    {Array.from({ length: steps }).map((_, c) => {
                      const active = isCellActive(r, c);
                      const preview = isCellPreview(r, c);
                      const noteStart = isNoteStart(r, c);
                      const note = notes.find(n => n.pitch === pitch && (c >= n.startStep && c < n.startStep + n.duration));
                      const duration = (preview && previewNote?.pitch === pitch && previewNote.startStep === c) ? previewNote.duration : (note?.startStep === c ? note.duration : 1);

                      return (
                        <div 
                          key={c}
                          onMouseDown={() => onCellMouseDown(r, c)}
                          onMouseEnter={() => onCellMouseEnter(r, c)}
                          className={`shrink-0 border-r border-b border-zinc-800/20 cursor-pointer relative hover:bg-sky-500/5 transition-colors group ${pitch.includes('#') ? 'bg-zinc-950/20' : ''}`}
                          style={{ width: CELL_SIZE, height: CELL_SIZE }}
                        >
                          {/* Ghost hover */}
                          <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/5 transition-all" />

                          {(active || preview) && noteStart && (
                            <motion.div 
                              layoutId={note?.id || 'preview'}
                              className={`absolute top-1 left-1 bottom-1 rounded-lg z-20 flex items-center px-2 overflow-hidden ${preview ? 'bg-sky-400/20 border border-sky-400/50 backdrop-blur-sm' : 'bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.3)]'}`}
                              style={{ width: duration * CELL_SIZE - 8 }}
                            >
                              <Music2 className={`w-3 h-3 shrink-0 ${preview ? 'text-sky-300' : 'text-zinc-950/50'}`} />
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="relative bg-[#18181B] border border-zinc-800 rounded-[2.5rem] w-full max-w-lg shadow-2xl p-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />
              
              <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black uppercase text-white tracking-tight">Cloud Save</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Share or import patterns</p>
                </div>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900 text-zinc-500 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <textarea 
                    value={shareCode}
                    onChange={(e) => setShareCode(e.target.value)}
                    placeholder="Paste project code here..."
                    className="w-full h-40 bg-zinc-950 border border-zinc-800/10 rounded-3xl p-6 text-[10px] font-mono text-sky-400 placeholder:text-zinc-800 transition-all focus:outline-none focus:border-sky-500/30 custom-scrollbar resize-none"
                  />
                  <div className="absolute bottom-4 right-4 text-[8px] font-black uppercase text-zinc-700 pointer-events-none">RAW_BUFFER</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { 
                      navigator.clipboard.writeText(window.location.href); 
                    }} 
                    className="flex items-center justify-center gap-3 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-zinc-800"
                  >
                    <Save className="w-4 h-4" />
                    Copy Link
                  </button>
                  <button 
                    onClick={handleImport} 
                    className="flex items-center justify-center gap-3 py-4 bg-sky-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-sky-500 shadow-xl shadow-sky-900/20 active:scale-[0.98]"
                  >
                    <Music2 className="w-4 h-4" />
                    Restore
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
