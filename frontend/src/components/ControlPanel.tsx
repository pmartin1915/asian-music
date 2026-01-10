import React, { useState } from 'react';
import { Tooltip, InfoIcon } from './Tooltip';
import type { CompositionParams, PentatonicMode, Instrument, Mood } from '../types/music';

interface ControlPanelProps {
  onGenerate: (params: CompositionParams) => void;
  isGenerating: boolean;
}

const MODES: PentatonicMode[] = ['gong', 'shang', 'jue', 'zhi', 'yu'];
const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const AVAILABLE_INSTRUMENTS: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];
const MOODS: Mood[] = ['calm', 'heroic', 'melancholic', 'festive'];

const MODE_INFO: Record<PentatonicMode, { chinese: string; description: string }> = {
  gong: { chinese: '宫', description: 'Bright and stable, like Western major scale' },
  shang: { chinese: '商', description: 'Clear and uplifting, commercial character' },
  jue: { chinese: '角', description: 'Soft and pastoral, horn-like quality' },
  zhi: { chinese: '徵', description: 'Joyful and fiery, fire element' },
  yu: { chinese: '羽', description: 'Sad and gentle, feather-like delicacy' },
};

const INSTRUMENT_INFO: Record<Instrument, string> = {
  erhu: 'Two-stringed bowed instrument, the "Chinese violin"',
  guzheng: '21-string zither with moveable bridges',
  pipa: 'Four-stringed lute, plucked with fingernails',
  dizi: 'Transverse bamboo flute with buzzing membrane',
};

export const ControlPanel: React.FC<ControlPanelProps> = ({ onGenerate, isGenerating }) => {
  const [mode, setMode] = useState<PentatonicMode>('gong');
  const [root, setRoot] = useState<string>('C');
  const [tempo, setTempo] = useState<number>(72);
  const [instruments, setInstruments] = useState<Instrument[]>(['erhu']);
  const [mood, setMood] = useState<Mood>('calm');
  const [seed, setSeed] = useState<number | ''>('');

  const handleInstrumentChange = (inst: Instrument) => {
    setInstruments(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    );
  };

  const handleSubmit = () => {
    onGenerate({
      mode, root, tempo, instruments, mood, seed: seed === '' ? undefined : Number(seed)
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-silk-stone">Composition Controls</h2>
      
      {/* Mode & Root */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="flex items-center gap-1 text-sm font-medium mb-1">
            Mode (Five Elements)
            <Tooltip content={
              <div className="text-left">
                <div className="font-bold mb-1">{MODE_INFO[mode].chinese} ({mode})</div>
                <div>{MODE_INFO[mode].description}</div>
              </div>
            }>
              <InfoIcon />
            </Tooltip>
          </label>
          <select value={mode} onChange={e => setMode(e.target.value as PentatonicMode)} className="w-full p-2 border rounded">
            {MODES.map(m => <option key={m} value={m}>{MODE_INFO[m].chinese} {m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Root Key</label>
          <select value={root} onChange={e => setRoot(e.target.value)} className="w-full p-2 border rounded">
            {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Tempo */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Tempo: {tempo} BPM</label>
        <input 
          type="range" min="40" max="160" value={tempo} 
          onChange={e => setTempo(Number(e.target.value))} 
          className="w-full accent-silk-amber"
        />
      </div>

      {/* Instruments */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Instruments</label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_INSTRUMENTS.map(inst => (
            <Tooltip key={inst} content={INSTRUMENT_INFO[inst]}>
              <button
                onClick={() => handleInstrumentChange(inst)}
                aria-pressed={instruments.includes(inst)}
                className={`px-3 py-1 rounded-full border transition-colors ${
                  instruments.includes(inst)
                    ? 'bg-silk-stone text-white border-silk-stone'
                    : 'bg-white text-silk-stone border-gray-300 hover:bg-gray-50'
                }`}
              >
                {inst.charAt(0).toUpperCase() + inst.slice(1)}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Mood ({mood})</label>
        <div className="flex flex-wrap gap-2">
           {MOODS.map(m => (
             <button key={m} onClick={() => setMood(m)}
               className={`px-3 py-1 rounded-full border-2 text-xs font-medium transition-colors ${
                 mood === m
                   ? 'border-silk-red bg-silk-red text-white'
                   : 'border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200'
               }`}
               aria-pressed={mood === m}
             >
                {m.charAt(0).toUpperCase() + m.slice(1)}
             </button>
           ))}
        </div>
      </div>

      {/* Seed */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Seed (Optional)</label>
        <input 
          type="number" 
          value={seed} 
          onChange={e => setSeed(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Random if empty"
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isGenerating || instruments.length === 0}
        className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
          isGenerating || instruments.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-silk-red hover:bg-red-700 shadow-md'
        }`}
      >
        {isGenerating ? 'Composing...' : 'Generate Music'}
      </button>
    </div>
  );
};
