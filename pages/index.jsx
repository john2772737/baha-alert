import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RefreshCcw, CloudRain, Gauge, Droplet, Leaf, Clock } from 'lucide-react';

// --- Global Script Loader Hook ---
const useScripts = (urls, isClient) => {
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const scriptsRef = useRef(new Set());

    useEffect(() => {
        // Only proceed if running on the client (i.e., component has mounted)
        if (!isClient) return;

        const loadScript = (url) => {
            if (scriptsRef.current.has(url)) return;
            scriptsRef.current.add(url);
            
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            
            return new Promise((resolve) => {
                // IMPORTANT: All DOM manipulation and window checks are inside this effect/promise
                script.onload = () => resolve();
                script.onerror = () => { console.warn(`Failed to load script: ${url}`); resolve(); }; 
                document.head.appendChild(script);
            });
        };

        const loadAll = async () => {
            await Promise.all(urls.map(loadScript));
            // Check if libraries are actually available on the window object after loading
            setTimeout(() => {
                if (window.Gauge && window.Chart) {
                    setScriptsLoaded(true);
                } else {
                    console.error('Gauge.js or Chart.js not found on window after loading.');
                }
            }, 50); 
        };

        loadAll();

        // Cleanup: Clear the ref
        return () => scriptsRef.current.clear();
    }, [urls, isClient]); // Run only when isClient becomes true

    return scriptsLoaded;
};

// --- Initial Data Structure ---
const initialSensorData = {
    pressure: 1012, // hPa
    rain: 0, // mm/hr (simulated)
    waterLevel: 65, // %
    soil: 60, // %
    timestamp_client: new Date().toISOString()
};

