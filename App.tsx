import React, { useState, useCallback } from 'react';
import Simulation from './components/Simulation';
import { PhysicsConfig, TelemetryData } from './types';
import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_CONFIG: PhysicsConfig = {
  maxSpeed: 180, 
  acceleration: 65, 
  engineBraking: 8,
  manualBraking: 110,
  steeringSensitivity: 1.4, 
  rollFactor: 0.12,
  pitchFactor: 0.2,
  angularDamping: 12.0,
  tractionAsphalt: 1.0,
  suspensionStiffness: 90.0,
  suspensionDamping: 25.0
};

const App: React.FC = () => {
  const [config, setConfig] = useState<PhysicsConfig>(DEFAULT_CONFIG);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isTuning, setIsTuning] = useState(false);

  const handleTelemetry = useCallback((data: TelemetryData) => {
    setTelemetry(data);
  }, []);

  const handleAiTune = async () => {
    if (!aiPrompt.trim()) return;
    setIsTuning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Professional race bike engineer. Tuning a 1000cc superbike. Goal: "${aiPrompt}". Current settings: ${JSON.stringify(config)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              maxSpeed: { type: Type.NUMBER },
              acceleration: { type: Type.NUMBER },
              engineBraking: { type: Type.NUMBER },
              manualBraking: { type: Type.NUMBER },
              steeringSensitivity: { type: Type.NUMBER },
              rollFactor: { type: Type.NUMBER },
              pitchFactor: { type: Type.NUMBER },
              angularDamping: { type: Type.NUMBER },
              tractionAsphalt: { type: Type.NUMBER },
              suspensionStiffness: { type: Type.NUMBER },
              suspensionDamping: { type: Type.NUMBER }
            }
          }
        }
      });
      if (response.text) setConfig(JSON.parse(response.text.trim()));
      setAiPrompt('');
    } catch (e) {
      console.error("Tuning error:", e);
    } finally {
      setIsTuning(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-slate-100 bg-[#050507]">
      <Simulation config={config} onTelemetry={handleTelemetry} />

      {/* Main HUD */}
      <div className="absolute bottom-10 left-10 pointer-events-none flex flex-col gap-4">
        <div className="glass-dark p-8 rounded-[2rem] w-80 border-l-4 border-blue-500 shadow-2xl">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Velocity</span>
            <span className="text-blue-400 font-bold italic tracking-tighter">GEAR {telemetry?.gear || 1}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <h1 className="text-7xl font-black italic tracking-tighter text-white">
              {telemetry?.speed || 0}
            </h1>
            <span className="text-lg font-bold text-slate-400 uppercase">km/h</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Lean Angle</p>
              <p className="text-2xl font-black text-blue-400">{telemetry?.bodyRoll || 0}°</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase font-bold text-slate-500">RPM</p>
              <p className="text-2xl font-black text-red-500">{telemetry?.rpm || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Tuning Panel */}
      <div className="absolute top-10 right-10 w-72 glass-dark p-6 rounded-[2rem] border-t-2 border-blue-500/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center accent-glow">
            <i className="fas fa-microchip text-white text-lg"></i>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-tight">MotoEngineer AI</h3>
            <p className="text-[9px] text-slate-500 font-medium">Neural Calibration Active</p>
          </div>
        </div>
        
        <textarea 
          className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-24 mb-4 resize-none transition-all"
          placeholder="E.g. 'Make it more stable at high speeds' or 'Improve flick-ability'..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
        />
        
        <button 
          onClick={handleAiTune}
          disabled={isTuning || !aiPrompt.trim()}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
        >
          {isTuning ? "Recalibrating..." : "Apply AI Tuning"}
        </button>
      </div>

      {/* Controls */}
      <div className="absolute bottom-10 right-10 flex flex-col items-end gap-2">
        <div className="glass-dark px-6 py-3 rounded-full border border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          WASD / Arrows to Drive • Bike leans based on speed
        </div>
      </div>
    </div>
  );
};

export default App;