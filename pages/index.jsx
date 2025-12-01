// pages/index.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getFormattedTime } from '../utils/sensorUtils';
import { useSensorData } from '../hooks/useSensorData';
import { useDashboardInit } from '../hooks/useDashboardInit';
import { ClockIcon, RefreshCcwIcon, CpuIcon } from '../utils/icons';
import ModeView from '../components/ModeView';

const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];
    const [currentTime, setCurrentTime] = useState('Loading...');

    // 1. Fetch Data & Calculate Percentages
    const { liveData, historyData, fetchError, rainPercent, soilPercent, waterPercent } = useSensorData(isClient, mode);
    
    // 2. Initialize and Update Dashboard Libraries (Gauges/Chart)
    const dashboardRefs = useDashboardInit(
        liveData, historyData, mode, rainPercent, soilPercent, waterPercent
    );

    // Group percentages for easy passing to ModeView
    const percents = useMemo(() => ({ rainPercent, soilPercent, waterPercent }), [rainPercent, soilPercent, waterPercent]);

    // 3. Client/CDN Init & Time update
    useEffect(() => {
        setIsClient(true);
        // Load external libraries required for gauges and charts
        const cdnUrls = [
            "https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js",
            "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
            "https://cdn.tailwindcss.com",
        ];
        
        const loadScript = (url) => new Promise(resolve => {
            const script = document.createElement('script');
            script.src = url; script.async = true; script.onload = resolve;
            if (url.includes('tailwindcss')) document.head.prepend(script); else document.head.appendChild(script);
            if (url.includes('tailwindcss')) resolve(); 
        });

        // Simplified dependency check for library loading
        Promise.all(cdnUrls.map(loadScript)).then(() => { 
            if (typeof window.Gauge !== 'undefined' && typeof window.Chart !== 'undefined') {
                setScriptsLoaded(true); 
            }
        });
        
        setCurrentTime(getFormattedTime());
        const timeInterval = setInterval(() => setCurrentTime(getFormattedTime()), 10000);
        return () => clearInterval(timeInterval);
    }, []);


    if (!isClient || !scriptsLoaded) return <div className="flex justify-center items-center h-screen bg-slate-900 text-emerald-400 font-inter"><RefreshCcwIcon className="animate-spin w-8 h-8 mr-2" /> Initializing...</div>;

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
            <style>{`
                .chart-container { height: 50vh; width: 100%; }
                .gauges-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }
                .gauge-wrapper canvas { max-width: 100%; height: auto; }
                @media (min-width: 1024px) { .gauges-container { grid-template-columns: repeat(4, 1fr); } .chart-container { height: 400px; } }
            `}</style>
            
            <header className="mb-8 p-5 bg-slate-800 rounded-3xl shadow-lg border-b-4 border-emerald-500/50 flex flex-col md:flex-row justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-extrabold text-emerald-400 mb-2 md:mb-0">Smart Weather Station</h1>
                    <div className="flex items-center text-xs text-slate-400 mt-1 bg-slate-900 px-2 py-1 rounded-md border border-slate-700 w-fit">
                        <CpuIcon className="w-3 h-3 mr-1 text-yellow-400" />
                        DEVICE MODE: <span className="text-emerald-300 ml-1 font-mono font-bold">{liveData.deviceMode}</span>
                    </div>
                </div>
                <div className="flex items-center text-slate-400 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 mt-4 md:mt-0">
                    <ClockIcon className="w-5 h-5 mr-2 text-indigo-400" />
                    <span>{currentTime}</span>
                </div>
            </header>

            <main className="space-y-8">
                {/* UI Mode Selector */}
                <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                    {modes.map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === m ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{m}</button>
                    ))}
                </div>
                
                <ModeView
                    mode={mode}
                    setMode={setMode}
                    liveData={liveData}
                    fetchError={fetchError}
                    refs={dashboardRefs}
                    percents={percents}
                />
            </main>
        </div>
    );
}

export default App;