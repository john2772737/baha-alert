import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Chart from 'chart.js/auto'; // Using 'chart.js/auto' is a modern way to register controllers

// --- Initial Data Structure ---
const initialSensorData = {
    pressure: 1012.0, // hPa
    rain: 0.0, // mm/hr
    waterLevel: 65.0, // %
    soil: 60.0, // %
};

// Real API Endpoint provided by the user
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

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
    const [fetchError, setFetchError] = useState(null); // State for showing API errors
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    
    // NEW STATE: System mode control
    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];

    // State to hold the live data, historical data, and current time
    const [liveData, setLiveData] = useState(initialSensorData);
    const [historicalData, setHistoricalData] = useState([]);
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
        
        // --- 0b. Manual CDN Script Loading (Injects React, ReactDOM, Chart, Gauge, Tailwind) ---
        // Note: Tailwind and Gauge.js must be loaded dynamically since we use React via CDN
        const cdnUrls = [
            // Include React and ReactDOM to ensure they are available
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
                // Load Tailwind first
                if (url.includes('tailwindcss')) {
                    document.head.prepend(script);
                } else {
                    document.head.appendChild(script);
                }
                
                if (url.includes('tailwindcss')) {
                     resolve();
                }
            });
        };

        Promise.all(cdnUrls.map(loadScript))
            .then(() => {
                // Final check to ensure globals exist
                if (window.Gauge && window.Chart) {
                    setScriptsLoaded(true);
                } else {
                    // Fallback check in case script loading was too fast/slow
                    setTimeout(() => {
                        if (window.Gauge && window.Chart) {
                            setScriptsLoaded(true);
                        } else {
                            console.error('CRITICAL: Gauge.js or Chart.js failed to load.');
                        }
                    }, 500); 
                }
            });

        // Time update interval
        const timeInterval = setInterval(() => {
            setCurrentTime(getFormattedTime());
        }, 10000);
        
        return () => clearInterval(timeInterval);
        
    }, []);

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

    /**
     * Helper function to map descriptive API strings back to numerical values 
     * needed by the gauges (0-100%).
     */
    const mapDescriptiveValue = (key, value) => {
        if (typeof value === 'number') return value;

        const normalizedValue = String(value).toLowerCase().trim();

        switch (key) {
            case 'rain':
                if (normalizedValue.includes('dry') || normalizedValue.includes('no rain')) return 0.0;
                if (normalizedValue.includes('light')) return 5.0; 
                if (normalizedValue.includes('heavy')) return 35.0; 
                return 0.0; 
                
            case 'waterlevel':
                if (normalizedValue.includes('above normal')) return 85.0; 
                if (normalizedValue.includes('normal') || normalizedValue.includes('optimal')) return 65.0; 
                if (normalizedValue.includes('low')) return 20.0; 
                return 65.0; 
                
            case 'soil':
                if (normalizedValue.includes('dry')) return 20.0; 
                if (normalizedValue.includes('optimal') || normalizedValue.includes('normal')) return 50.0;
                if (normalizedValue.includes('wet')) return 80.0; 
                return 50.0; 
                
            default:
                return 0.0;
        }
    };
    
    // === Data Fetching (Live & Historical) ===

    // 1. Fetch Live Data (1-second polling)
    const fetchSensorData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;
        
        try {
            const response = await fetch(REAL_API_ENDPOINT); 
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            const mappedData = {
                pressure: parseFloat(data.pressure),
                rain: mapDescriptiveValue('rain', data.rain),
                waterLevel: mapDescriptiveValue('waterLevel', data.waterLevel),
                soil: mapDescriptiveValue('soil', data.soil),
            };

            if (isNaN(mappedData.pressure)) mappedData.pressure = initialSensorData.pressure;
            if (isNaN(mappedData.rain)) mappedData.rain = initialSensorData.rain;
            if (isNaN(mappedData.waterLevel)) mappedData.waterLevel = initialSensorData.waterLevel;
            if (isNaN(mappedData.soil)) mappedData.soil = initialSensorData.soil;
            
            setLiveData(mappedData);
            setFetchError(null); 

        } catch (error) {
            console.error("Failed to fetch live sensor data:", error);
            setFetchError(`Error connecting to live endpoint. Check console for details.`);
        }
    }, [isClient, mode]); 

    // 2. Fetch Historical Data (For Chart)
    const fetchHistoryData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;
        
        setIsHistoryLoading(true);
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const startDate = sevenDaysAgo.toISOString();
            
            // Fetch array of historical records
            const historyEndpoint = `${REAL_API_ENDPOINT}?startDate=${startDate}`;

            const response = await fetch(historyEndpoint);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            if (!result.success || !Array.isArray(result.data)) {
                // If API returns success=true but data is empty, that's fine.
                // If structure is wrong, throw error.
                if (result.data && result.data.length > 0) {
                     // Proceed if data exists even if success=false (for dev server issues)
                } else {
                     setHistoricalData([]);
                     return; 
                }
            }
            
            const rawHistory = result.data || [];
            
            // Map historical data: we need to extract the payload and convert strings to numbers
            const mappedHistory = rawHistory.map(item => {
                const payload = item.payload || {};
                return {
                    // Use locale time string for better chart labeling
                    time: new Date(payload.receivedAt || item.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}),
                    rain: mapDescriptiveValue('rain', payload.rain),
                    pressure: parseFloat(payload.pressure) || initialSensorData.pressure,
                    level: mapDescriptiveValue('waterLevel', payload.waterLevel),
                    soil: mapDescriptiveValue('soil', payload.soil),
                };
            });
            
            setHistoricalData(mappedHistory);
            setFetchError(null);

        } catch (error) {
            console.error("Failed to fetch historical data:", error);
            setFetchError(`Error fetching history. API likely returned an error.`);
        } finally {
            setIsHistoryLoading(false);
        }
    }, [isClient, mode]);


    // 3. Dashboard Initialization (Gauges and Chart)
    const initializeDashboard = useCallback(() => {
        if (!isClient || !scriptsLoaded || typeof window.Gauge === 'undefined' || typeof window.Chart === 'undefined') {
            return;
        }
        
        // Only initialize if in Auto mode AND historical data is available for the chart
        if (mode !== 'Auto' || historicalData.length === 0) return; 

        if (!rainGaugeRef.current || !pressureGaugeRef.current || !waterLevelGaugeRef.current || !soilGaugeRef.current || !historyChartRef.current) {
             return;
        }

        const Gauge = window.Gauge;
        const Chart = window.Chart;

        // --- Cleanup previous chart instance ---
        if (gaugeInstances.current.chart) {
            gaugeInstances.current.chart.destroy();
            gaugeInstances.current.chart = null;
        }
        
        // --- Cleanup previous gauge instances (for reliable re-initialization) ---
        Object.keys(gaugeInstances.current).forEach(key => {
            if (gaugeInstances.current[key] && gaugeInstances.current[key].options) {
                 // Check for Gauge object structure before setting to null
                 gaugeInstances.current[key] = null;
            }
        });


        // Base Gauge.js options (using same visual configuration as before)
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
        };

        // Initialize Gauges
        gaugeInstances.current.rain = initGauge(rainGaugeRef, 50, 0, liveData.rain, [0, 10, 20, 30, 40, 50], [{strokeStyle: "#10b981", min: 0, max: 10}, {strokeStyle: "#f59e0b", min: 10, max: 30}, {strokeStyle: "#ef4444", min: 30, max: 50}]);
        gaugeInstances.current.pressure = initGauge(pressureGaugeRef, 1050, 950, liveData.pressure, [950, 980, 1010, 1040, 1050], [{strokeStyle: "#f59e0b", min: 950, max: 980}, {strokeStyle: "#10b981", min: 980, max: 1040}, {strokeStyle: "#f59e0b", min: 1040, max: 1050}]);
        gaugeInstances.current.waterLevel = initGauge(waterLevelGaugeRef, 100, 0, liveData.waterLevel, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 80}, {strokeStyle: "#f59e0b", min: 80, max: 100}]);
        gaugeInstances.current.soil = initGauge(soilGaugeRef, 100, 0, liveData.soil, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 70}, {strokeStyle: "#f59e0b", min: 70, max: 100}]);

        // --- Chart Initialization (Chart.js) using historicalData ---
        if (historyChartRef.current) {
            const chartTextColor = '#e2e8f0'; 
            
            // Map data for chart
            // For a dense array of 1-second data, we only label every 10th or 60th point
            const labels = historicalData.map(d => d.time);
            const rainData = historicalData.map(d => d.rain); 
            const pressureData = historicalData.map(d => d.pressure);
            const waterLevelData = historicalData.map(d => d.level);
            const soilMoistureData = historicalData.map(d => d.soil);

            gaugeInstances.current.chart = new Chart(historyChartRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Rain Sensor (mm)', data: rainData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: false, tension: 0.2, yAxisID: 'yRain', stepped: false, pointRadius: 0, borderWidth: 1.5, cubicInterpolationMode: 'monotone' },
                        { label: 'Barometer Pressure (hPa)', data: pressureData, borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 0.1)', fill: false, tension: 0.2, yAxisID: 'yPressure', pointRadius: 0, borderWidth: 1.5, cubicInterpolationMode: 'monotone' },
                        { label: 'Water Level (%)', data: waterLevelData, borderColor: 'rgba(6, 182, 212, 1)', backgroundColor: 'rgba(6, 182, 212, 0.1)', fill: true, tension: 0.2, yAxisID: 'yLevel', pointRadius: 0, borderWidth: 1.5, cubicInterpolationMode: 'monotone' },
                        { label: 'Soil Moisture (%)', data: soilMoistureData, borderColor: 'rgba(132, 204, 22, 1)', backgroundColor: 'rgba(132, 204, 22, 0.1)', fill: true, tension: 0.2, yAxisID: 'yLevel', pointRadius: 0, borderWidth: 1.5, cubicInterpolationMode: 'monotone' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { 
                            grid: { color: 'rgba(75, 85, 99, 0.3)', borderColor: '#4b5563' }, 
                            ticks: { 
                                color: chartTextColor,
                                // Hide most labels to prevent cluttering a 7-day chart with 1-second data
                                autoSkip: true,
                                maxTicksLimit: 12
                            } 
                        },
                        yRain: { type: 'linear', position: 'left', beginAtZero: true, max: 50, grid: { color: 'rgba(75, 85, 99, 0.3)', borderColor: '#4b5563' }, ticks: { callback: (v) => v + ' mm', color: chartTextColor } },
                        yPressure: { type: 'linear', position: 'right', beginAtZero: false, min: 950, max: 1050, grid: { display: false }, ticks: { callback: (v) => v + ' hPa', color: chartTextColor } },
                        yLevel: { type: 'linear', position: 'left', beginAtZero: true, max: 100, grid: { display: false }, ticks: { callback: (v) => v + '%', color: chartTextColor } }

                    },
                    plugins: {
                        legend: { position: 'top', labels: { color: chartTextColor, usePointStyle: true } },
                        tooltip: { 
                            mode: 'index', intersect: false, 
                            backgroundColor: 'rgba(31, 41, 55, 0.9)', 
                            titleColor: '#f3f4f6', bodyColor: '#e5e7eb',
                            callbacks: {
                                title: (items) => {
                                    // Show date/time stamp for the tooltip
                                    const rawTimestamp = historicalData[items[0].dataIndex].time;
                                    return `Time: ${rawTimestamp}`;
                                },
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
    }, [isClient, scriptsLoaded, liveData.pressure, liveData.rain, liveData.soil, liveData.waterLevel, mode, historicalData]); 

    // === 4. Primary Effects (Fetching, Initializing, Updating) ===

    // Effect 4a: Data Polling (1 second interval for live data)
    useEffect(() => {
        if (mode !== 'Auto') return;
        const interval = setInterval(fetchSensorData, 1000); 
        return () => clearInterval(interval);
    }, [fetchSensorData, mode]); 
    
    // Effect 4b: Initial load and mode change handlers (History & Dashboard Init)
    useEffect(() => {
        // Fetch historical data whenever entering Auto mode or when scripts load
        if (mode === 'Auto' && scriptsLoaded) {
            fetchHistoryData();
        }
        
        // This effect manages cleanup and initialization based on mode/data readiness
        if (scriptsLoaded) {
            if (mode === 'Auto' && historicalData.length > 0) {
                // Initialize/Re-initialize dashboard only if history data is ready
                initializeDashboard();
            } else if (mode !== 'Auto') {
                 // Cleanup if we switch away from Auto
                 try {
                    if (gaugeInstances.current.chart) {
                        gaugeInstances.current.chart.destroy();
                        gaugeInstances.current.chart = null;
                    }
                } catch(e) { /* ignore cleanup errors */ }
                gaugeInstances.current = {};
            }
        }
        
        // Final cleanup on unmount
        return () => {
             try {
                if (gaugeInstances.current.chart) {
                    gaugeInstances.current.chart.destroy();
                    gaugeInstances.current.chart = null;
                }
            } catch(e) { /* ignore cleanup errors */ }
            gaugeInstances.current = {};
        };
    }, [initializeDashboard, mode, scriptsLoaded, historicalData, fetchHistoryData]);

    // Effect 4c: Gauge Update (Runs whenever liveData changes)
    useEffect(() => {
        if (mode === 'Auto' && isClient && scriptsLoaded && window.Gauge && gaugeInstances.current.rain) { 
            requestAnimationFrame(() => {
                try {
                    if (gaugeInstances.current.rain) gaugeInstances.current.rain.set(liveData.rain);
                    if (gaugeInstances.current.pressure) gaugeInstances.current.pressure.set(liveData.pressure);
                    if (gaugeInstances.current.waterLevel) gaugeInstances.current.waterLevel.set(liveData.waterLevel);
                    if (gaugeInstances.current.soil) gaugeInstances.current.soil.set(liveData.soil);
                } catch (e) {
                    console.error("Error updating gauges:", e);
                    // Force re-initialization if a runtime gauge error occurs
                    initializeDashboard(); 
                }
            });
        }
    }, [liveData, scriptsLoaded, isClient, mode, initializeDashboard]);

    
    // --- SVG ICON COMPONENTS ---
    const ClockIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
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
                <p>Initializing dashboard and loading external libraries...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
            <style>{`
                /* Ensure responsive canvas sizes */
                .chart-container {
                    position: relative;
                    height: 55vh;
                    width: 100%;
                }
                .gauges-container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 2rem;
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
                        height: 450px;
                    }
                }
            `}</style>
            
            <header className="mb-10 p-5 bg-slate-800 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center border-b-4 border-emerald-500/50">
                <h1 className="text-4xl font-extrabold text-emerald-400 mb-2 md:mb-0 tracking-tight">
                    Smart Farm Monitor
                </h1>
                <div className="flex items-center text-md font-medium text-slate-400 bg-slate-900 px-5 py-2.5 rounded-xl shadow-inner border border-slate-700/50">
                    <ClockIcon className="w-5 h-5 mr-3 text-indigo-400" />
                    <span id="current-time">{currentTime}</span>
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
                
                {/* Conditional Content based on Mode */}
                {mode === 'Auto' && (
                    <>
                        {/* Error Message Display */}
                        {fetchError && (
                            <div className="p-4 bg-red-800/50 text-red-300 rounded-xl border border-red-700 font-semibold flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {fetchError}
                            </div>
                        )}

                        {/* Status Grid Section (Dynamic Data) */}
                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-emerald-500/50 hover:scale-[1.02] border border-slate-700 hover:border-emerald-600/70">
                                <CloudRainIcon className="w-10 h-10 mb-3 text-sky-400 p-2 bg-sky-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Rain Sensor</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.rain.toFixed(1)} mm/hr</p>
                                <p className={`text-sm ${rainStatus.className}`}>{rainStatus.status}</p>
                            </article>

                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-purple-500/50 hover:scale-[1.02] border border-slate-700 hover:border-purple-600/70">
                                <GaugeIcon className="w-10 h-10 mb-3 text-purple-400 p-2 bg-purple-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Barometric Pressure</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.pressure.toFixed(1)} hPa</p>
                                <p className={`text-sm ${pressureStatus.className}`}>{pressureStatus.status}</p>
                            </article>

                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-sky-500/50 hover:scale-[1.02] border border-slate-700 hover:border-sky-600/70">
                                <DropletIcon className="w-10 h-10 mb-3 text-sky-400 p-2 bg-sky-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Water Level (Tank)</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.waterLevel.toFixed(1)}%</p>
                                <p className={`text-sm ${waterStatus.className}`}>{waterStatus.status}</p>
                            </article>

                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-orange-500/50 hover:scale-[1.02] border border-slate-700 hover:border-orange-600/70">
                                <LeafIcon className="w-10 h-10 mb-3 text-orange-400 p-2 bg-orange-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Soil Moisture</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.soil.toFixed(1)}%</p>
                                <p className={`text-sm ${soilStatus.className}`}>{soilStatus.status}</p>
                            </article>
                        </section>

                        {/* Main Content Section - Gauges & Chart (Dynamic) */}
                        <section className="grid grid-cols-1 gap-8 md:grid-cols-1">
                            <article className="card p-6 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
                                <h3 className="text-2xl font-bold mb-6 text-slate-200 border-b border-slate-700 pb-2">Live Sensor Readings (Gauges)</h3>
                                <div className="gauges-container">
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeRain" ref={rainGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Rain: <span className="text-sky-400">{liveData.rain.toFixed(1)} mm/hr</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugePressure" ref={pressureGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Pressure: <span className="text-purple-400">{liveData.pressure.toFixed(1)} hPa</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeWaterLevel" ref={waterLevelGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Water Level: <span className="text-sky-400">{liveData.waterLevel.toFixed(1)}%</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeSoil" ref={soilGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Soil Moisture: <span className="text-orange-400">{liveData.soil.toFixed(1)}%</span></p>
                                    </div>
                                </div>
                            </article>

                            <article className="card p-6 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
                                <h3 className="text-2xl font-bold mb-6 text-slate-200 border-b border-slate-700 pb-2">7-Day Historical Trends (Chart)</h3>
                                <div className="chart-container">
                                    {isHistoryLoading ? (
                                        <div className="flex items-center justify-center h-full text-slate-400">
                                            <RefreshCcwIcon className="w-6 h-6 animate-spin mr-3 text-indigo-400" />
                                            Fetching 7-day historical data...
                                        </div>
                                    ) : (
                                        historicalData.length > 0 ? (
                                            <canvas id="historyChart" ref={historyChartRef}></canvas>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-400">
                                                No historical data found for the last 7 days.
                                            </div>
                                        )
                                    )}
                                </div>
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