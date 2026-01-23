
import React, { useState, useCallback } from 'react';
import Simulation from './components/Simulation';
import { PhysicsConfig, TelemetryData, TaskType } from './types';
import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_CONFIG: PhysicsConfig = {
  maxSpeed: 160, 
  acceleration: 55, 
  engineBraking: 5,
  manualBraking: 90,
  steeringSensitivity: 1.1, 
  rollFactor: 0.08,
  pitchFactor: 0.15,
  angularDamping: 10.0,
  tractionAsphalt: 1.0,
  suspensionStiffness: 80.0,
  suspensionDamping: 20.0
};

const getTaskDescription = (type: string, level: number) => {
  return `Circuit Stage ${level}: High Speed Sprint`;
};

const App: React.FC = () => {
  const [config, setConfig] = useState<PhysicsConfig>(DEFAULT_CONFIG);
  // Fixed syntax error: removed duplicate assignment and bracket that caused multiple TS errors
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
      // Initialize GoogleGenAI with apiKey from environment
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Expert racing car engineer. Tune the GT car for: "${aiPrompt}". Current level: ${telemetry?.level || 1}. Current config: ${JSON.stringify(config)}`,
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
      // Correctly access the .text property from GenerateContentResponse
      if (response.text) setConfig(JSON.parse(response.text.trim()));
      setAiPrompt('');
    } catch (e) { console.error(e); } finally { setIsTuning(false); }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-slate-900 font-sans bg-[#f0f4f8]">
      <Simulation config={config} onTelemetry={handleTelemetry} />

      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[450px] pointer-events-none">
        <div className="glass-light p-5 rounded-[2rem] border-b-8 border-blue-600 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-700">GT World Series</span>
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-blue-600 text-white shadow-inner">STAGE {telemetry?.level || 1}</span>
          </div>
          <h3 className="text-2xl font-black tracking-tighter uppercase italic leading-none mb-3">
            {getTaskDescription(telemetry?.currentTask || '', telemetry?.level || 1)}
          </h3>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-700 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
              // Added comprehensive null check to avoid 'Object is possibly null' error
              style={{ width: `${(telemetry && telemetry.taskTotal && telemetry.taskTotal > 0) ? (telemetry.taskProgress || 0) / telemetry.taskTotal * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-12 flex flex-col gap-4 pointer-events-none">
        <div className="glass-light p-10 rounded-[3rem] w-80 border-l-[12px] border-blue-700 shadow-2xl">
          <div className="flex justify-between items-end mb-1">
             <h2 className="text-[12px] uppercase tracking-[0.2em] font-black text-slate-400">Velocity</h2>
             <span className="text-xl font-black text-blue-800 italic">GEAR {telemetry?.gear ?? 1}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-9xl font-black tracking-tighter text-slate-900 drop-shadow-sm">
              {telemetry?.speed ?? 0}
            </span>
            <span className="text-2xl font-black italic text-blue-800 uppercase">km/h</span>
          </div>
          
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-100">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Load G</span>
              <span className="text-3xl font-black text-slate-800 tracking-tighter">{telemetry?.bodyRoll ?? 0}°</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">RPM</span>
              <span className="text-3xl font-black text-red-600 tracking-tighter">{telemetry?.rpm ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-8 right-8 w-80 glass-light p-7 rounded-[2.5rem] pointer-events-auto border-r-4 border-blue-300">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-blue-950 rounded-2xl flex items-center justify-center shadow-xl rotate-3">
            <i className="fas fa-microchip text-blue-400 text-xl"></i>
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tight text-slate-900">Race Engineer AI</h3>
            <p className="text-[10px] text-slate-500 font-bold">Dynamic Calibration</p>
          </div>
        </div>
        <textarea 
          className="w-full bg-white/50 backdrop-blur-sm border-2 border-slate-100 rounded-[1.5rem] p-5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-200 h-32 mb-5 shadow-inner font-medium"
          placeholder="e.g. Reduce high-speed understeer..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
        />
        <button 
          onClick={handleAiTune}
          disabled={isTuning || !aiPrompt.trim()}
          className="w-full py-5 bg-blue-950 hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl active:scale-95 group"
        >
          {isTuning ? (
            <span className="flex items-center justify-center gap-2">
              <i className="fas fa-sync animate-spin"></i> Calculating Tuning...
            </span>
          ) : (
            "Update Vehicle Config"
          )}
        </button>
      </div>

      <div className="absolute bottom-8 right-8 glass-light px-8 py-4 rounded-full opacity-90 border-2 border-slate-100 shadow-lg">
        <span className="text-[12px] font-black uppercase tracking-widest text-blue-900 flex items-center gap-3">
          <i className="fas fa-keyboard text-blue-500"></i> WASD • Manual Steering Required in Turns
        </span>
      </div>
    </div>
  );
};

export default App;
