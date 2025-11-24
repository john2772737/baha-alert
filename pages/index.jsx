import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- Configuration ---
const initialSensorData = { pressure: 1012.0, rain: 0.0, waterLevel: 65.0, soil: 60.0 };
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

// --- Helper Functions (Minimal for this Test) ---
const getFormattedTime = () => new Date().toLocaleTimeString('en-US');

// Helper function to map descriptive API strings back to numerical values
const mapDescriptiveValue = (key, value) => {
    if (typeof value === 'number') return value;
    const normalizedValue = String(value).toLowerCase().trim();
    switch (key) {
        case 'rain': return normalizedValue.includes('dry') || normalizedValue.includes('no rain') ? 0.0 : 5.0; 
        case 'waterlevel': return normalizedValue.includes('low') ? 20.0 : 65.0; 
        case 'soil': return normalizedValue.includes('dry') ? 20.0 : 50.0; 
        default: return 0.0;
    }
};

// --- Dashboard Component ---
const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [fetchError, setFetchError] = useState(null); 
    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState(getFormattedTime());

    // Refs for Gauge.js
    const gaugeRefs = {
        rain: useRef(null), pressure: useRef(null), waterLevel: useRef(null), soil: useRef(null)
    };
    const gaugeInstances = useRef({});

    // === 0. Initialization & Script Loading ===
    useEffect(() => {
        setIsClient(true);
        const cdnUrls = [
            "https://unpkg.com/react@18/umd/react.production.min.js",
            "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js",
            "https://cdn.tailwindcss.com",
        ];

        Promise.all(cdnUrls.map(url => new Promise(resolve => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = resolve;
            document.head.appendChild(script);
        }))).then(() => setScriptsLoaded(window.Gauge));
        
        const timeInterval = setInterval(() => setCurrentTime(getFormattedTime()), 1000);
        return () => clearInterval(timeInterval);
    }, []);

    // 1. Fetch Live Data (1-second polling)
    const fetchSensorData = useCallback(async () => {
        if (!isClient) return;
        
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
            setFetchError(`API Error: ${error.message}. Check console for CORS/Network details.`);
        }
    }, [isClient]); 

    // 2. Dashboard Initialization (Gauges only)
    const initializeDashboard = useCallback(() => {
        if (!isClient || !scriptsLoaded || typeof window.Gauge === 'undefined') return;
        
        if (!gaugeRefs.rain.current) return;

        const Gauge = window.Gauge;
        
        // Cleanup previous instances
        Object.keys(gaugeInstances.current).forEach(key => {
             if (gaugeInstances.current[key]) gaugeInstances.current[key] = null;
        });

        const gaugeOptions = {
            angle: 0.15, lineWidth: 0.25, radiusScale: 0.9,
            pointer: { length: 0.6, strokeWidth: 0.045, color: '#f3f4f6' }, 
            staticLabels: { font: "12px sans-serif", labels: [], color: '#9ca3af' },
            staticZones: [], limitMax: false, limitMin: false, highDpiSupport: true,
            strokeColor: '#374151', generateGradient: true,
            gradientStop: [['#10b981', 0.25], ['#f59e0b', 0.5], ['#ef4444', 0.75]]
        };

        const initGauge = (ref, max, min, initial, labels, zones) => {
            if (ref.current) {
                const options = JSON.parse(JSON.stringify(gaugeOptions));
                options.staticLabels.labels = labels;
                options.staticZones = zones;

                const gauge = new Gauge(ref.current).setOptions(options);
                gauge.maxValue = max;
                gauge.setMinValue(min);
                gauge.set(initial);
                return gauge;
            }
            return null;
        };

        // Initialize Gauges
        gaugeInstances.current.rain = initGauge(gaugeRefs.rain, 50, 0, liveData.rain, [0, 10, 20, 30, 40, 50], [{strokeStyle: "#10b981", min: 0, max: 10}, {strokeStyle: "#f59e0b", min: 10, max: 30}, {strokeStyle: "#ef4444", min: 30, max: 50}]);
        gaugeInstances.current.pressure = initGauge(gaugeRefs.pressure, 1050, 950, liveData.pressure, [950, 980, 1010, 1040, 1050], [{strokeStyle: "#f59e0b", min: 950, max: 980}, {strokeStyle: "#10b981", min: 980, max: 1040}, {strokeStyle: "#f59e0b", min: 1040, max: 1050}]);
        gaugeInstances.current.waterLevel = initGauge(gaugeRefs.waterLevel, 100, 0, liveData.waterLevel, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 80}, {strokeStyle: "#f59e0b", min: 80, max: 100}]);
        gaugeInstances.current.soil = initGauge(gaugeRefs.soil, 100, 0, liveData.soil, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 70}, {strokeStyle: "#f59e0b", min: 70, max: 100}]);
        
    }, [isClient, scriptsLoaded, liveData.pressure, liveData.rain, liveData.soil, liveData.waterLevel]); 

    // === 3. Effects ===

    // Effect 3a: Data Polling (1 second interval)
    useEffect(() => {
        const interval = setInterval(fetchSensorData, 1000); 
        return () => clearInterval(interval);
    }, [fetchSensorData]); 
    
    // Effect 3b: Initialization on script load (initial draw)
    useEffect(() => {
        if (scriptsLoaded) {
            initializeDashboard();
        }
        return () => { gaugeInstances.current = {}; };
    }, [initializeDashboard, scriptsLoaded]);

    // Effect 3c: Gauge Update (Runs whenever liveData changes)
    useEffect(() => {
        if (isClient && scriptsLoaded && window.Gauge && gaugeInstances.current.rain) { 
            requestAnimationFrame(() => {
                try {
                    if (gaugeInstances.current.rain) gaugeInstances.current.rain.set(liveData.rain);
                    if (gaugeInstances.current.pressure) gaugeInstances.current.pressure.set(liveData.pressure);
                    if (gaugeInstances.current.waterLevel) gaugeInstances.current.waterLevel.set(liveData.waterLevel);
                    if (gaugeInstances.current.soil) gaugeInstances.current.soil.set(liveData.soil);
                } catch (e) {
                    console.error("Error updating gauges, forcing re-init:", e);
                    initializeDashboard(); 
                }
            });
        }
    }, [liveData, scriptsLoaded, isClient, initializeDashboard]);

    // --- RENDER ---
    if (!isClient || !scriptsLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-400 font-inter">
                <svg className="w-8 h-8 animate-spin mr-3 text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 18A8 8 0 1 0 7 19l-4-4"></path><path d="M4 13v-2"></path><path d="M17 19h-2l-4-4"></path></svg>
                <p>Initializing dashboard and loading external libraries...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
            <style>{`.gauges-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; } .gauge-wrapper canvas { max-width: 100% !important; height: auto !important; } @media (min-width: 768px) { .gauges-container { grid-template-columns: repeat(4, 1fr); } }`}</style>
            
            <header className="mb-10 p-5 bg-slate-800 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center border-b-4 border-emerald-500/50">
                <h1 className="text-4xl font-extrabold text-emerald-400 mb-2 md:mb-0 tracking-tight">Smart Farm Monitor</h1>
                <div className="flex items-center text-md font-medium text-slate-400 bg-slate-900 px-5 py-2.5 rounded-xl shadow-inner border border-slate-700/50">
                    <svg className="w-5 h-5 mr-3 text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>{currentTime}</span>
                </div>
            </header>

            <main className="space-y-10">
                <div className="p-2 bg-slate-800 rounded-xl shadow-2xl border border-slate-700/50">
                    <h3 className='text-xl text-center font-bold p-2 text-slate-300'>Live Data Test (Auto Mode Only)</h3>
                </div>
                
                {fetchError && (
                    <div className="p-4 bg-red-800/50 text-red-300 rounded-xl border border-red-700 font-semibold flex items-center justify-center">
                        <svg className="h-6 w-6 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {fetchError}
                    </div>
                )}

                {/* Status Grid Section (Dynamic Data) */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Rain */}
                    <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-emerald-600/70">
                        <h3 className="text-lg font-semibold mb-1 text-slate-300">Rain Sensor</h3>
                        <p className="text-3xl font-black mb-1 text-slate-50">{liveData.rain.toFixed(1)} mm/hr</p>
                        <p className={`text-sm ${liveData.rain > 0 ? 'text-yellow-400' : 'text-emerald-400'} font-bold`}>{liveData.rain > 0 ? 'STATUS: Rain Detected' : 'STATUS: Clear'}</p>
                    </article>
                    {/* Pressure */}
                    <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-purple-600/70">
                        <h3 className="text-lg font-semibold mb-1 text-slate-300">Barometric Pressure</h3>
                        <p className="text-3xl font-black mb-1 text-slate-50">{liveData.pressure.toFixed(1)} hPa</p>
                        <p className={`text-sm ${liveData.pressure < 990 ? 'text-red-400' : 'text-emerald-400'} font-bold`}>{liveData.pressure < 990 ? 'WARNING: Low Pressure' : 'STATUS: Normal Pressure'}</p>
                    </article>
                    {/* Water Level */}
                    <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-sky-600/70">
                        <h3 className="text-lg font-semibold mb-1 text-slate-300">Water Level (Tank)</h3>
                        <p className="text-3xl font-black mb-1 text-slate-50">{liveData.waterLevel.toFixed(1)}%</p>
                        <p className={`text-sm ${liveData.waterLevel < 30 ? 'text-yellow-400' : 'text-emerald-400'} font-bold`}>{liveData.waterLevel < 30 ? 'STATUS: Level Low' : 'STATUS: Optimal'}</p>
                    </article>
                    {/* Soil Moisture */}
                    <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-orange-600/70">
                        <h3 className="text-lg font-semibold mb-1 text-slate-300">Soil Moisture</h3>
                        <p className="text-3xl font-black mb-1 text-slate-50">{liveData.soil.toFixed(1)}%</p>
                        <p className={`text-sm ${liveData.soil < 30 ? 'text-red-400' : 'text-emerald-400'} font-bold`}>{liveData.soil < 30 ? 'ALERT: Soil is Dry' : 'STATUS: Optimal Moisture'}</p>
                    </article>
                </section>

                {/* Main Content Section - Gauges */}
                <section className="grid grid-cols-1 gap-8 md:grid-cols-1">
                    <article className="card p-6 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
                        <h3 className="text-2xl font-bold mb-6 text-slate-200 border-b border-slate-700 pb-2">Live Sensor Readings (Gauges)</h3>
                        <div className="gauges-container">
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeRain" ref={gaugeRefs.rain} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-lg font-semibold text-slate-300">Rain</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugePressure" ref={gaugeRefs.pressure} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-lg font-semibold text-slate-300">Pressure</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeWaterLevel" ref={gaugeRefs.waterLevel} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-lg font-semibold text-slate-300">Water Level</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeSoil" ref={gaugeRefs.soil} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-lg font-semibold text-slate-300">Soil Moisture</p>
                            </div>
                        </div>
                    </article>
                </section>
            </main>
        </div>
    );
}

export default App;