import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- Initial Data Structure ---
const initialSensorData = {
    pressure: 1012, // hPa
    rain: 0, // mm/hr
    waterLevel: 65, // %
    soil: 60, // %
};

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

// --- Main App Component (Dynamic Structure) ---
const App = () => {
    // CRITICAL: isMounted flag is still essential for client-side initialization
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);

    // State to hold the live data and time
    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState('Loading...'); // Safe initial state for SSR

    // Refs for the Canvas elements to initialize Gauge/Chart.js
    const rainGaugeRef = useRef(null);
    const pressureGaugeRef = useRef(null);
    const waterLevelGaugeRef = useRef(null);
    const soilGaugeRef = useRef(null);
    const historyChartRef = useRef(null);

    // Refs for Gauge and Chart instances
    const gaugeInstances = useRef({});

    // === 0. Client Mount, Script Injection, and Time Handling ===
    useEffect(() => {
        // --- 0a. Set isClient state ---
        setIsClient(true);
        setCurrentTime(getFormattedTime());
        
        // --- 0b. Manual CDN Script Loading (Includes Tailwind for quick fix) ---
        const cdnUrls = [
            "https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js",
            "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
            "https://cdn.tailwindcss.com", // Injecting Tailwind CSS via CDN
        ];

        const loadScript = (url) => {
            return new Promise(resolve => {
                if (document.querySelector(`script[src="${url}"]`)) return resolve();
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onload = resolve;
                // For Tailwind, ensure it's loaded before Chart/Gauge for potential canvas styling
                if (url.includes('tailwindcss')) {
                    document.head.prepend(script);
                } else {
                    document.head.appendChild(script);
                }
                
                // Special case: Tailwind CDN executes and sets up the styles immediately
                if (url.includes('tailwindcss')) {
                     // Resolve immediately after appending Tailwind, though its execution is sync
                     resolve();
                }
            });
        };

        Promise.all(cdnUrls.map(loadScript))
            .then(() => {
                // Final check after loading to ensure globals exist
                if (window.Gauge && window.Chart) {
                    setScriptsLoaded(true);
                } else {
                    // This will still trigger if Tailwind loaded but Chart/Gauge failed
                    console.warn('Chart/Gauge libraries may be missing, but UI styles should load.');
                }
            });

        // Time update interval
        const timeInterval = setInterval(() => {
            setCurrentTime(getFormattedTime());
        }, 10000);
        
        return () => clearInterval(timeInterval);
        
    }, []);

    // --- Status Calculation Functions (Same as previous) ---
    const getRainStatus = (rain) => {
        if (rain > 30) return { reading: 'Heavy Rain', status: 'ALERT: Heavy Rainfall!', className: 'text-red-400 font-bold' };
        if (rain > 0) return { reading: 'Light Rain', status: 'STATUS: Light Rainfall', className: 'text-yellow-400 font-bold' };
        return { reading: 'No Rain', status: 'STATUS: Clear', className: 'text-lime-400 font-bold' };
    };
    const getPressureStatus = (pressure) => {
        if (pressure < 990) return { status: 'WARNING: Low Pressure!', className: 'text-red-400 font-bold' };
        if (pressure > 1030) return { status: 'STATUS: High Pressure', className: 'text-yellow-400 font-bold' };
        return { status: 'STATUS: Normal Pressure', className: 'text-lime-400 font-bold' };
    };
    const getWaterStatus = (level) => {
        if (level > 90) return { status: 'ALERT: Tank Nearing Full!', className: 'text-red-400 font-bold' };
        if (level < 30) return { status: 'STATUS: Level Low', className: 'text-yellow-400 font-bold' };
        return { status: 'STATUS: Optimal', className: 'text-lime-400 font-bold' };
    };
    const getSoilStatus = (moisture) => {
        if (moisture < 30) return { reading: 'Dry', status: 'ALERT: Soil is Dry!', className: 'text-red-400 font-bold' };
        if (moisture < 70) return { reading: 'Optimal', status: 'STATUS: Soil Moisture Optimal', className: 'text-lime-400 font-bold' };
        return { reading: 'Wet', status: 'WARNING: Soil is Wet!', className: 'text-yellow-400 font-bold' };
    };

    const rainStatus = useMemo(() => getRainStatus(liveData.rain), [liveData.rain]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);
    const waterStatus = useMemo(() => getWaterStatus(liveData.waterLevel), [liveData.waterLevel]);
    const soilStatus = useMemo(() => getSoilStatus(liveData.soil), [liveData.soil]);

    // Hardcoded historical data (kept for the chart sample)
    const hardcodedHistory = [
        { day: 'Sun', rain: 0, pressure: 1018, level: 70, soil: 68 },
        { day: 'Mon', rain: 1, pressure: 1012, level: 65, soil: 60 },
        { day: 'Tue', rain: 0, pressure: 1008, level: 68, soil: 55 },
        { day: 'Wed', rain: 20, pressure: 1015, level: 70, soil: 65 },
        { day: 'Thu', rain: 5, pressure: 1010, level: 62, soil: 70 },
        { day: 'Fri', rain: 0, pressure: 995, level: 75, soil: 80 },
        { day: 'Sat', rain: 0, pressure: 1000, level: 80, soil: 75 },
    ];
    
    // === 1. Initialization Logic (Guarded by isClient and scriptsLoaded) ===
    const initializeDashboard = useCallback(() => {
        // Only run if we are client-side and libraries are loaded
        if (!isClient || !scriptsLoaded || typeof window.Gauge === 'undefined' || typeof window.Chart === 'undefined') {
            return;
        }

        const Gauge = window.Gauge;
        const Chart = window.Chart;

        // Clean up previous instances defensively
        try {
            if (gaugeInstances.current.chart) {
                gaugeInstances.current.chart.destroy();
                gaugeInstances.current.chart = null;
            }
        } catch(e) { /* ignore cleanup errors */ }
        
        Object.keys(gaugeInstances.current).forEach(key => gaugeInstances.current[key] = null);


        // Base Gauge.js options 
        const gaugeOptions = {
            angle: 0.15,
            lineWidth: 0.3,
            radiusScale: 0.9,
            pointer: { length: 0.5, strokeWidth: 0.035, color: '#e2e8f0' }, 
            staticLabels: { font: "12px sans-serif", labels: [], color: '#9ca3af' },
            staticZones: [],
            limitMax: false, limitMin: false, highDpiSupport: true,
            strokeColor: '#374151',
            generateGradient: true,
            gradientStop: [
                ['#10b981', 0.25], 
                ['#f59e0b', 0.5], 
                ['#ef4444', 0.75]  
            ]
        };

        // --- Gauge Initialization Logic ---
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
        };

        // 1. Rain Gauge
        gaugeInstances.current.rain = initGauge(
            rainGaugeRef, 50, 0, liveData.rain, 
            [0, 10, 20, 30, 40, 50],
            [{strokeStyle: "#10b981", min: 0, max: 10}, {strokeStyle: "#f59e0b", min: 10, max: 30}, {strokeStyle: "#ef4444", min: 30, max: 50}]
        );

        // 2. Pressure Gauge
        gaugeInstances.current.pressure = initGauge(
            pressureGaugeRef, 1050, 950, liveData.pressure, 
            [950, 980, 1010, 1040, 1050],
            [{strokeStyle: "#f59e0b", min: 950, max: 980}, {strokeStyle: "#10b981", min: 980, max: 1040}, {strokeStyle: "#f59e0b", min: 1040, max: 1050}]
        );

        // 3. Water Level Gauge
        gaugeInstances.current.waterLevel = initGauge(
            waterLevelGaugeRef, 100, 0, liveData.waterLevel, 
            [0, 25, 50, 75, 100],
            [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 80}, {strokeStyle: "#f59e0b", min: 80, max: 100}]
        );

        // 4. Soil Moisture Gauge
        gaugeInstances.current.soil = initGauge(
            soilGaugeRef, 100, 0, liveData.soil, 
            [0, 25, 50, 75, 100],
            [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 70}, {strokeStyle: "#f59e0b", min: 70, max: 100}]
        );

        // --- Chart Initialization (Chart.js) ---
        if (historyChartRef.current) {
            const chartTextColor = '#e2e8f0'; 
            
            const labels = hardcodedHistory.map(d => d.day);
            const rainData = hardcodedHistory.map(d => d.rain); 
            const pressureData = hardcodedHistory.map(d => d.pressure);
            const waterLevelData = hardcodedHistory.map(d => d.level);
            const soilMoistureData = hardcodedHistory.map(d => d.soil);

            gaugeInstances.current.chart = new Chart(historyChartRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Rain Sensor (mm)', data: rainData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: false, tension: 0.3, yAxisID: 'yRain', stepped: true, pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Barometer Pressure (hPa)', data: pressureData, borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 0.1)', fill: false, tension: 0.3, yAxisID: 'yPressure', pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Water Level (%)', data: waterLevelData, borderColor: 'rgba(6, 182, 212, 1)', backgroundColor: 'rgba(6, 182, 212, 0.1)', fill: true, tension: 0.3, yAxisID: 'yLevel', pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Soil Moisture (%)', data: soilMoistureData, borderColor: 'rgba(132, 204, 22, 1)', backgroundColor: 'rgba(132, 204, 22, 0.1)', fill: true, tension: 0.3, yAxisID: 'yLevel', pointRadius: 4, pointHoverRadius: 6 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { 
                            grid: { color: 'rgba(75, 85, 99, 0.3)', borderColor: '#4b5563' }, 
                            ticks: { color: chartTextColor } 
                        },
                        yRain: { type: 'linear', position: 'left', beginAtZero: true, max: 50, grid: { color: 'rgba(75, 85, 99, 0.3)', borderColor: '#4b5563' }, ticks: { callback: (v) => v + ' mm', color: chartTextColor } },
                        yPressure: { type: 'linear', position: 'right', beginAtZero: false, min: 950, max: 1050, grid: { display: false }, ticks: { callback: (v) => v + ' hPa', color: chartTextColor } },
                        yLevel: { type: 'linear', position: 'left', beginAtZero: true, max: 100, grid: { display: false }, ticks: { callback: (v) => v + '%', color: chartTextColor } }

                    },
                    plugins: {
                        legend: { position: 'top', labels: { color: chartTextColor, usePointStyle: true } },
                        tooltip: { 
                            mode: 'index', 
                            intersect: false, 
                            backgroundColor: 'rgba(31, 41, 55, 0.9)', 
                            titleColor: '#f3f4f6',
                            bodyColor: '#e5e7eb',
                            callbacks: {
                                label: (c) => {
                                    let label = c.dataset.label || '';
                                    if (label) label += ': ';
                                    label += c.raw;
                                    return label;
                                }
                            } 
                        }
                    }
                }
            });
        }
    }, [isClient, scriptsLoaded, liveData.pressure, liveData.rain, liveData.soil, liveData.waterLevel]); 

    // === 2. Initialization/Cleanup Effect ===
    useEffect(() => {
        initializeDashboard();
        
        // Cleanup function for charts/gauges 
        return () => {
             try {
                if (gaugeInstances.current.chart) {
                    gaugeInstances.current.chart.destroy();
                    gaugeInstances.current.chart = null;
                }
            } catch(e) { /* ignore cleanup errors */ }
            gaugeInstances.current = {};
        };
    }, [initializeDashboard]);

    // --- Data Update Logic (Mock Data) ---
    const updateMockData = () => {
        if (!isClient) return; // Only run mock data updates on the client
        
        const rainChance = Math.random();
        let newRainValue;
        if (rainChance < 0.1) newRainValue = (30 + Math.random() * 20).toFixed(0);
        else if (rainChance < 0.3) newRainValue = (1 + Math.random() * 9).toFixed(0);
        else newRainValue = 0;

        const newPressure = (980 + Math.random() * 60).toFixed(0);
        const newWaterLevel = (20 + Math.random() * 75).toFixed(0);
        const newSoilMoisture = (10 + Math.random() * 80).toFixed(0);

        setLiveData({
            pressure: parseFloat(newPressure),
            rain: parseFloat(newRainValue),
            waterLevel: parseFloat(newWaterLevel),
            soil: parseFloat(newSoilMoisture),
        });
    };

    // Data Update Interval (Runs every 5 seconds)
    useEffect(() => {
        const interval = setInterval(updateMockData, 5000);
        return () => clearInterval(interval); // Cleanup
    }, [isClient]);

    // Effect to update the Gauge instances whenever liveData changes
    useEffect(() => {
        // Only attempt to set the gauges if they have been initialized AND scripts are ready AND on client
        if (isClient && scriptsLoaded && window.Gauge && gaugeInstances.current.rain) { 
            requestAnimationFrame(() => {
                try {
                    gaugeInstances.current.rain.set(liveData.rain);
                    gaugeInstances.current.pressure.set(liveData.pressure);
                    gaugeInstances.current.waterLevel.set(liveData.waterLevel);
                    gaugeInstances.current.soil.set(liveData.soil);
                } catch (e) {
                    // If gauges fail to update, try re-initializing them defensively
                    console.error("Error updating gauges:", e);
                }
            });
        }
    }, [liveData, scriptsLoaded, isClient]);

    
    // --- SVG ICON COMPONENTS (Using inline SVGs to avoid npm dependencies) ---
    const ClockIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
    const CloudRainIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 20v-3"></path><path d="M8 20v-3"></path><path d="M12 18v-3"></path></svg>);
    const GaugeIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"></path><path d="M9 13l3 3 3-3"></path></svg>);
    const DropletIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69L6 8.52A10.74 10.74 0 0 0 12 22a10.74 10.74 0 0 0 6-13.48L12 2.69z"></path></svg>);
    const LeafIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A10 10 0 0 0 2 11c0-4 4-4 8-8 3 0 4 3 4 5 0 2-3 5-3 5l-1 1 1 1c1.5 1.5 3.5 1.5 5 0l1-1c3 0 5 3 5 5 0 3-4 5-8 5z"></path></svg>);
    const RefreshCcwIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 18A8 8 0 1 0 7 19l-4-4"></path><path d="M4 13v-2"></path><path d="M17 19h-2l-4-4"></path></svg>);


    // --- RENDER ---
    // Render a loading state during SSR or until the scripts are loaded on the client
    if (!isClient || !scriptsLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-400 font-inter">
                <RefreshCcwIcon className="w-8 h-8 animate-spin mr-3 text-lime-400" />
                <p>Initializing dashboard and loading external libraries...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-8 font-inter dark">
            <style>{`
                /* Ensure responsive canvas sizes */
                .chart-container {
                    position: relative;
                    height: 50vh;
                    width: 100%;
                }
                .gauges-container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                }
                .gauge-wrapper canvas {
                    /* Max-width to enforce responsiveness */
                    max-width: 100% !important; 
                    height: auto !important; 
                }
                @media (min-width: 768px) {
                    .gauges-container {
                        grid-template-columns: repeat(4, 1fr);
                    }
                    .chart-container {
                        height: 400px;
                    }
                }
            `}</style>
            
            <header className="mb-8 p-4 bg-gray-800 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center border-b-4 border-lime-500/50">
                <h1 className="text-4xl font-extrabold text-lime-400 mb-2 md:mb-0 tracking-tight">
                    Smart Farm Monitor
                </h1>
                <div className="flex items-center text-md font-medium text-gray-400 bg-gray-900 px-4 py-2 rounded-lg shadow-inner">
                    <ClockIcon className="w-5 h-5 mr-2 text-indigo-400" />
                    <span id="current-time">{currentTime}</span>
                </div>
            </header>

            <main className="space-y-8">
                {/* Status Grid Section (Dynamic Data) */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <article className="card p-5 bg-gray-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-lime-500/30 hover:scale-[1.02] border border-gray-700/50">
                        <CloudRainIcon className="w-9 h-9 mb-3 text-emerald-400 p-1 bg-emerald-900/40 rounded-lg" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Rain Sensor</h3>
                        <p className="text-2xl font-black mb-1 text-gray-50">{rainStatus.reading}</p>
                        <p className={`text-sm ${rainStatus.className}`}>{rainStatus.status}</p>
                    </article>

                    <article className="card p-5 bg-gray-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-violet-500/30 hover:scale-[1.02] border border-gray-700/50">
                        <GaugeIcon className="w-9 h-9 mb-3 text-violet-400 p-1 bg-violet-900/40 rounded-lg" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Barometric Pressure</h3>
                        <p className="text-2xl font-black mb-1 text-gray-50">{liveData.pressure} hPa</p>
                        <p className={`text-sm ${pressureStatus.className}`}>{pressureStatus.status}</p>
                    </article>

                    <article className="card p-5 bg-gray-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-cyan-500/30 hover:scale-[1.02] border border-gray-700/50">
                        <DropletIcon className="w-9 h-9 mb-3 text-cyan-400 p-1 bg-cyan-900/40 rounded-lg" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Water Level (Tank)</h3>
                        <p className="text-2xl font-black mb-1 text-gray-50">{liveData.waterLevel}%</p>
                        <p className={`text-sm ${waterStatus.className}`}>{waterStatus.status}</p>
                    </article>

                    <article className="card p-5 bg-gray-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-lime-500/30 hover:scale-[1.02] border border-gray-700/50">
                        <LeafIcon className="w-9 h-9 mb-3 text-lime-400 p-1 bg-lime-900/40 rounded-lg" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Soil Moisture</h3>
                        <p className="text-2xl font-black mb-1 text-gray-50">{soilStatus.reading}</p>
                        <p className={`text-sm ${soilStatus.className}`}>{soilStatus.status}</p>
                    </article>
                </section>

                {/* Main Content Section - Gauges & Chart (Dynamic) */}
                <section className="grid grid-cols-1 gap-8 md:grid-cols-1">
                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700/50">
                        <h3 className="text-2xl font-bold mb-6 text-gray-200 border-b border-gray-700 pb-2">Live Sensor Readings (Gauges)</h3>
                        <div className="gauges-container">
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeRain" ref={rainGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Rain: <span className="text-emerald-400">{liveData.rain} mm/hr</span></p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugePressure" ref={pressureGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Pressure: <span className="text-violet-400">{liveData.pressure} hPa</span></p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeWaterLevel" ref={waterLevelGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Water Level: <span className="text-cyan-400">{liveData.waterLevel}%</span></p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeSoil" ref={soilGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Soil Moisture: <span className="text-lime-400">{liveData.soil}%</span></p>
                            </div>
                        </div>
                    </article>

                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700/50">
                        <h3 className="text-2xl font-bold mb-6 text-gray-200 border-b border-gray-700 pb-2">7-Day Historical Trends (Chart)</h3>
                        <div className="chart-container">
                            <canvas id="historyChart" ref={historyChartRef}></canvas>
                        </div>
                    </article>
                </section>
            </main>
        </div>
    );
}

export default App;