
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface NoteData {
  id: string;
  pitch: string;
  startStep: number;
  duration: number; // in steps
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
