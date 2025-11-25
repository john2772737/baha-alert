import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// --- Initial Data Structure ---
const initialSensorData = {
    pressure: 1012.0,       
    rainRaw: 1023,          
    soilRaw: 500,           
    waterDistanceCM: 50.0   
};

// Real API Endpoint provided by the user
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

// Define timing constant
const FETCH_INTERVAL_MS = 5000; // 5 seconds

// Helper function to get the current formatted time
const getFormattedTime = () => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- MAPPINGS FOR GAUGE VALUES ---
const STATE_MAPPINGS = {
    rain: (rainRaw) => {
        const mapped = 50 - (rainRaw / 1023.0 * 50); 
        return Math.min(50, Math.max(0, mapped));
    },
    soil: (soilRaw) => {
        const mapped = 100 - (soilRaw / 1023.0 * 100);
        return Math.min(100, Math.max(0, mapped));
    },
    waterTank: (distanceCM) => {
        const percentageFull = 100.0 - (distanceCM / 50.0) * 100.0;
        return Math.min(100, Math.max(0, percentageFull));
    }
};

// --- Main App Component ---
const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [fetchError, setFetchError] = useState(null); 
    
    // System mode control
    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];

    // State variables
    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState('Loading...');
    
    // 🌟 Historical Data State
    const [historyData, setHistoryData] = useState([]); 
    
    // Refs
    const lastIdRef = useRef(null); 
    const rainGaugeRef = useRef(null);
    const pressureGaugeRef = useRef(null);
    const soilGaugeRef = useRef(null);
    const waterTankGaugeRef = useRef(null); 
    const historyChartRef = useRef(null);
    
    // Instance Refs (to hold Chart/Gauge objects between renders)
    const gaugeInstances = useRef({});
    const chartInstance = useRef(null);

    // --- 1. SETUP & SCRIPTS ---
    useEffect(() => {
        setIsClient(true);
        setCurrentTime(getFormattedTime());
        
        const cdnUrls = [
            "https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js",
            "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
            "https://cdn.tailwindcss.com",
        ];

        const loadScript = (url) => {
            return new Promise(resolve => {
                if (document.querySelector(`script[src="${url}"]`)) return resolve();
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onload = resolve;
                if (url.includes('tailwindcss')) document.head.prepend(script);
                else document.head.appendChild(script);
                if (url.includes('tailwindcss')) resolve();
            });
        };

        Promise.all(cdnUrls.map(loadScript)).then(() => {
            if (window.Gauge && window.Chart) setScriptsLoaded(true);
        });

        const timeInterval = setInterval(() => setCurrentTime(getFormattedTime()), 10000);
        return () => clearInterval(timeInterval);
    }, []);

    // --- 2. STATUS HELPERS ---
    const getRainStatus = (rainRaw) => {
        if (rainRaw >= 600) return { reading: 'Completely Dry (No Rain)', status: 'STATUS: Clear', className: 'text-emerald-400 font-bold' };
        if (rainRaw >= 400) return { reading: 'Light Rain / Few Drops', status: 'STATUS: Light Rainfall', className: 'text-yellow-400 font-bold' };
        if (rainRaw >= 200) return { reading: 'Moderate Rain', status: 'STATUS: Moderate Rainfall', className: 'text-orange-400 font-bold' };
        return { reading: 'Heavy Rain / Wet', status: 'ALERT: Heavy Rainfall!', className: 'text-red-400 font-bold' };
    };
    
    const getSoilStatus = (soilRaw) => {
        if (soilRaw > 600) return { reading: 'Dry', status: 'ALERT: Soil is Dry!', className: 'text-red-400 font-bold' };
        return { reading: 'Wet', status: 'WARNING: Soil is Wet!', className: 'text-yellow-400 font-bold' };
    };
    
    const getWaterTankStatus = (distanceCM) => {
        if (distanceCM <= 10) return { reading: 'Above Normal', status: 'WARNING: Potential Overflow!', className: 'text-yellow-400 font-bold' };
        if (distanceCM <= 25) return { reading: 'Normal', status: 'STATUS: Level Optimal', className: 'text-emerald-400 font-bold' };
        return { reading: 'Below Normal', status: 'ALERT: Tank is Low!', className: 'text-red-400 font-bold' };
    };
    
    const getPressureStatus = (pressure) => {
        if (pressure < 990) return { status: 'WARNING: Low Pressure!', className: 'text-red-400 font-bold' };
        if (pressure > 1030) return { status: 'STATUS: High Pressure', className: 'text-yellow-400 font-bold' };
        return { status: 'STATUS: Normal Pressure', className: 'text-emerald-400 font-bold' };
    };
    
    const rainStatus = useMemo(() => getRainStatus(liveData.rainRaw), [liveData.rainRaw]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);
    const soilStatus = useMemo(() => getSoilStatus(liveData.soilRaw), [liveData.soilRaw]);
    const waterTankStatus = useMemo(() => getWaterTankStatus(liveData.waterDistanceCM), [liveData.waterDistanceCM]);

    // --- 3. DATA FETCHING (LIVE & HISTORY) ---
    
    // Fetch Live Data
    const fetchSensorData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;
        try {
            const response = await fetch(REAL_API_ENDPOINT); 
            const result = await response.json();
            if (!result.success || !result.data) return;

            const payload = result.data.payload;
            if (lastIdRef.current !== result.data._id) lastIdRef.current = result.data._id;

            setLiveData(prev => ({
                pressure: parseFloat(payload.pressure) || prev.pressure,
                rainRaw: parseInt(payload.rain, 10) || prev.rainRaw,
                soilRaw: parseInt(payload.soil, 10) || prev.soilRaw,
                waterDistanceCM: parseFloat(payload.waterDistanceCM) || prev.waterDistanceCM,
            }));
            setFetchError(null);
        } catch (error) {
            setFetchError("Connection Error");
        }
    }, [isClient, mode]);

    // Fetch Historical Data (7-Day)
    const fetchHistoryData = useCallback(async () => {
        if (!isClient) return;
        try {
            const response = await fetch(`${REAL_API_ENDPOINT}?history=true`);
            if (!response.ok) throw new Error("Failed to fetch history");
            const result = await response.json();
            
            if (result.success && Array.isArray(result.data)) {
                console.log("History Data Received:", result.data);
                setHistoryData(result.data);
            }
        } catch (error) {
            console.error("History Error:", error);
        }
    }, [isClient]);

    // Intervals
    useEffect(() => {
        fetchSensorData();
        fetchHistoryData(); // Fetch history initially
        const interval = setInterval(fetchSensorData, FETCH_INTERVAL_MS); 
        // Optional: Refresh history every minute
        const historyInterval = setInterval(fetchHistoryData, 60000);
        return () => {
            clearInterval(interval);
            clearInterval(historyInterval);
        };
    }, [fetchSensorData, fetchHistoryData]); 


    // --- 4. INITIALIZATION LOGIC ---

    // 4a. Initialize/Update Gauges (Runs once or when refs ready)
    useEffect(() => {
        if (!isClient || !scriptsLoaded || mode !== 'Auto') return;
        if (!rainGaugeRef.current || !pressureGaugeRef.current || !soilGaugeRef.current || !waterTankGaugeRef.current) return;

        const Gauge = window.Gauge;
        if (!Gauge) return;

        const gaugeOptions = {
            angle: 0.15, lineWidth: 0.25, radiusScale: 0.9,
            pointer: { length: 0.6, strokeWidth: 0.045, color: '#f3f4f6' }, 
            staticLabels: { font: "12px sans-serif", labels: [], color: '#9ca3af' },
            staticZones: [], limitMax: false, limitMin: false, highDpiSupport: true,
            strokeColor: '#374151', generateGradient: true,
            gradientStop: [['#10b981', 0.25], ['#f59e0b', 0.5], ['#ef4444', 0.75]]
        };

        const createGauge = (ref, max, min, labels, zones) => {
            if (!ref.current) return null;
            const options = JSON.parse(JSON.stringify(gaugeOptions));
            options.staticLabels.labels = labels;
            options.staticZones = zones;
            const gauge = new Gauge(ref.current).setOptions(options);
            gauge.maxValue = max; gauge.setMinValue(min);
            return gauge;
        };

        // Create Gauges if they don't exist
        if (!gaugeInstances.current.rain) {
            gaugeInstances.current.rain = createGauge(rainGaugeRef, 50, 0, [0, 10, 20, 30, 40, 50], [{strokeStyle: "#10b981", min: 0, max: 10}, {strokeStyle: "#f59e0b", min: 10, max: 30}, {strokeStyle: "#ef4444", min: 30, max: 50}]);
            gaugeInstances.current.pressure = createGauge(pressureGaugeRef, 1050, 950, [950, 980, 1010, 1040, 1050], [{strokeStyle: "#f59e0b", min: 950, max: 980}, {strokeStyle: "#10b981", min: 980, max: 1040}, {strokeStyle: "#f59e0b", min: 1040, max: 1050}]);
            gaugeInstances.current.waterTank = createGauge(waterTankGaugeRef, 100, 0, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 35}, {strokeStyle: "#10b981", min: 35, max: 65}, {strokeStyle: "#f59e0b", min: 65, max: 100}]);
            gaugeInstances.current.soil = createGauge(soilGaugeRef, 100, 0, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 70}, {strokeStyle: "#f59e0b", min: 70, max: 100}]);
        }

        // Update Values
        if (gaugeInstances.current.rain) gaugeInstances.current.rain.set(STATE_MAPPINGS.rain(liveData.rainRaw));
        if (gaugeInstances.current.pressure && liveData.pressure > 100) gaugeInstances.current.pressure.set(liveData.pressure);
        if (gaugeInstances.current.waterTank) gaugeInstances.current.waterTank.set(STATE_MAPPINGS.waterTank(liveData.waterDistanceCM));
        if (gaugeInstances.current.soil) gaugeInstances.current.soil.set(STATE_MAPPINGS.soil(liveData.soilRaw));

    }, [isClient, scriptsLoaded, mode, liveData]);


    // 4b. Initialize/Update Chart (Runs whenever historyData changes)
    useEffect(() => {
        if (!isClient || !scriptsLoaded || mode !== 'Auto') return;
        if (!historyChartRef.current || typeof window.Chart === 'undefined') return;

        const Chart = window.Chart;

        // Process Data
        let labels = [];
        let rainData = [];
        let pressureData = [];
        let soilData = [];
        let waterData = [];
        // Arrays to hold original RAW values for tooltips
        let rawRainValues = [];
        let rawPressureValues = [];
        let rawWaterValues = [];

        if (historyData && historyData.length > 0) {
            labels = historyData.map(item => {
                const date = new Date(item._id);
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            });

            // 🌟 NORMALIZE DATA FOR UNIFIED GRAPH (0-100 Scale)
            
            // Rain: Raw 0-1023. Display relative "wetness" or just raw scaled. 
            // Using raw scaled: (val / 1023 * 100)
            rainData = historyData.map(item => {
                rawRainValues.push(item.avgRain || 0);
                return ((item.avgRain || 0) / 1023.0) * 100;
            });

            // Pressure: 950-1050. Normalize: (val - 950) to fit 0-100 range approx
            pressureData = historyData.map(item => {
                rawPressureValues.push(item.avgPressure || 0);
                return (item.avgPressure - 950) > 0 ? (item.avgPressure - 950) : 0;
            });

            // Soil: Already % derived from raw.
            soilData = historyData.map(item => Math.round(100 - ((item.avgSoil || 0) / 1023.0 * 100)));

            // Water: 0-50cm. Fullness %.
            waterData = historyData.map(item => {
                rawWaterValues.push(item.avgWaterDistance || 0);
                const percent = 100.0 - ((item.avgWaterDistance || 0) / 50.0) * 100.0;
                return Math.min(100, Math.max(0, percent));
            });

        } else {
            labels = ['No Data'];
        }

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const ctx = historyChartRef.current.getContext('2d');
        const chartTextColor = '#e2e8f0';

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    // 🌟 Unified Scale Datasets (All Normalized 0-100)
                    { 
                        label: 'Rain', 
                        data: rainData, 
                        borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                        tension: 0.3, pointRadius: 5, // 🌟 Points visible
                        rawValues: rawRainValues // Custom prop for tooltip
                    },
                    { 
                        label: 'Pressure', 
                        data: pressureData, 
                        borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 0.1)', 
                        tension: 0.3, pointRadius: 5,
                        rawValues: rawPressureValues
                    },
                    { 
                        label: 'Soil Moist.', 
                        data: soilData, 
                        borderColor: 'rgba(132, 204, 22, 1)', backgroundColor: 'rgba(132, 204, 22, 0.1)', 
                        fill: true, tension: 0.3, pointRadius: 5 
                    },
                    { 
                        label: 'Water Lvl', 
                        data: waterData, 
                        borderColor: 'rgba(6, 182, 212, 1)', backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                        tension: 0.3, pointRadius: 5,
                        rawValues: rawWaterValues
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(75, 85, 99, 0.3)' }, ticks: { color: chartTextColor } },
                    // 🌟 SINGLE UNIFIED Y-AXIS
                    y: { 
                        type: 'linear', position: 'left', min: 0, max: 100, 
                        grid: { color: 'rgba(75, 85, 99, 0.3)' }, 
                        ticks: { color: chartTextColor, callback: (v) => v + '%' },
                        title: { display: true, text: 'Normalized Scale (%)', color: chartTextColor }
                    }
                },
                plugins: { 
                    legend: { labels: { color: chartTextColor } },
                    tooltip: {
                        callbacks: {
                            // 🌟 CUSTOM TOOLTIP: Show original values
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const rawValArray = context.dataset.rawValues;
                                let val = context.raw; // Normalized value by default

                                if (label === 'Pressure' && rawValArray) {
                                    return `${label}: ${rawValArray[context.dataIndex].toFixed(1)} hPa`;
                                }
                                if (label === 'Rain' && rawValArray) {
                                    return `${label}: ${rawValArray[context.dataIndex]} (Raw)`;
                                }
                                if (label === 'Water Lvl' && rawValArray) {
                                    return `${label}: ${rawValArray[context.dataIndex].toFixed(1)} cm`;
                                }
                                return `${label}: ${Math.round(val)}%`;
                            }
                        }
                    }
                }
            }
        });

    }, [isClient, scriptsLoaded, mode, historyData]); 


    // --- ICONS ---
    const ClockIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
    const CloudRainIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 20v-3"></path><path d="M8 20v-3"></path><path d="M12 18v-3"></path></svg>);
    const GaugeIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"></path><path d="M9 13l3 3 3-3"></path></svg>);
    const LeafIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A10 10 0 0 0 2 11c0-4 4-4 8-8 3 0 4 3 4 5 0 2-3 5-3 5l-1 1 1 1c1.5 1.5 3.5 1.5 5 0l1-1c3 0 5 3 5 5 0 3-4 5-8 5z"></path></svg>);
    const RefreshCcwIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 18A8 8 0 1 0 7 19l-4-4"></path><path d="M4 13v-2"></path><path d="M17 19h-2l-4-4"></path></svg>);
    const BoxIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><path d="M3.27 6.3L12 11.5l8.73-5.2"></path><path d="M12 22.78V11.5"></path></svg>);

    if (!isClient || !scriptsLoaded) return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-400 font-inter"><RefreshCcwIcon className="w-8 h-8 animate-spin mr-3 text-emerald-400" /><p>Initializing dashboard...</p></div>;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
            <style>{`
                .chart-container { position: relative; height: 55vh; width: 100%; }
                .gauges-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }
                .gauge-wrapper canvas { max-width: 100% !important; height: auto !important; }
                @media (min-width: 768px) { 
                    .gauges-container { grid-template-columns: repeat(4, 1fr); } 
                    .chart-container { height: 450px; }
                }
                .gauge-text { font-size: 1rem; min-height: 2.5rem; display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 0.5rem; }
            `}</style>
            
            <header className="mb-10 p-5 bg-slate-800 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center border-b-4 border-emerald-500/50">
                <h1 className="text-4xl font-extrabold text-emerald-400 mb-2 md:mb-0 tracking-tight">Smart Farm Monitor</h1>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center text-md font-medium text-slate-400 bg-slate-900 px-5 py-2.5 rounded-xl shadow-inner border border-slate-700/50">
                        <ClockIcon className="w-5 h-5 mr-3 text-indigo-400" /><span id="current-time">{currentTime}</span>
                    </div>
                </div>
            </header>

            <main className="space-y-10">
                <div className="flex justify-center bg-slate-800 p-2 rounded-xl shadow-2xl border border-slate-700/50">
                    {modes.map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`px-6 py-3 text-lg font-bold rounded-xl transition duration-300 w-full md:w-1/3 mx-1 ${mode === m ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/50' : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{m}</button>
                    ))}
                </div>
                
                {mode === 'Auto' && (
                    <>
                        {fetchError && <div className="p-4 bg-red-800/50 text-red-300 rounded-xl border border-red-700 font-semibold flex items-center justify-center">{fetchError}</div>}

                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-emerald-600/70 h-full">
                                <CloudRainIcon className="w-10 h-10 mb-3 text-sky-400 p-2 bg-sky-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Rain Sensor</h3>
                                <p className={`text-sm font-bold ${rainStatus.className}`}>{rainStatus.status}</p>
                            </article>

                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-purple-600/70 h-full">
                                <GaugeIcon className="w-10 h-10 mb-3 text-purple-400 p-2 bg-purple-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Barometric Pressure</h3>
                                <p className={`text-sm font-bold ${pressureStatus.className}`}>{pressureStatus.status.split(': ')[1] || pressureStatus.status}</p>
                                <p className={`text-sm text-slate-400`}>({liveData.pressure.toFixed(1)} hPa)</p>
                            </article>
                            
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-cyan-600/70 h-full">
                                <BoxIcon className="w-10 h-10 mb-3 text-cyan-400 p-2 bg-cyan-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Water Level</h3>
                                <p className={`text-sm font-bold ${waterTankStatus.className}`}>{waterTankStatus.status}</p>
                            </article>

                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 hover:border-orange-600/70 h-full">
                                <LeafIcon className="w-10 h-10 mb-3 text-orange-400 p-2 bg-orange-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Soil Moisture</h3>
                                <p className={`text-sm font-bold ${soilStatus.className}`}>{soilStatus.status}</p>
                            </article>
                        </section>
                        
                        <section className="grid grid-cols-1 gap-8 md:grid-cols-1">
                            <article className="card p-6 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
                                <h3 className="text-2xl font-bold mb-6 text-slate-200 border-b border-slate-700 pb-2">7-Day Historical Trends (Chart)</h3>
                                <div className="chart-container">
                                    <canvas id="historyChart" ref={historyChartRef}></canvas>
                                </div>
                            </article>

                            <article className="card p-6 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
                                <h3 className="text-2xl font-bold mb-6 text-slate-200 border-b border-slate-700 pb-2">Live Sensor Readings (Gauges)</h3>
                                <div className="gauges-container">
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeRain" ref={rainGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300 gauge-text">
                                            <span className="text-sm text-slate-400">Rain Sensor</span>
                                            <span className="text-xl text-sky-400 font-bold">{liveData.rainRaw}</span>
                                        </p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugePressure" ref={pressureGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300 gauge-text">
                                            <span className="text-sm text-slate-400">Barometric Pressure</span>
                                            <span className="text-xl text-purple-400 font-bold">{liveData.pressure.toFixed(1)} hPa</span>
                                        </p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeWaterTank" ref={waterTankGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300 gauge-text">
                                            <span className="text-sm text-slate-400">Ultrasonic Sensor</span>
                                            <span className="text-xl text-cyan-400 font-bold">{liveData.waterDistanceCM.toFixed(1)} cm</span>
                                        </p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeSoil" ref={soilGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300 gauge-text">
                                            <span className="text-sm text-slate-400">Soil Moisture Sensor</span>
                                            <span className="text-xl text-orange-400 font-bold">{liveData.soilRaw}</span>
                                        </p>
                                    </div>
                                </div>
                            </article>
                        </section>
                    </>
                )}

                {mode !== 'Auto' && (
                    <div className="p-16 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 text-center flex flex-col items-center justify-center min-h-[50vh]">
                        <RefreshCcwIcon className={`w-16 h-16 mb-6 ${mode === 'Maintenance' ? 'text-yellow-400 animate-spin' : 'text-gray-500'}`} />
                        <h3 className="text-4xl font-extrabold mb-4 text-emerald-400">System Mode: <span className={mode === 'Maintenance' ? 'text-yellow-400' : 'text-gray-400'}>{mode}</span></h3>
                        <p className="text-slate-300 text-lg max-w-xl">The system is currently in **{mode} Mode**. Automatic monitoring and control systems are temporarily suspended. Please switch back to **Auto** to resume live data streaming.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;