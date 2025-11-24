import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Configuration ---
const initialSensorData = { pressure: 1012.0, rain: 0.0, waterLevel: 65.0, soil: 60.0 };
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

// --- Helper Functions ---
const getFormattedTime = () => new Date().toLocaleTimeString('en-US');

// Helper function to map descriptive API strings back to numerical values
const mapDescriptiveValue = (key, value) => {
    if (typeof value === 'number') return value;
    
    // Check for null/undefined before lowercasing
    if (!value) return initialSensorData[key] || 0.0;
    
    const normalizedValue = String(value).toLowerCase().trim();

    switch (key) {
        case 'rain': 
            // 0.0 is dry, 5.0 is light, 35.0 is heavy
            if (normalizedValue.includes('dry') || normalizedValue.includes('no rain')) return 0.0;
            if (normalizedValue.includes('light')) return 5.0; 
            if (normalizedValue.includes('heavy')) return 35.0; 
            return 0.0; 
            
        case 'waterlevel': 
            // 0-100% range. 20 is low, 65 is normal, 85 is high.
            if (normalizedValue.includes('low') || normalizedValue.includes('below normal')) return 20.0; 
            if (normalizedValue.includes('normal') || normalizedValue.includes('optimal')) return 65.0; 
            if (normalizedValue.includes('above normal') || normalizedValue.includes('high')) return 85.0; 
            return 65.0; 
            
        case 'soil': 
            // 0-100% range. 20 is dry, 50 is optimal, 80 is wet.
            if (normalizedValue.includes('dry')) return 20.0; 
            if (normalizedValue.includes('optimal') || normalizedValue.includes('normal')) return 50.0;
            if (normalizedValue.includes('wet')) return 80.0; 
            return 50.0; 
            
        default: return initialSensorData[key] || 0.0;
    }
};

