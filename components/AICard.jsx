import React, { useMemo } from 'react';
import { calculateFloodRisk } from '../utils/fuzzyEngine';
import { CpuIcon } from '../utils/icons'; // Make sure you have this icon or import another

const AICard = ({ liveData }) => {
    // Recalculate AI result only when sensor data changes
    const aiResult = useMemo(() => {
        return calculateFloodRisk(
            liveData.rainRaw, 
            liveData.soilRaw, 
            liveData.waterDistanceCM, 
            liveData.pressure
        );
    }, [liveData]);

    const isCritical = aiResult.score > 80;
    const isWarning = aiResult.score > 50 && aiResult.score <= 80;

    // Dynamic Colors based on risk
    const borderColor = isCritical ? 'border-red-500' : isWarning ? 'border-orange-500' : 'border-emerald-500';
    const bgColor = isCritical ? 'bg-red-500/10' : isWarning ? 'bg-orange-500/10' : 'bg-slate-800';
    const textColor = isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-emerald-400';

    return (
        <div className={`p-6 rounded-2xl border-2 ${borderColor} ${bgColor} transition-all duration-500 shadow-xl`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-slate-900 ${textColor}`}>
                        <CpuIcon className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">AI Risk Analysis</h3>
                        <p className="text-xs text-slate-400">Fuzzy Logic Inference Engine</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-4xl font-black ${textColor}`}>{aiResult.score}%</span>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Risk Score</p>
                </div>
            </div>

            {/* Recommendation */}
            <div className="mb-6">
                <p className={`text-xl font-bold mb-1 ${textColor}`}>{aiResult.status}</p>
                <p className="text-slate-300 text-sm italic">"{aiResult.message}"</p>
            </div>

            {/* "Debug" View for Panel (Shows how it thinks) */}
            <div className="pt-4 border-t border-slate-700/50">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Internal Weights (0-100%)</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900 rounded p-2">
                        <span className="block text-xs text-slate-400">Rain</span>
                        <span className="font-mono font-bold text-sky-400">{aiResult.details.rain}</span>
                    </div>
                    <div className="bg-slate-900 rounded p-2">
                        <span className="block text-xs text-slate-400">Soil</span>
                        <span className="font-mono font-bold text-amber-600">{aiResult.details.soil}</span>
                    </div>
                    <div className="bg-slate-900 rounded p-2">
                        <span className="block text-xs text-slate-400">Water</span>
                        <span className="font-mono font-bold text-cyan-400">{aiResult.details.water}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AICard;