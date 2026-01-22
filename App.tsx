
import React, { useState, useCallback } from 'react';
import Simulation from './components/Simulation';
import { PhysicsConfig, TelemetryData, TaskType } from './types';
import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_CONFIG: PhysicsConfig = {
  maxSpeed: 95,
  acceleration: 22,
  engineBraking: 3,
  manualBraking: 45,
  steeringSensitivity: 0.95,
  leanFactor: 0.55,
  angularDamping: 8.0,
  tractionAsphalt: 1.0,
  suspensionStiffness: 65.0,
  suspensionDamping: 7.0
};

const getTaskDescription = (type: string) => {
  switch (type) {
    case TaskType.Collect: return "Collect 5 Yellow Nitro Gems";
    case TaskType.Speed: return "Stay above 130 KM/H for 5s";
    case TaskType.Checkpoint: return "Pass through 3 Neon Arches";
    case "TECHNICAL_U_TURN": return "Perform a 180° Technical Turn (< 30 KM/H)";
    default: return "Complete the race";
  }
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Professional motorcycle engineer. Tune: "${aiPrompt}". Keep racing arcade feel. Current: ${JSON.stringify(config)}`,
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
              leanFactor: { type: Type.NUMBER },
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
    } catch (e) { console.error(e); } finally { setIsTuning(false); }
  };

  const isAgileMode = telemetry && telemetry.speed < 30;

  return (
    <div className="relative w-full h-screen overflow-hidden text-white font-sans bg-black">
      <Simulation config={config} onTelemetry={handleTelemetry} />

      {/* Top Mission HUD */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[400px] pointer-events-none">
        <div className={`glass p-4 rounded-2xl border-t-2 transition-all duration-300 ${telemetry?.currentTask === "TECHNICAL_U_TURN" ? 'border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.3)]' : 'border-yellow-400 shadow-[0_0_30px_rgba(255,255,0,0.2)]'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${telemetry?.currentTask === "TECHNICAL_U_TURN" ? 'text-orange-400' : 'text-yellow-400'}`}>Current Mission</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${telemetry?.currentTask === "TECHNICAL_U_TURN" ? 'bg-orange-500 text-black' : 'bg-yellow-400 text-black'}`}>ACTIVE</span>
          </div>
          <h3 className="text-lg font-black italic tracking-tighter uppercase leading-none mb-3">
            {getTaskDescription(telemetry?.currentTask || '')}
          </h3>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden flex">
            {telemetry?.currentTask === "TECHNICAL_U_TURN" ? (
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-300 shadow-[0_0_10px_rgba(249,115,22,0.8)]" 
                  style={{ width: `${(telemetry.taskProgress / telemetry.taskTotal) * 100}%` }}
                />
            ) : (
                Array.from({ length: telemetry?.taskTotal || 1 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`flex-1 h-full border-r border-black/20 transition-all duration-500 ${
                      i < (telemetry?.taskProgress || 0) ? 'bg-gradient-to-r from-yellow-300 to-yellow-500 shadow-[0_0_10px_rgba(255,255,0,0.8)]' : 'bg-white/5'
                    }`}
                  />
                ))
            )}
          </div>
        </div>
      </div>

      {/* Left HUD */}
      <div className="absolute top-8 left-8 flex flex-col gap-4 pointer-events-none">
        <div className={`glass p-6 rounded-2xl w-64 border-l-4 transition-all duration-300 ${isAgileMode ? 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'border-cyan-500'}`}>
          <h2 className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${isAgileMode ? 'text-orange-400' : 'text-cyan-400'}`}>
            {isAgileMode ? "Technical Agility Mode" : "Live Velocity"}
          </h2>
          <div className="flex items-baseline gap-2">
            <span className={`text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b ${isAgileMode ? 'from-white to-orange-500' : 'from-white to-cyan-500'}`}>
              {telemetry?.speed || 0}
            </span>
            <span className={`text-xl font-bold italic ${isAgileMode ? 'text-orange-800' : 'text-cyan-800'}`}>KM/H</span>
          </div>
          
          <div className="mt-4 flex justify-between items-end border-t border-white/5 pt-4">
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Gear</p>
              <p className="text-3xl font-black italic text-cyan-400">{telemetry?.gear || 1}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400 uppercase">Total Score</p>
              <p className="text-3xl font-black italic text-magenta-400">{telemetry?.score || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right AI Tuner */}
      <div className="absolute top-8 right-8 w-80 glass p-6 rounded-2xl pointer-events-auto border-b-2 border-magenta-500/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-magenta-600 to-purple-800 rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-rocket text-sm"></i>
          </div>
          <div>
            <h3 className="font-black text-xs uppercase tracking-widest italic text-magenta-400">X-Tuning AI</h3>
            <p className="text-[9px] text-gray-500">Neuro-Physics Adjustment</p>
          </div>
        </div>
        <textarea 
          className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-magenta-500 h-24 mb-4 font-mono"
          placeholder="Make it feel weightless..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
        />
        <button 
          onClick={handleAiTune}
          disabled={isTuning || !aiPrompt.trim()}
          className="w-full py-4 bg-magenta-600 hover:bg-magenta-500 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(255,0,255,0.2)]"
        >
          {isTuning ? "Synthesizing..." : "Calibrate Physics"}
        </button>
      </div>

      {/* Legend & Helpers */}
      <div className="absolute bottom-8 right-8 flex gap-4 pointer-events-none opacity-60">
        <div className={`glass px-4 py-2 rounded-xl border transition-colors duration-300 ${isAgileMode ? 'border-orange-500' : 'border-cyan-500/20'}`}>
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isAgileMode ? <span className="text-orange-400">Agility Boost Active</span> : <>Cyan Section <span className="text-cyan-400">Boost</span></>}
          </span>
        </div>
      </div>
    </div>
  );
};

export default App;