// --- Dashboard Component ---
const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [fetchError, setFetchError] = useState(null); 
    
    // Mode State 
    const [mode, setMode] = useState('Auto'); 
    const modes = ['Auto', 'Maintenance', 'Sleep'];

    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState(getFormattedTime());

    // --- Status Calculation Functions ---
    const getRainStatus = (rain) => {
        if (rain > 30) return { reading: 'Heavy Rain', status: 'ALERT: Heavy Rainfall!', className: 'text-red-400 font-bold' };
        if (rain > 0) return { reading: 'Light Rain', status: 'STATUS: Light Rainfall', className: 'text-yellow-400 font-bold' };
        return { reading: 'No Rain', status: 'STATUS: Clear', className: 'text-emerald-400 font-bold' };
    };
    const getPressureStatus = (pressure) => {
        if (pressure < 990) return { status: 'WARNING: Low Pressure!', className: 'text-red-400 font-bold' };
        if (pressure > 1030) return { status: 'STATUS: High Pressure', className: 'text-yellow-400 font-bold' };
        return { status: 'STATUS: Normal Pressure', className: 'text-emerald-400 font-bold' };
    };
    const getWaterStatus = (level) => {
        if (level > 90) return { status: 'ALERT: Tank Nearing Full!', className: 'text-red-400 font-bold' };
        if (level < 30) return { status: 'STATUS: Level Low', className: 'text-yellow-400 font-bold' };
        return { status: 'STATUS: Optimal', className: 'text-emerald-400 font-bold' };
    };
    const getSoilStatus = (moisture) => {
        if (moisture < 30) return { reading: 'Dry', status: 'ALERT: Soil is Dry!', className: 'text-red-400 font-bold' };
        if (moisture < 70) return { reading: 'Optimal', status: 'STATUS: Soil Moisture Optimal', className: 'text-emerald-400 font-bold' };
        return { reading: 'Wet', status: 'WARNING: Soil is Wet!', className: 'text-yellow-400 font-bold' };
    };

    const rainStatus = useMemo(() => getRainStatus(liveData.rain), [liveData.rain]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);
    const waterStatus = useMemo(() => getWaterStatus(liveData.waterLevel), [liveData.waterLevel]);
    const soilStatus = useMemo(() => getSoilStatus(liveData.soil), [liveData.soil]);


    // === 0. Initialization & Script Loading ===
    useEffect(() => {
        setIsClient(true);
        // Removed Gauge.js dependency
        const cdnUrls = [
            "https://unpkg.com/react@18/umd/react.production.min.js",
            "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
            "https://cdn.tailwindcss.com",
        ];

        Promise.all(cdnUrls.map(url => new Promise(resolve => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = resolve;
            document.head.appendChild(script);
        }))).then(() => setScriptsLoaded(true)); 
        
        const timeInterval = setInterval(() => setCurrentTime(getFormattedTime()), 1000);
        return () => clearInterval(timeInterval);
    }, []);

    // 1. Fetch Live Data (1-second polling)
    const fetchSensorData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return; // Depend only on mode and isClient state

        try {
            const response = await fetch(REAL_API_ENDPOINT); 
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            
            const mappedData = {
                pressure: parseFloat(data.pressure) || initialSensorData.pressure,
                rain: mapDescriptiveValue('rain', data.rain),
                waterLevel: mapDescriptiveValue('waterLevel', data.waterLevel),
                soil: mapDescriptiveValue('soil', data.soil),
            };
            
            setLiveData(mappedData);
            setFetchError(null); 

        } catch (error) {
            console.error("Failed to fetch live sensor data:", error);
            // Since we know the fetch works, this error might be transient or a JSON parse issue on the server side (even if the fetch status is 200)
            setFetchError(`API Error: ${error.message}. Check console for details.`);
        }
    }, [isClient, mode]); // Simplified dependency array

    // 2. Dashboard Initialization (Empty, as no external UI libs need initializing)
    const initializeDashboard = useCallback(() => {}, []); 

    // === 3. Effects ===

    // Effect 3a: Data Polling (1 second interval) - DEPENDS on the stable fetchSensorData
    useEffect(() => {
        if (mode !== 'Auto') return;
        
        // Initial fetch right away
        fetchSensorData(); 

        const interval = setInterval(fetchSensorData, 1000); 
        return () => clearInterval(interval);
    }, [fetchSensorData, mode]); // fetchSensorData is now in the dependency array

    // Effect 3b: Initialization
    useEffect(() => {
        if (scriptsLoaded && mode === 'Auto') {
            initializeDashboard();
        } 
    }, [initializeDashboard, mode, scriptsLoaded]);
    
    // NOTE: The UI update is implicit because the whole component re-renders when `liveData` changes.
    
    // --- SVG ICON COMPONENTS ---
    const CloudRainIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 20v-3"></path><path d="M8 20v-3"></path><path d="M12 18v-3"></path></svg>);
    const GaugeIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"></path><path d="M9 13l3 3 3-3"></path></svg>);
    const DropletIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69L6 8.52A10.74 10.74 0 0 0 12 22a10.74 10.74 0 0 0 6-13.48L12 2.69z"></path></svg>);
    const LeafIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A10 10 0 0 0 2 11c0-4 4-4 8-8 3 0 4 3 4 5 0 2-3 5-3 5l-1 1 1 1c1.5 1.5 3.5 1.5 5 0l1-1c3 0 5 3 5 5 0 3-4 5-8 5z"></path></svg>);
    const RefreshCcwIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 18A8 8 0 1 0 7 19l-4-4"></path><path d="M4 13v-2"></path><path d="M17 19h-2l-4-4"></path></svg>);


    // --- RENDER ---
    if (!isClient || !scriptsLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-400 font-inter">
                <RefreshCcwIcon className="w-8 h-8 animate-spin mr-3 text-emerald-400" />
                <p>Initializing dashboard...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
            <style>{`
                /* Simplified CSS as no gauges are present */
                .gauges-container { display: none; }
                @media (min-width: 768px) {
                    .status-grid { grid-template-columns: repeat(4, 1fr); }
                }
            `}</style>
            
            <header className="mb-10 p-5 bg-slate-800 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center border-b-4 border-emerald-500/50">
                <h1 className="text-4xl font-extrabold text-emerald-400 mb-2 md:mb-0 tracking-tight">Smart Farm Monitor</h1>
                <div className="flex items-center text-md font-medium text-slate-400 bg-slate-900 px-5 py-2.5 rounded-xl shadow-inner border border-slate-700/50">
                    <svg className="w-5 h-5 mr-3 text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>{currentTime}</span>
                </div>
            </header>

            <main className="space-y-10">
                {/* Mode Selector Tabs */}
                <div className="flex justify-center bg-slate-800 p-2 rounded-xl shadow-2xl border border-slate-700/50">
                    {modes.map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`
                                px-6 py-3 text-lg font-bold rounded-xl transition duration-300 w-full md:w-1/3 mx-1
                                ${mode === m 
                                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/50' 
                                    : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                                }
                            `}
                        >
                            {m}
                        </button>
                    ))}
                </div>
                
                {mode === 'Auto' && (
                    <>
                        {fetchError && (
                            <div className="p-4 bg-red-800/50 text-red-300 rounded-xl border border-red-700 font-semibold flex items-center justify-center">
                                <svg className="h-6 w-6 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {fetchError}
                            </div>
                        )}

                        {/* Status Grid Section (Dynamic Data - Text Only) */}
                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 status-grid">
                            {/* Rain */}
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-emerald-500/50 hover:scale-[1.02] border border-slate-700 hover:border-emerald-600/70">
                                <CloudRainIcon className="w-10 h-10 mb-3 text-sky-400 p-2 bg-sky-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Rain Sensor</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.rain.toFixed(1)} mm/hr</p>
                                <p className={`text-sm ${rainStatus.className}`}>{rainStatus.status}</p>
                            </article>
                            {/* Pressure */}
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-purple-500/50 hover:scale-[1.02] border border-slate-700 hover:border-purple-600/70">
                                <GaugeIcon className="w-10 h-10 mb-3 text-purple-400 p-2 bg-purple-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Barometric Pressure</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.pressure.toFixed(1)} hPa</p>
                                <p className={`text-sm ${pressureStatus.className}`}>{pressureStatus.status}</p>
                            </article>
                            {/* Water Level */}
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-sky-500/50 hover:scale-[1.02] border border-slate-700 hover:border-sky-600/70">
                                <DropletIcon className="w-10 h-10 mb-3 text-sky-400 p-2 bg-sky-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Water Level (Tank)</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.waterLevel.toFixed(1)}%</p>
                                <p className={`text-sm ${waterStatus.className}`}>{waterStatus.status}</p>
                            </article>
                            {/* Soil Moisture */}
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-orange-500/50 hover:scale-[1.02] border border-slate-700 hover:border-orange-600/70">
                                <LeafIcon className="w-10 h-10 mb-3 text-orange-400 p-2 bg-orange-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Soil Moisture</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.soil.toFixed(1)}%</p>
                                <p className={`text-sm ${soilStatus.className}`}>{soilStatus.status}</p>
                            </article>
                        </section>

                    </>
                )}

                {/* Placeholder for Maintenance/Sleep Modes */}
                {mode !== 'Auto' && (
                    <div className="p-16 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 text-center flex flex-col items-center justify-center min-h-[50vh]">
                        <RefreshCcwIcon className={`w-16 h-16 mb-6 ${mode === 'Maintenance' ? 'text-yellow-400 animate-spin' : 'text-gray-500'}`} />
                        <h3 className="text-4xl font-extrabold mb-4 text-emerald-400">
                            System Mode: <span className={mode === 'Maintenance' ? 'text-yellow-400' : 'text-gray-400'}>{mode}</span>
                        </h3>
                        <p className="text-slate-300 text-lg max-w-xl">
                            The system is currently in **{mode} Mode**. Automatic monitoring and control systems are temporarily suspended. Please switch back to **Auto** to resume live data streaming.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;