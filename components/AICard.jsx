import React, { useMemo } from 'react';
import { calculateFloodRisk } from '../utils/fuzzyEngine';
// Make sure this path matches where your icons are located
import { CpuIcon } from '../utils/icons'; 

const AICard = ({ liveData }) => {
    
    // 1. Calculate Risk (Only updates when sensor data changes)
    const aiResult = useMemo(() => {
        return calculateFloodRisk(
            liveData.rainRaw, 
            liveData.soilRaw, 
            liveData.waterDistanceCM, 
            liveData.pressure
        );
    }, [liveData]);

    // 2. Determine Style based on Risk Score
    const isCritical = aiResult.score >= 80;
    const isWarning = aiResult.score >= 50 && aiResult.score < 80;

    // Dynamic Colors
    const borderColor = isCritical ? 'border-red-500' : isWarning ? 'border-orange-500' : 'border-emerald-500';
    const bgColor = isCritical ? 'bg-red-500/10' : isWarning ? 'bg-orange-500/10' : 'bg-slate-800';
    const textColor = isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-emerald-400';
    const pulseAnimation = isCritical ? 'animate-pulse' : '';

    return (
        <div className={`p-6 rounded-2xl border-2 ${borderColor} ${bgColor} transition-all duration-500 shadow-xl`}>
            
            {/* --- HEADER --- */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-slate-900 ${textColor}`}>
                        <CpuIcon className={`w-6 h-6 ${pulseAnimation}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">AI Risk Analysis</h3>
                        <p className="text-xs text-slate-400">Fuzzy Logic Engine</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-4xl font-black ${textColor}`}>{aiResult.score}%</span>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Risk Score</p>
                </div>
            </div>

            {/* --- STATUS MESSAGE --- */}
            <div className="mb-6">
                <p className={`text-xl font-bold mb-1 ${textColor}`}>{aiResult.status}</p>
                <p className="text-slate-300 text-sm italic">"{aiResult.message}"</p>
            </div>

            {/* --- SENSOR INPUTS (4 Columns) --- */}
            <div className="pt-4 border-t border-slate-700/50">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Sensor Weights (Input Severity)</p>
                
                <div className="grid grid-cols-4 gap-2 text-center">
                    {/* Rain */}
                    <div className="bg-slate-900 rounded p-2">
                        <span className="block text-[10px] text-slate-400 uppercase">Rain</span>
                        <span className="font-mono font-bold text-sky-400">{aiResult.details.rain}</span>
                    </div>

                    {/* Soil */}
                    <div className="bg-slate-900 rounded p-2">
                        <span className="block text-[10px] text-slate-400 uppercase">Soil</span>
                        <span className="font-mono font-bold text-amber-600">{aiResult.details.soil}</span>
                    </div>

                    {/* Water */}
                    <div className="bg-slate-900 rounded p-2">
                        <span className="block text-[10px] text-slate-400 uppercase">Water</span>
                        <span className="font-mono font-bold text-cyan-400">{aiResult.details.water}</span>
                    </div>

                    {/* Pressure (NEW) */}
                    <div className="bg-slate-900 rounded p-2">
                        <span className="block text-[10px] text-slate-400 uppercase">Press</span>
                        <span className="font-mono font-bold text-purple-400">{aiResult.details.pressure}</span>
                    </div>
                </div>
            </div>

            {/* --- SYSTEM LOGIC (Interaction Visualization) --- */}
            {/* This shows how the sensors are "talking" to each other */}
            <div className="mt-4 pt-3 border-t border-slate-700/30">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Detected Patterns</p>

                {/* Surge Risk (Water + Pressure) */}
                <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Storm Surge Risk (Water + Press)</span>
                        <span className="text-purple-400">{aiResult.interactions?.surge_factor || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div 
                            className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${aiResult.interactions?.surge_factor || 0}%` }}
                        ></div>
                    </div>
                </div>

                {/* Runoff Risk (Rain + Soil) */}
                <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Runoff Risk (Rain + Soil)</span>
                        <span className="text-amber-400">{aiResult.interactions?.runoff_factor || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div 
                            className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${aiResult.interactions?.runoff_factor || 0}%` }}
                        ></div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AICard;