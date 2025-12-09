import React, { useMemo } from 'react';
import { calculateFloodRisk } from '../utils/fuzzyEngine';
import { CpuIcon } from '../utils/icons'; 

const AICard = ({ liveData }) => {
    
    const aiResult = useMemo(() => {
        return calculateFloodRisk(
            liveData.rainRaw, 
            liveData.soilRaw, 
            liveData.waterDistanceCM, 
            liveData.pressure
        );
    }, [liveData]);

    const isCritical = aiResult.score >= 80;
    const isWarning = aiResult.score >= 50 && aiResult.score < 80;

    // Sleeker Colors & Glows
    const borderColor = isCritical ? 'border-red-500 shadow-red-500/20' : isWarning ? 'border-orange-500 shadow-orange-500/20' : 'border-emerald-500 shadow-emerald-500/20';
    const bgColor = isCritical ? 'bg-gradient-to-br from-red-500/10 to-slate-900' : isWarning ? 'bg-gradient-to-br from-orange-500/10 to-slate-900' : 'bg-gradient-to-br from-emerald-500/10 to-slate-900';
    const textColor = isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-emerald-400';
    const ringColor = isCritical ? 'ring-red-500' : isWarning ? 'ring-orange-500' : 'ring-emerald-500';

    return (
        <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} shadow-lg transition-all duration-500 flex flex-col h-full justify-between`}>
            
            {/* --- TOP ROW: Header & Score --- */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg bg-slate-950/50 border border-white/10 ${textColor}`}>
                        <CpuIcon className={`w-4 h-4 ${isCritical ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-100 text-sm leading-tight">AI Risk Analysis</h3>
                        <p className="text-[10px] text-slate-400 font-mono">Fuzzy Logic Engine</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-2xl font-black tracking-tighter ${textColor}`}>{aiResult.score}%</span>
                </div>
            </div>

            {/* --- MIDDLE: Recommendation --- */}
            <div className="mb-4 bg-slate-950/30 p-3 rounded-lg border border-white/5">
                <p className={`text-xs font-bold mb-1 tracking-wide uppercase ${textColor}`}>{aiResult.status}</p>
                <p className="text-slate-300 text-xs italic leading-relaxed opacity-90">"{aiResult.message}"</p>
            </div>

            {/* --- BOTTOM: Sensor Weights (Compact Circles) --- */}
            <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-2 tracking-wider">Input Severity</p>
                
                <div className="grid grid-cols-4 gap-2">
                    {/* Rain */}
                    <div className="flex flex-col items-center gap-1 group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 group-hover:border-sky-500 transition-colors`}>
                            <span className="text-[10px] font-bold text-sky-400">{aiResult.details.rain}</span>
                        </div>
                        <span className="text-[8px] text-slate-500 uppercase font-bold">Rain</span>
                    </div>

                    {/* Soil */}
                    <div className="flex flex-col items-center gap-1 group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 group-hover:border-amber-500 transition-colors`}>
                            <span className="text-[10px] font-bold text-amber-500">{aiResult.details.soil}</span>
                        </div>
                        <span className="text-[8px] text-slate-500 uppercase font-bold">Soil</span>
                    </div>

                    {/* Water */}
                    <div className="flex flex-col items-center gap-1 group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 group-hover:border-cyan-500 transition-colors`}>
                            <span className="text-[10px] font-bold text-cyan-400">{aiResult.details.water}</span>
                        </div>
                        <span className="text-[8px] text-slate-500 uppercase font-bold">Water</span>
                    </div>

                    {/* Pressure */}
                    <div className="flex flex-col items-center gap-1 group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 group-hover:border-purple-500 transition-colors`}>
                            <span className="text-[10px] font-bold text-purple-400">{aiResult.details.pressure}</span>
                        </div>
                        <span className="text-[8px] text-slate-500 uppercase font-bold">Press</span>
                    </div>
                </div>
            </div>

            {/* --- OPTIONAL: Micro-bars for Interactions (Hidden if space is tight) --- */}
            {(aiResult.interactions?.surge_factor > 0 || aiResult.interactions?.runoff_factor > 0) && (
                <div className="mt-3 pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                   {/* Surge Bar */}
                   <div>
                        <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
                            <span>Surge</span>
                            <span className="text-purple-400">{aiResult.interactions.surge_factor}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 transition-all duration-500" style={{width: `${aiResult.interactions.surge_factor}%`}}></div>
                        </div>
                   </div>
                   {/* Runoff Bar */}
                   <div>
                        <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
                            <span>Runoff</span>
                            <span className="text-amber-400">{aiResult.interactions.runoff_factor}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all duration-500" style={{width: `${aiResult.interactions.runoff_factor}%`}}></div>
                        </div>
                   </div>
                </div>
            )}
        </div>
    );
};

export default AICard;