// Helper function to get the current formatted time (Client-side only)
const calculateFormattedTime = () => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- Main App Component ---
const App = () => {
    // CRITICAL for Vercel/Next.js: Determine if we are running on the client (browser)
    const [isClient, setIsClient] = useState(false);
    
    // State initialization is now safe for SSR
    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState('Loading...'); // Safe initial state for SSR
    const [isDark] = useState(true); 

    // Refs for the Canvas elements to initialize Gauge/Chart.js
    const rainGaugeRef = useRef(null);
    const pressureGaugeRef = useRef(null);
    const waterLevelGaugeRef = useRef(null);
    const soilGaugeRef = useRef(null);
    const historyChartRef = useRef(null);

    // Refs for Gauge instances (to update them later)
    const gaugeInstances = useRef({});
    
    // Load external scripts using the custom hook, dependent on isClient
    const scriptsReady = useScripts([
        "https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js",
        "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"
    ], isClient);

    // === 0. Client Mount & Time Handling ===
    useEffect(() => {
        // 1. Set isClient to true after the first render cycle
        setIsClient(true);

        // 2. Apply Tailwind dark mode class to body (Simulated)
        if (typeof document !== 'undefined') {
            document.body.classList.add('bg-gray-900', 'text-gray-100');
            document.documentElement.classList.add('dark');
        }

        // 3. Initialize time immediately on client mount
        setCurrentTime(calculateFormattedTime());
        
        // 4. Time update interval
        const timeInterval = setInterval(() => {
            setCurrentTime(calculateFormattedTime());
        }, 10000);
        return () => clearInterval(timeInterval);
        
    }, []);

    // === 1. Initialization Logic (Memoized for stability) ===

    // Function to initialize all charts and gauges
    const initializeDashboard = useCallback(() => {
        // Guard against running if scripts aren't ready, or libraries aren't loaded
        if (!isClient || !scriptsReady || typeof window.Gauge === 'undefined' || typeof window.Chart === 'undefined') {
            return;
        }

        const Gauge = window.Gauge;
        const Chart = window.Chart;

        // Clean up previous instances defensively
        if (gaugeInstances.current.chart) {
            try {
                gaugeInstances.current.chart.destroy();
            } catch (e) {
                // Ignore errors during destruction if Chart.js state is broken
            }
            gaugeInstances.current.chart = null;
        }
        // Clear all gauge references before re-initialization
        Object.keys(gaugeInstances.current).forEach(key => {
            if (key !== 'chart' && gaugeInstances.current[key]) {
                try {
                    // Gauge.js does not have a destroy method, so we nullify the reference
                    gaugeInstances.current[key] = null;
                } catch(e) { /* ignore */ }
            }
        });


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
            
            // Sample data from your original JS
            const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const rainData = [0, 1, 0, 0, 2, 1, 0]; 
            const pressureData = [1012, 1008, 1015, 1010, 995, 1000, 1018];
            const waterLevelData = [65, 68, 70, 62, 75, 80, 70];
            const soilMoistureData = [60, 55, 65, 70, 80, 75, 68];

            gaugeInstances.current.chart = new Chart(historyChartRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Rain Sensor', data: rainData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: false, tension: 0.3, yAxisID: 'yRain', stepped: true, pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Barometer Pressure (hPa)', data: pressureData, borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 0.1)', fill: false, tension: 0.3, yAxisID: 'yPressure', pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Water Level (%)', data: waterLevelData, borderColor: 'rgba(6, 182, 212, 1)', backgroundColor: 'rgba(6, 182, 212, 0.1)', fill: true, tension: 0.3, yAxisID: 'yWaterLevel', pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Soil Moisture (%)', data: soilMoistureData, borderColor: 'rgba(132, 204, 22, 1)', backgroundColor: 'rgba(132, 204, 22, 0.1)', fill: true, tension: 0.3, yAxisID: 'ySoil', pointRadius: 4, pointHoverRadius: 6 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { 
                            grid: { color: 'rgba(75, 85, 99, 0.3)', borderColor: '#4b5563' }, 
                            ticks: { color: chartTextColor } 
                        },
                        yRain: { type: 'linear', position: 'left', beginAtZero: true, max: 3, grid: { color: 'rgba(75, 85, 99, 0.3)', borderColor: '#4b5563' }, ticks: { stepSize: 1, callback: (v) => v === 0 ? 'No Rain' : v === 1 ? 'Light' : v === 2 ? 'Moderate' : v === 3 ? 'Heavy' : '', color: chartTextColor } },
                        yPressure: { type: 'linear', position: 'right', beginAtZero: false, grid: { display: false }, ticks: { callback: (v) => v + ' hPa', color: chartTextColor } },
                        yWaterLevel: { type: 'linear', position: 'left', offset: true, beginAtZero: true, max: 100, grid: { display: false }, ticks: { callback: (v) => v + '%', color: chartTextColor } },
                        ySoil: { type: 'linear', position: 'right', offset: true, beginAtZero: true, max: 100, grid: { display: false }, ticks: { callback: (v) => v + '%', color: chartTextColor } }
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
                                    if (c.dataset.label === 'Rain Sensor') label += c.raw === 0 ? 'No Rain' : c.raw === 1 ? 'Light' : c.raw === 2 ? 'Moderate' : 'Heavy';
                                    else if (c.dataset.label.includes('Pressure')) label += c.raw + ' hPa';
                                    else if (c.dataset.label.includes('%')) label += c.raw + '%';
                                    else label += c.raw;
                                    return label;
                                }
                            } 
                        }
                    }
                }
            });
        }
    }, [isClient, scriptsReady, liveData.pressure, liveData.rain, liveData.soil, liveData.waterLevel]); 

    // === 2. Initialization/Cleanup Effect ===
    useEffect(() => {
        // This effect runs whenever initialization dependencies change
        initializeDashboard();
        
        // Cleanup function for charts/gauges (called when component unmounts)
        return () => {
            if (gaugeInstances.current.chart) {
                try {
                    gaugeInstances.current.chart.destroy();
                } catch(e) { /* Safe destroy */ }
                gaugeInstances.current.chart = null;
            }
            // Ensure all gauge references are cleared
            gaugeInstances.current = {};
        };
    }, [initializeDashboard]);


    // === 3. Data Fetching and Mock Data Update (for testing) ===
    const updateMockData = () => {
        // ... Mock data generation logic ...
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
            timestamp_client: new Date().toISOString()
        });
    };

    // Data Update Interval (Runs every 5 seconds)
    useEffect(() => {
        if (!isClient) return; // Only run data simulation on client
        
        const interval = setInterval(updateMockData, 5000);
        return () => clearInterval(interval); // Cleanup
    }, [isClient]);

    // Effect to update the Gauge instances whenever liveData changes
    useEffect(() => {
        // Only attempt to set the gauges if they have been initialized AND scripts are ready AND on client
        if (isClient && scriptsReady && window.Gauge && gaugeInstances.current.rain) { 
            requestAnimationFrame(() => {
                try {
                    gaugeInstances.current.rain.set(liveData.rain);
                    gaugeInstances.current.pressure.set(liveData.pressure);
                    gaugeInstances.current.waterLevel.set(liveData.waterLevel);
                    gaugeInstances.current.soil.set(liveData.soil);
                } catch (e) {
                    // If gauges fail to update, try re-initializing them defensively
                    // console.error("Error updating gauges, re-initializing:", e);
                    initializeDashboard(); 
                }
            });
        }
    }, [liveData, scriptsReady, initializeDashboard, isClient]);


    // === 4. Helper functions to determine Status and Class Names ===
    
    const RAIN_LABELS = ['STATUS: Clear', 'STATUS: Light Rainfall', 'ALERT: Heavy Rainfall!'];
    const PRESSURE_LABELS = ['WARNING: Low Pressure!', 'STATUS: Normal Pressure', 'STATUS: High Pressure'];
    const WATER_LABELS = ['ALERT: Level Low', 'STATUS: Optimal', 'ALERT: Tank Nearing Full!'];
    const SOIL_LABELS = ['ALERT: Soil is Dry!', 'STATUS: Soil Moisture Optimal', 'WARNING: Soil is Wet!'];
    
    const CLASS_MAP = ['text-red-400 font-bold', 'text-green-400 font-bold', 'text-yellow-400 font-bold'];

    const getRainStatus = (rain) => {
        if (rain > 30) return { reading: 'Heavy Rain', status: RAIN_LABELS[2], className: CLASS_MAP[2] };
        if (rain > 0) return { reading: 'Light Rain', status: RAIN_LABELS[1], className: CLASS_MAP[1] };
        return { reading: 'No Rain', status: RAIN_LABELS[0], className: CLASS_MAP[0] };
    };
    const getPressureStatus = (pressure) => {
        if (pressure < 990) return { status: PRESSURE_LABELS[0], className: CLASS_MAP[0] };
        if (pressure > 1030) return { status: PRESSURE_LABELS[2], className: CLASS_MAP[2] };
        return { status: PRESSURE_LABELS[1], className: CLASS_MAP[1] };
    };
    const getWaterStatus = (level) => {
        if (level > 90) return { status: WATER_LABELS[2], className: CLASS_MAP[2] };
        if (level < 30) return { status: WATER_LABELS[0], className: CLASS_MAP[0] };
        return { status: WATER_LABELS[1], className: CLASS_MAP[1] };
    };
    const getSoilStatus = (moisture) => {
        if (moisture < 30) return { reading: 'Dry', status: SOIL_LABELS[0], className: CLASS_MAP[0] };
        if (moisture < 70) return { reading: 'Optimal', status: SOIL_LABELS[1], className: CLASS_MAP[1] };
        return { reading: 'Wet', status: SOIL_LABELS[2], className: CLASS_MAP[2] };
    };


    const rainStatus = useMemo(() => getRainStatus(liveData.rain), [liveData.rain]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);
    const waterStatus = useMemo(() => getWaterStatus(liveData.waterLevel), [liveData.waterLevel]);
    const soilStatus = useMemo(() => getSoilStatus(liveData.soil), [liveData.soil]);


    // --- RENDER ---
    // Render a loading state during SSR or until the scripts are loaded on the client
    if (!isClient || !scriptsReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-400">
                <RefreshCcw className="w-8 h-8 animate-spin mr-3" />
                <p>Initializing dashboard for client environment...</p>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8 font-inter dark">
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
                    /* Fixes Canvas sizing issue specific to Gauge.js responsiveness */
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
            
            <header className="mb-8 p-4 bg-gray-800 rounded-xl shadow-2xl flex flex-col md:flex-row justify-between items-center">
                <h1 className="text-3xl font-bold text-emerald-400 mb-2 md:mb-0">
                    Smart Farm Monitor
                </h1>
                <div className="flex items-center text-sm font-medium text-gray-400">
                    <Clock className="w-4 h-4 mr-2 text-indigo-400" />
                    <span id="current-time">{currentTime}</span>
                </div>
            </header>

            <main className="space-y-8">
                {/* Status Grid Section */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-emerald-500">
                        <CloudRain className="w-8 h-8 mb-2 text-emerald-400" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Rain Sensor</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{rainStatus.reading}</p>
                        <p className={`text-sm ${rainStatus.className}`}>{rainStatus.status}</p>
                    </article>

                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-violet-500">
                        <Gauge className="w-8 h-8 mb-2 text-violet-400" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Barometric Pressure</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{liveData.pressure} hPa</p>
                        <p className={`text-sm ${pressureStatus.className}`}>{pressureStatus.status}</p>
                    </article>

                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-cyan-500">
                        <Droplet className="w-8 h-8 mb-2 text-cyan-400" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Water Level (Tank)</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{liveData.waterLevel}%</p>
                        <p className={`text-sm ${waterStatus.className}`}>{waterStatus.status}</p>
                    </article>

                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-lime-500">
                        <Leaf className="w-8 h-8 mb-2 text-lime-400" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Soil Moisture</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{soilStatus.reading}</p>
                        <p className={`text-sm ${soilStatus.className}`}>{soilStatus.status}</p>
                    </article>
                </section>

                {/* Main Content Section - Gauges & Chart */}
                <section className="grid grid-cols-1 gap-8 md:grid-cols-1">
                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl">
                        <h3 className="text-2xl font-bold mb-4 text-gray-200">Live Sensor Readings (Gauges)</h3>
                        <div className="gauges-container">
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeRain" ref={rainGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Rain: {liveData.rain} mm/hr</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugePressure" ref={pressureGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Pressure: {liveData.pressure} hPa</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeWaterLevel" ref={waterLevelGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Water Level: {liveData.waterLevel}%</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeSoil" ref={soilGaugeRef} className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Soil Moisture: {liveData.soil}%</p>
                            </div>
                        </div>
                    </article>

                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl">
                        <h3 className="text-2xl font-bold mb-4 text-gray-200">7-Day Historical Trends</h3>
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