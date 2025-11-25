import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// --- Initial Data Structure ---
const initialSensorData = {
    pressure: 1012.0,       // hPa
    rainRaw: 1023,          // Analog value (1023 = dry, 0 = wet)
    soilRaw: 1023,          // Analog value (1023 = dry, 0 = wet)
    waterDistanceCM: 50.0,  // Ultrasonic distance (cm)
    deviceMode: '---'       // Mode reported by hardware
};

const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 
const FETCH_INTERVAL_MS = 1000;

// Helper for formatted time
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

// **********************************************
// * MAPPING LOGIC (Raw -> Percentage 0-100%) *
// **********************************************
const STATE_MAPPINGS = {
    // Rain: Maps 1023 (Dry) -> 0% to 0 (Wet) -> 100%
    rain: (rainRaw) => {
        const val = 100 - (rainRaw / 1023.0 * 100); 
        return Math.min(100, Math.max(0, Math.round(val)));
    },
    // Soil: Maps 1023 (Dry) -> 0% to 0 (Wet) -> 100%
    soil: (soilRaw) => {
        const val = 100 - (soilRaw / 1023.0 * 100);
        return Math.min(100, Math.max(0, Math.round(val)));
    },
    // Water Tank: Maps 50cm (Empty) -> 0% to 0cm (Full) -> 100%
    waterTank: (distanceCM) => {
        // If distance is massive (error code 999), return 0%
        if (distanceCM > 100) return 0;
        
        const maxDistance = 50.0;
        const val = 100.0 - (distanceCM / maxDistance) * 100.0;
        return Math.min(100, Math.max(0, Math.round(val)));
    }
};

const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [fetchError, setFetchError] = useState(null); 
    const [mode, setMode] = useState('Auto'); // UI Mode (fetching control)
    const modes = ['Auto', 'Maintenance', 'Sleep'];

    const [liveData, setLiveData] = useState(initialSensorData);
    const [historyData, setHistoryData] = useState([]); // State for graph data
    const [currentTime, setCurrentTime] = useState('Loading...');
    
    // Refs
    const lastIdRef = useRef(null); 
    const isDashboardInitializedRef = useRef(false);
    const rainGaugeRef = useRef(null);
    const pressureGaugeRef = useRef(null);
    const soilGaugeRef = useRef(null);
    const waterTankGaugeRef = useRef(null); 
    const historyChartRef = useRef(null);
    const gaugeInstances = useRef({});

    // === Calculated Percentages for UI ===
    const rainPercent = useMemo(() => STATE_MAPPINGS.rain(liveData.rainRaw), [liveData.rainRaw]);
    const soilPercent = useMemo(() => STATE_MAPPINGS.soil(liveData.soilRaw), [liveData.soilRaw]);
    const waterPercent = useMemo(() => STATE_MAPPINGS.waterTank(liveData.waterDistanceCM), [liveData.waterDistanceCM]);

    // === Client Init ===
    useEffect(() => {
        setIsClient(true);
        setCurrentTime(getFormattedTime());
        
        const cdnUrls = [
            "https://unpkg.com/react@18/umd/react.production.min.js",
            "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
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

        Promise.all(cdnUrls.map(loadScript))
            .then(() => {
                if (window.Gauge && window.Chart) setScriptsLoaded(true);
            });

        const timeInterval = setInterval(() => setCurrentTime(getFormattedTime()), 10000);
        return () => clearInterval(timeInterval);
    }, []);

    // === Status Logic (UPDATED FOR WEATHER STATION THEME) ===
    const getRainStatus = (percent) => {
        if (percent < 10) return { reading: 'No Rain', status: 'STATUS: Clear', className: 'text-emerald-400 font-bold' };
        if (percent >= 10 && percent < 40) return { reading: 'Light Rain', status: 'STATUS: Drizzling', className: 'text-yellow-400 font-bold' };
        if (percent >= 40 && percent < 70) return { reading: 'Moderate Rain', status: 'STATUS: Raining', className: 'text-orange-400 font-bold' };
        return { reading: 'Heavy Rain', status: 'ALERT: Storm Conditions', className: 'text-red-400 font-bold' };
    };
    
    const getSoilStatus = (percent) => {
        if (percent < 10) return { reading: 'Dry', status: 'STATUS: Low Moisture', className: 'text-red-400 font-bold' };
        if (percent >= 10 && percent < 30) return { reading: 'Low', status: 'STATUS: Slightly Damp', className: 'text-yellow-400 font-bold' };
        if (percent >= 30 && percent < 80) return { reading: 'Moist', status: 'STATUS: Normal', className: 'text-emerald-400 font-bold' };
        return { reading: 'Saturated', status: 'STATUS: High Moisture', className: 'text-emerald-400 font-bold' };
    };
    
    const getWaterTankStatus = (percent, distance) => {
        if (distance >= 400) {
            return { reading: 'Error', status: 'SENSOR ERROR', className: 'text-red-500 font-black animate-pulse' };
        }
        
        if (percent > 90) return { reading: 'High', status: 'STATUS: High Capacity', className: 'text-yellow-400 font-bold' };
        if (percent >= 40) return { reading: 'Normal', status: 'STATUS: Stable Level', className: 'text-emerald-400 font-bold' };
        return { reading: 'Low', status: 'STATUS: Low Reserves', className: 'text-red-400 font-bold' };
    };
    
    const getPressureStatus = (pressure) => {
        if (pressure < 990) return { status: 'WARNING: Low Pressure', className: 'text-red-400 font-bold' };
        if (pressure > 1030) return { status: 'STATUS: High Pressure', className: 'text-yellow-400 font-bold' };
        return { status: 'STATUS: Stable', className: 'text-emerald-400 font-bold' };
    };
    
    const rainStatus = useMemo(() => getRainStatus(rainPercent), [rainPercent]);
    const soilStatus = useMemo(() => getSoilStatus(soilPercent), [soilPercent]);
    const waterTankStatus = useMemo(() => getWaterTankStatus(waterPercent, liveData.waterDistanceCM), [waterPercent, liveData.waterDistanceCM]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);

    // === Dashboard Initialization ===
    const initializeDashboard = useCallback(() => {
        if (!isClient || !scriptsLoaded || typeof window.Gauge === 'undefined' || typeof window.Chart === 'undefined') return;
        if (mode !== 'Auto') return;
        if (!rainGaugeRef.current || !pressureGaugeRef.current || !soilGaugeRef.current || !waterTankGaugeRef.current || !historyChartRef.current) return;

        const Gauge = window.Gauge;
        const Chart = window.Chart;

        try {
            if (gaugeInstances.current.chart) {
                gaugeInstances.current.chart.destroy();
                gaugeInstances.current.chart = null;
            }
        } catch(e) {}
        
        const baseOptions = {
            angle: 0.15, lineWidth: 0.25, radiusScale: 0.9,
            pointer: { length: 0.6, strokeWidth: 0.045, color: '#f3f4f6' }, 
            staticLabels: { font: "12px sans-serif", labels: [], color: '#9ca3af' },
            staticZones: [],
            limitMax: true, limitMin: true, highDpiSupport: true,
            strokeColor: '#374151',
            generateGradient: true,
        };

        const initGauge = (ref, max, min, initialVal, labels, zones) => {
            if (ref.current) {
                const options = JSON.parse(JSON.stringify(baseOptions));
                options.staticLabels.labels = labels;
                options.staticZones = zones;
                const gauge = new Gauge(ref.current).setOptions(options);
                gauge.maxValue = max;
                gauge.setMinValue(min);
                gauge.set(initialVal);
                return gauge;
            }
        };
        
        // 1. Rain Gauge (0-100%)
        gaugeInstances.current.rain = initGauge(
            rainGaugeRef, 100, 0, rainPercent, 
            [0, 25, 50, 75, 100],
            [{strokeStyle: "#10b981", min: 0, max: 20}, {strokeStyle: "#f59e0b", min: 20, max: 60}, {strokeStyle: "#ef4444", min: 60, max: 100}]
        );

        // 2. Pressure Gauge (hPa)
        gaugeInstances.current.pressure = initGauge(
            pressureGaugeRef, 1050, 950, liveData.pressure, 
            [950, 975, 1000, 1025, 1050],
            [{strokeStyle: "#f59e0b", min: 950, max: 980}, {strokeStyle: "#10b981", min: 980, max: 1040}, {strokeStyle: "#f59e0b", min: 1040, max: 1050}]
        );

        // 3. Water Tank Gauge (0-100%)
        gaugeInstances.current.waterTank = initGauge(
            waterTankGaugeRef, 100, 0, waterPercent, 
            [0, 25, 50, 75, 100],
            [{strokeStyle: "#ef4444", min: 0, max: 20}, {strokeStyle: "#f59e0b", min: 20, max: 50}, {strokeStyle: "#10b981", min: 50, max: 90}, {strokeStyle: "#ef4444", min: 90, max: 100}] 
        );

        // 4. Soil Moisture Gauge (0-100%)
        gaugeInstances.current.soil = initGauge(
            soilGaugeRef, 100, 0, soilPercent,
            [0, 25, 50, 75, 100],
            [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 70}, {strokeStyle: "#f59e0b", min: 70, max: 100}]
        );

        // Chart Init with DYNAMIC HISTORY
        if (historyChartRef.current) {
            const chartTextColor = '#e2e8f0'; 
            
            // Default to empty arrays if no history yet
            const labels = historyData.length > 0 ? historyData.map(d => d.day) : ['No Data'];
            const rainData = historyData.length > 0 ? historyData.map(d => d.rain) : [0];
            const soilData = historyData.length > 0 ? historyData.map(d => d.soil) : [0];
            const waterData = historyData.length > 0 ? historyData.map(d => d.water) : [0];
            const pressureData = historyData.length > 0 ? historyData.map(d => d.pressure) : [0];

            gaugeInstances.current.chart = new Chart(historyChartRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { 
                            label: 'Rain Wetness (%)', 
                            data: rainData, 
                            borderColor: '#3b82f6', 
                            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                            fill: true, 
                            tension: 0.4, 
                            yAxisID: 'yPercent',
                            pointRadius: 6,
                            pointHoverRadius: 8
                        },
                        { 
                            label: 'Soil Moisture (%)', 
                            data: soilData, 
                            borderColor: '#84cc16', 
                            backgroundColor: 'rgba(132, 204, 22, 0.1)', 
                            fill: false, 
                            tension: 0.4, 
                            yAxisID: 'yPercent',
                            pointRadius: 6,
                            pointHoverRadius: 8
                        },
                        { 
                            label: 'Water Level (%)', 
                            data: waterData, 
                            borderColor: '#06b6d4', // Cyan for Water
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',
                            fill: false, 
                            tension: 0.4, 
                            yAxisID: 'yPercent',
                            pointRadius: 6,
                            pointHoverRadius: 8
                        },
                        { 
                            label: 'Pressure (hPa)', 
                            data: pressureData, 
                            borderColor: '#a855f7', 
                            backgroundColor: 'transparent', 
                            fill: false, 
                            tension: 0.4, 
                            yAxisID: 'yPressure',
                            pointRadius: 6,
                            pointHoverRadius: 8
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    // Combine all data points for a specific index (day) into one tooltip
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        x: { grid: { color: '#374151' }, ticks: { color: chartTextColor } },
                        yPercent: { type: 'linear', position: 'left', min: 0, max: 100, ticks: { callback: v => v + '%', color: chartTextColor } },
                        yPressure: { type: 'linear', position: 'right', min: 950, max: 1050, grid: { display: false }, ticks: { callback: v => v + ' hPa', color: chartTextColor } }
                    },
                    plugins: { 
                        legend: { labels: { color: chartTextColor } },
                        tooltip: {
                             backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                             titleColor: '#10b981',
                             bodyColor: '#f3f4f6',
                             borderColor: '#374151',
                             borderWidth: 1,
                             padding: 10
                        }
                    }
                }
            });
            isDashboardInitializedRef.current = true;
        }
    }, [isClient, scriptsLoaded, mode, liveData.pressure, rainPercent, soilPercent, waterPercent, historyData]);

    // === Data Fetching: Live ===
    const fetchSensorData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;
        
        try {
            const response = await fetch(REAL_API_ENDPOINT); 
            if (!response.ok) throw new Error("HTTP error");
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.payload) throw new Error("Invalid structure");

            const payload = result.data.payload;
            const newId = result.data._id;

            if (lastIdRef.current !== newId) {
                lastIdRef.current = newId;
                console.log("New Data:", payload);
            }

            setLiveData(prev => ({
                pressure: parseFloat(payload.pressure) || prev.pressure,
                rainRaw: parseInt(payload.rain, 10) || prev.rainRaw,
                soilRaw: parseInt(payload.soil, 10) || prev.soilRaw,
                waterDistanceCM: parseFloat(payload.waterDistanceCM) || prev.waterDistanceCM,
                deviceMode: payload.mode || prev.deviceMode 
            }));
            
            setFetchError(null); 
        } catch (error) {
            console.error("Fetch error:", error);
            setFetchError(`Connection Error`);
        }
    }, [isClient, mode]);

    // === Data Fetching: History ===
    const fetchHistoryData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;
        
        try {
            const response = await fetch(`${REAL_API_ENDPOINT}?history=true`);
            if (!response.ok) throw new Error("History fetch failed");
            const result = await response.json();
            
            if (result.success && Array.isArray(result.data)) {
                console.log("History Data Received:", result.data);
                
                const processed = result.data.map(item => {
                    const dateObj = new Date(item._id);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }); 
                    
                    return {
                        day: dayName,
                        rain: STATE_MAPPINGS.rain(item.avgRain),
                        soil: STATE_MAPPINGS.soil(item.avgSoil),
                        // Calculate percentage for Water Level from distance
                        water: STATE_MAPPINGS.waterTank(item.avgWaterDistance),
                        pressure: item.avgPressure
                    };
                });
                setHistoryData(processed);
            }
        } catch (e) {
            console.error("History Error:", e);
        }
    }, [isClient, mode]);

    // Loop for Live Data
    useEffect(() => {
        fetchSensorData();
        const interval = setInterval(fetchSensorData, FETCH_INTERVAL_MS); 
        return () => clearInterval(interval);
    }, [fetchSensorData]); 

    // Initial Fetch for History
    useEffect(() => {
        fetchHistoryData();
    }, [fetchHistoryData]);

    // === Live Update Logic (Gauges Only) ===
    useEffect(() => {
        if (!isClient || !scriptsLoaded || mode !== 'Auto') {
            if (isDashboardInitializedRef.current) {
                try { if (gaugeInstances.current.chart) gaugeInstances.current.chart.destroy(); } catch(e) {}
                gaugeInstances.current = {};
                isDashboardInitializedRef.current = false;
            }
            return;
        }

        if (!isDashboardInitializedRef.current) {
            initializeDashboard(); 
            return; 
        } 
        
        requestAnimationFrame(() => {
            try {
                // Update Gauges with Percentages
                if (gaugeInstances.current.rain) gaugeInstances.current.rain.set(rainPercent);
                if (gaugeInstances.current.pressure && liveData.pressure > 800) gaugeInstances.current.pressure.set(liveData.pressure);
                if (gaugeInstances.current.waterTank) gaugeInstances.current.waterTank.set(waterPercent);
                if (gaugeInstances.current.soil) gaugeInstances.current.soil.set(soilPercent);
            } catch (e) {
                isDashboardInitializedRef.current = false; 
            }
        });

    }, [isClient, scriptsLoaded, mode, rainPercent, soilPercent, waterPercent, liveData.pressure, initializeDashboard]);

    // === CHART Update Logic (Reacts to History Data Fetch) ===
    useEffect(() => {
        if (isDashboardInitializedRef.current && gaugeInstances.current.chart && historyData.length > 0) {
            const chart = gaugeInstances.current.chart;
            chart.data.labels = historyData.map(d => d.day);
            chart.data.datasets[0].data = historyData.map(d => d.rain);
            chart.data.datasets[1].data = historyData.map(d => d.soil);
            // Ensure dataset indices match initialization order
            if(chart.data.datasets[2]) chart.data.datasets[2].data = historyData.map(d => d.water); 
            if(chart.data.datasets[3]) chart.data.datasets[3].data = historyData.map(d => d.pressure);
            chart.update();
        }
    }, [historyData]);

    // --- Icons ---
    const ClockIcon = (p) => (<svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
    const CloudRainIcon = (p) => (<svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 20v-3"></path><path d="M8 20v-3"></path><path d="M12 18v-3"></path></svg>);
    const GaugeIcon = (p) => (<svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"></path><path d="M9 13l3 3 3-3"></path></svg>);
    const LeafIcon = (p) => (<svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A10 10 0 0 0 2 11c0-4 4-4 8-8 3 0 4 3 4 5 0 2-3 5-3 5l-1 1 1 1c1.5 1.5 3.5 1.5 5 0l1-1c3 0 5 3 5 5 0 3-4 5-8 5z"></path></svg>);
    const RefreshCcwIcon = (p) => (<svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 18A8 8 0 1 0 7 19l-4-4"></path><path d="M4 13v-2"></path><path d="M17 19h-2l-4-4"></path></svg>);
    const BoxIcon = (p) => (<svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><path d="M3.27 6.3L12 11.5l8.73-5.2"></path><path d="M12 22.78V11.5"></path></svg>);
    const CpuIcon = (p) => (<svg {...p} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>);

    if (!isClient || !scriptsLoaded) return <div className="flex justify-center items-center h-screen bg-slate-900 text-emerald-400 font-inter"><RefreshCcwIcon className="animate-spin w-8 h-8 mr-2" /> Initializing...</div>;

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
                    {/* Device Mode Display */}
                    <div className="flex items-center text-xs text-slate-400 mt-1">
                        <CpuIcon className="w-3 h-3 mr-1" />
                        DEVICE MODE: <span className="text-emerald-300 ml-1 font-mono">{liveData.deviceMode}</span>
                    </div>
                </div>
                <div className="flex items-center text-slate-400 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 mt-4 md:mt-0">
                    <ClockIcon className="w-5 h-5 mr-2 text-indigo-400" />
                    <span>{currentTime}</span>
                </div>
            </header>

            <main className="space-y-8">
                <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                    {modes.map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === m ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{m}</button>
                    ))}
                </div>
                
                {mode === 'Auto' && (
                    <>
                        {fetchError && <div className="p-3 bg-red-900/30 text-red-300 rounded-lg border border-red-800 text-center font-semibold text-sm">{fetchError}</div>}

                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Card 1: Rain */}
                            <article className="p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                                <CloudRainIcon className="w-8 h-8 mb-3 text-sky-400 bg-sky-900/30 p-1.5 rounded-lg" />
                                <h3 className="text-sm font-medium text-slate-400">Rain Sensor</h3>
                                <p className="text-2xl font-black text-white">{rainStatus.reading}</p>
                                <p className={`text-xs ${rainStatus.className}`}>{rainStatus.status}</p>
                            </article>
                            
                            {/* Card 2: Pressure */}
                            <article className="p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                                <GaugeIcon className="w-8 h-8 mb-3 text-purple-400 bg-purple-900/30 p-1.5 rounded-lg" />
                                <h3 className="text-sm font-medium text-slate-400">Pressure</h3>
                                <p className="text-2xl font-black text-white">{liveData.pressure.toFixed(1)} hPa</p>
                                <p className={`text-xs ${pressureStatus.className}`}>{pressureStatus.status}</p>
                            </article>

                            {/* Card 3: Water Tank */}
                            <article className="p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                                <BoxIcon className="w-8 h-8 mb-3 text-cyan-400 bg-cyan-900/30 p-1.5 rounded-lg" />
                                <h3 className="text-sm font-medium text-slate-400">Water Level</h3>
                                <p className="text-2xl font-black text-white">{waterTankStatus.reading}</p>
                                <p className={`text-xs ${waterTankStatus.className}`}>{waterTankStatus.status}</p>
                            </article>

                            {/* Card 4: Soil */}
                            <article className="p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                                <LeafIcon className="w-8 h-8 mb-3 text-orange-400 bg-orange-900/30 p-1.5 rounded-lg" />
                                <h3 className="text-sm font-medium text-slate-400">Soil Moisture</h3>
                                <p className="text-2xl font-black text-white">{soilStatus.reading}</p>
                                <p className={`text-xs ${soilStatus.className}`}>{soilStatus.status}</p>
                            </article>
                        </section>
                        
                        <section className="grid grid-cols-1 gap-6">
                            <article className="p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                                <h3 className="text-xl font-bold mb-6 text-slate-200">Live Sensors (Percent)</h3>
                                <div className="gauges-container">
                                    <div className="gauge-wrapper flex flex-col items-center">
                                        <canvas ref={rainGaugeRef}></canvas>
                                        <p className="mt-2 text-sm font-bold text-slate-300">Wetness: <span className="text-sky-400">{rainPercent}%</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center">
                                        <canvas ref={pressureGaugeRef}></canvas>
                                        <p className="mt-2 text-sm font-bold text-slate-300">Pressure: <span className="text-purple-400">{liveData.pressure.toFixed(0)} hPa</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center">
                                        <canvas ref={waterTankGaugeRef}></canvas>
                                        <p className="mt-2 text-sm font-bold text-slate-300">Tank Level: <span className="text-cyan-400">{waterPercent}%</span></p>
                                        {/* Added small warning text below gauge if error */}
                                        {liveData.waterDistanceCM >= 400 && <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Check Sensor</span>}
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center">
                                        <canvas ref={soilGaugeRef}></canvas>
                                        <p className="mt-2 text-sm font-bold text-slate-300">Moisture: <span className="text-orange-400">{soilPercent}%</span></p>
                                    </div>
                                </div>
                            </article>

                            <article className="p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                                <h3 className="text-xl font-bold mb-4 text-slate-200">Historical Trends</h3>
                                <div className="chart-container">
                                    <canvas ref={historyChartRef}></canvas>
                                </div>
                            </article>
                        </section>
                    </>
                )}

                {mode !== 'Auto' && (
                    <div className="p-10 bg-slate-800 rounded-2xl border border-slate-700 text-center flex flex-col items-center min-h-[40vh] justify-center">
                        <RefreshCcwIcon className={`w-12 h-12 mb-4 ${mode === 'Maintenance' ? 'text-yellow-400 animate-spin' : 'text-slate-600'}`} />
                        <h3 className="text-2xl font-bold text-slate-200 mb-2">{mode} Mode Active</h3>
                        <p className="text-slate-400 max-w-md">System monitoring is paused. Switch to Auto to resume.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;