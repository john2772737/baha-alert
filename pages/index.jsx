import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// --- Initial Data Structure ---
const initialSensorData = {
    pressure: 1012.0, // hPa (numeric)
    rain: 'No Rain', // categorical string
    soil: 'Optimal', // categorical string
    waterTank: 'Normal' // Ultrasonic status categorical string
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

// **********************************************
// * MAPPING FOR CATEGORICAL GAUGES (String to Number) *
// **********************************************
const STATE_MAPPINGS = {
    rain: (status) => {
        const normalized = status.toLowerCase();
        if (normalized.includes('heavy') || normalized.includes('wet')) return 45;
        if (normalized.includes('moderate')) return 35;
        if (normalized.includes('light') || normalized.includes('few drops')) return 15;
        return 5; // Default to low end for 'No Rain' / 'Dry'
    },
    soil: (status) => {
        const normalized = status.toLowerCase();
        if (normalized.includes('dry')) return 20;
        if (normalized.includes('wet')) return 80;
        return 50; // Default to optimal
    },
    waterTank: (status) => {
        const normalized = status.toLowerCase();
        if (normalized.includes('below normal') || normalized.includes('low')) return 25;
        if (normalized.includes('above normal') || normalized.includes('high')) return 75;
        return 50; // Default to normal/optimal
    }
};

// --- Main App Component (Dynamic Structure) ---
const App = () => {
    // CRITICAL: isMounted flag is still essential for client-side initialization
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [fetchError, setFetchError] = useState(null); // State for showing API errors
    
    // NEW STATE: System mode control
    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];

    // State to hold the live data and time
    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState('Loading...'); // Safe initial state for SSR
    
    // useRef to hold the ID of the last successfully fetched document for stable comparison
    const lastIdRef = useRef(null); 
    // NEW REF: Tracks if the Gauges/Chart have been initialized once
    const isDashboardInitializedRef = useRef(false);

    // Refs for the Canvas elements to initialize Gauge/Chart.js
    const rainGaugeRef = useRef(null);
    const pressureGaugeRef = useRef(null);
    const soilGaugeRef = useRef(null);
    const waterTankGaugeRef = useRef(null); // <-- RESTORED REF
    const historyChartRef = useRef(null);

    // Refs for Gauge and Chart instances
    const gaugeInstances = useRef({});

    // === 0. Client Mount, Script Injection, and Time Handling ===
    useEffect(() => {
        // --- 0a. Set isClient state ---
        setIsClient(true);
        setCurrentTime(getFormattedTime());
        
        // --- 0b. Manual CDN Script Loading (Injects React, ReactDOM, Chart, Gauge, Tailwind) ---
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
                if (window.Gauge && window.Chart) {
                    setScriptsLoaded(true);
                } else {
                    console.warn('Chart/Gauge libraries may be missing, but UI styles should load.');
                }
            });

        // Time update interval
        const timeInterval = setInterval(() => {
            setCurrentTime(getFormattedTime());
        }, 10000);
        
        return () => clearInterval(timeInterval);
        
    }, []);

    // --- Status Calculation Functions ---

    // Now accepts categorical string and returns status object
    const getRainStatus = (rain) => {
        if (typeof rain === 'string') {
            const normalizedRain = rain.toLowerCase();
            if (normalizedRain.includes('heavy') || normalizedRain.includes('wet')) return { reading: 'Heavy Rain', status: 'ALERT: Heavy Rainfall!', className: 'text-red-400 font-bold' };
            if (normalizedRain.includes('moderate')) return { reading: 'Moderate Rain', status: 'STATUS: Moderate Rainfall', className: 'text-yellow-400 font-bold' };
            if (normalizedRain.includes('light') || normalizedRain.includes('few drops')) return { reading: 'Light Rain', status: 'STATUS: Light Rainfall', className: 'text-yellow-400 font-bold' };
            if (normalizedRain.includes('dry') || normalizedRain.includes('no rain')) return { reading: 'No Rain', status: 'STATUS: Clear', className: 'text-emerald-400 font-bold' };
            return { reading: rain, status: 'STATUS: Unknown Rain Level', className: 'text-slate-400 font-bold' };
        }
        // Fallback for numerical input (should not happen with current API)
        return { reading: `${rain.toFixed(1)} mm/hr`, status: 'STATUS: Fallback Value', className: 'text-slate-400 font-bold' };
    };
    
    // Barometric Pressure (Numeric-based)
    const getPressureStatus = (pressure) => {
        if (pressure < 990) return { status: 'WARNING: Low Pressure!', className: 'text-red-400 font-bold' };
        if (pressure > 1030) return { status: 'STATUS: High Pressure', className: 'text-yellow-400 font-bold' };
        return { status: 'STATUS: Normal Pressure', className: 'text-emerald-400 font-bold' };
    };

    // Water Tank Status (Ultrasonic Categorical Feedback)
    const getWaterTankStatus = (tankStatus) => {
        const normalizedStatus = tankStatus.toLowerCase();
        
        if (normalizedStatus.includes('below normal') || normalizedStatus.includes('low')) 
            return { reading: 'Below Normal', status: 'ALERT: Below Normal!', className: 'text-red-400 font-bold' };
        
        if (normalizedStatus.includes('above normal') || normalizedStatus.includes('high')) 
            return { reading: 'Above Normal', status: 'WARNING: Above Normal!', className: 'text-yellow-400 font-bold' };
            
        if (normalizedStatus.includes('normal')) 
            return { reading: 'Normal', status: 'STATUS: Level Optimal', className: 'text-emerald-400 font-bold' };

        return { reading: tankStatus, status: 'STATUS: Unknown Status', className: 'text-slate-400 font-bold' }; // Default fallback
    };
    
    // Soil Status now accepts categorical string
    const getSoilStatus = (moisture) => {
        if (typeof moisture === 'string') {
            const normalizedMoisture = moisture.toLowerCase();
            if (normalizedMoisture.includes('dry')) return { reading: 'Dry', status: 'ALERT: Soil is Dry!', className: 'text-red-400 font-bold' };
            if (normalizedMoisture.includes('wet')) return { reading: 'Wet', status: 'WARNING: Soil is Wet!', className: 'text-yellow-400 font-bold' };
            return { reading: moisture, status: 'STATUS: Moisture Optimal', className: 'text-emerald-400 font-bold' };
        }
        // Fallback for numerical input
        return { reading: `${moisture.toFixed(1)}%`, status: 'STATUS: Fallback Value', className: 'text-slate-400 font-bold' };
    };
    
    // Recalculate statuses whenever liveData changes
    const rainStatus = useMemo(() => getRainStatus(liveData.rain), [liveData.rain]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);
    const soilStatus = useMemo(() => getSoilStatus(liveData.soil), [liveData.soil]);
    const waterTankStatus = useMemo(() => getWaterTankStatus(liveData.waterTank), [liveData.waterTank]);


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
        
        // Prevent initialization if not in Auto mode
        if (mode !== 'Auto') return;
        
        // ******* CHECK: Prevent redundant initialization *******
        if (isDashboardInitializedRef.current) {
            return;
        }

        // CRITICAL: Ensure all canvas elements are rendered and referenced before initializing libraries
        if (!rainGaugeRef.current || !pressureGaugeRef.current || !soilGaugeRef.current || !waterTankGaugeRef.current || !historyChartRef.current) {
             console.warn("Canvas elements not yet mounted for Auto mode. Skipping gauge/chart initialization.");
             return; // Safely exit if refs are not ready
        }

        const Gauge = window.Gauge;
        const Chart = window.Chart;

        // Clean up previous chart instance defensively before (re)creating,
        try {
            if (gaugeInstances.current.chart) {
                gaugeInstances.current.chart.destroy();
                gaugeInstances.current.chart = null;
            }
        } catch(e) { /* ignore cleanup errors */ }
        
        // Base Gauge.js options (Updated colors for dark theme)
        const gaugeOptions = {
            angle: 0.15,
            lineWidth: 0.25, 
            radiusScale: 0.9,
            pointer: { length: 0.6, strokeWidth: 0.045, color: '#f3f4f6' }, 
            staticLabels: { font: "12px sans-serif", labels: [], color: '#9ca3af' },
            staticZones: [],
            limitMax: false, limitMin: false, highDpiSupport: true,
            strokeColor: '#374151',
            generateGradient: true,
            // Gradient stops for visual appeal: Emerald for optimal
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
                
                // For categorical gauges, use the mapped numerical state for initialization
                const numericInitial = typeof initial === 'number' ? initial : 
                                       (ref === rainGaugeRef ? STATE_MAPPINGS.rain(liveData.rain) :
                                        ref === waterTankGaugeRef ? STATE_MAPPINGS.waterTank(liveData.waterTank) :
                                        ref === soilGaugeRef ? STATE_MAPPINGS.soil(liveData.soil) : 0);

                const gauge = new Gauge(ref.current).setOptions(options);
                gauge.maxValue = max;
                gauge.setMinValue(min);
                gauge.set(numericInitial);
                return gauge;
            }
        };
        
        // 1. Rain Gauge (Categorical)
        gaugeInstances.current.rain = initGauge(
            rainGaugeRef, 50, 0, liveData.rain, // Initial data is string, will be mapped
            [0, 10, 20, 30, 40, 50],
            [{strokeStyle: "#10b981", min: 0, max: 10}, {strokeStyle: "#f59e0b", min: 10, max: 30}, {strokeStyle: "#ef4444", min: 30, max: 50}]
        );

        // 2. Pressure Gauge (Numerical)
        gaugeInstances.current.pressure = initGauge(
            pressureGaugeRef, 1050, 950, liveData.pressure, 
            [950, 980, 1010, 1040, 1050],
            [{strokeStyle: "#f59e0b", min: 950, max: 980}, {strokeStyle: "#10b981", min: 980, max: 1040}, {strokeStyle: "#f59e0b", min: 1040, max: 1050}]
        );

        // 3. Water Tank Gauge (Categorical)
        gaugeInstances.current.waterTank = initGauge(
            waterTankGaugeRef, 100, 0, liveData.waterTank, // Initial data is string, will be mapped
            [0, 25, 50, 75, 100],
            [{strokeStyle: "#ef4444", min: 0, max: 35}, {strokeStyle: "#10b981", min: 35, max: 65}, {strokeStyle: "#f59e0b", min: 65, max: 100}] // Adjusted zones for 3 states
        );

        // 4. Soil Moisture Gauge (Categorical)
        gaugeInstances.current.soil = initGauge(
            soilGaugeRef, 100, 0, liveData.soil, // Initial data is string, will be mapped
            [0, 25, 50, 75, 100],
            [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 70}, {strokeStyle: "#f59e0b", min: 70, max: 100}]
        );

        // --- Chart Initialization (Chart.js) ---
        if (historyChartRef.current) {
            const chartTextColor = '#e2e8f0'; 
            
            const labels = hardcodedHistory.map(d => d.day);
            const rainData = hardcodedHistory.map(d => d.rain); 
            const pressureData = hardcodedHistory.map(d => d.pressure);
            const soilMoistureData = hardcodedHistory.map(d => d.soil);

            gaugeInstances.current.chart = new Chart(historyChartRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Rain Sensor (mm)', data: rainData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: false, tension: 0.3, yAxisID: 'yRain', stepped: true, pointRadius: 4, pointHoverRadius: 6 },
                        { label: 'Barometer Pressure (hPa)', data: pressureData, borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 0.1)', fill: false, tension: 0.3, yAxisID: 'yPressure', pointRadius: 4, pointHoverRadius: 6 },
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
            
            // ******* SET FLAG ON SUCCESSFUL INITIALIZATION *******
            isDashboardInitializedRef.current = true;
        }
    }, [isClient, scriptsLoaded, liveData.pressure, liveData.rain, liveData.soil, liveData.waterTank, mode]); // Added liveData.waterTank to deps

    // --- Data Fetching Logic (Connects to online endpoint, runs every 5s) ---
    const fetchSensorData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;
        
        console.log(`[${new Date().toLocaleTimeString()}] --- Starting GET request (Interval: ${FETCH_INTERVAL_MS / 1000}s) ---`);

        try {
            const response = await fetch(REAL_API_ENDPOINT); 
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.payload) {
                throw new Error("API data structure invalid or missing data payload.");
            }

            const latestDocument = result.data;
            const newRecordId = latestDocument._id;
            const payload = latestDocument.payload;
            
            // 2. Implement ID comparison for stable polling and logging
            if (lastIdRef.current !== newRecordId) {
                lastIdRef.current = newRecordId;
                console.log(`[${new Date().toLocaleTimeString()}] 🌟 NEW RECORD DETECTED! ID: ${newRecordId}. Full Payload:`, payload);
            } else {
                console.log(`[${new Date().toLocaleTimeString()}] - Data fetched, ID is unchanged: ${newRecordId}`);
            }

            // 3. Extract sensor data from the payload and update state
            setLiveData(prevData => {
                const safeParseFloat = (value, fallback) => {
                    if (value === undefined || value === null || value === "") return fallback;
                    const parsed = parseFloat(value);
                    return isNaN(parsed) ? fallback : parsed;
                };

                const safeParseString = (value, fallback) => {
                    if (value === undefined || value === null) return fallback;
                    return String(value).trim();
                };

                // FIX: Consolidated keys for Water Tank Status
                const extractedWaterTank = safeParseString(
                    payload.waterLevel || 
                    payload.waterTank || 
                    payload.ultrasonicStatus || 
                    payload.water_tank_status || 
                    payload.level_status, 
                    prevData.waterTank
                );
                
                console.log(`[DEBUG] Extracted Water Tank Value: "${extractedWaterTank}"`);

                return {
                    // Numerical sensors
                    pressure: safeParseFloat(payload.pressure, prevData.pressure),

                    // Categorical sensors
                    rain: safeParseString(payload.rain || payload.Rain, prevData.rain),
                    soil: safeParseString(payload.soil || payload.Soil, prevData.soil), 
                    waterTank: extractedWaterTank,
                };
            });
            
            setFetchError(null); 

        } catch (error) {
            console.error("Failed to fetch live sensor data:", error);
            setFetchError(`Error connecting to online endpoint. Check console for details.`);
        }
    }, [isClient, mode]);

    // Data Update Interval (Runs every 5 second)
    useEffect(() => {
        fetchSensorData();
        const interval = setInterval(fetchSensorData, FETCH_INTERVAL_MS); 
        return () => clearInterval(interval);
    }, [fetchSensorData]); 

    // === 2. Initialization/Cleanup Effect ===
    useEffect(() => {
        if (scriptsLoaded && mode === 'Auto' && !isDashboardInitializedRef.current) {
             initializeDashboard();
        } else if (mode !== 'Auto') {
            isDashboardInitializedRef.current = false;
            try {
                 if (gaugeInstances.current.chart) {
                     gaugeInstances.current.chart.destroy();
                     gaugeInstances.current.chart = null;
                 }
            } catch(e) { /* ignore cleanup errors */ }
            gaugeInstances.current = {};
        }

        return () => {
             isDashboardInitializedRef.current = false;
             try {
                 if (gaugeInstances.current.chart) {
                     gaugeInstances.current.chart.destroy();
                     gaugeInstances.current.chart = null;
                 }
            } catch(e) { /* ignore cleanup errors */ }
            gaugeInstances.current = {};
        };
    }, [initializeDashboard, mode, scriptsLoaded]);


    // Effect to update the Gauge instances whenever liveData changes
    useEffect(() => {
        if (mode === 'Auto' && isClient && scriptsLoaded && window.Gauge && gaugeInstances.current.rain) { 
            requestAnimationFrame(() => {
                try {
                    // UPDATE GAUGES USING NUMERICAL MAPPING FOR CATEGORICAL SENSORS
                    if (gaugeInstances.current.rain) gaugeInstances.current.rain.set(STATE_MAPPINGS.rain(liveData.rain));
                    if (gaugeInstances.current.pressure) gaugeInstances.current.pressure.set(liveData.pressure);
                    if (gaugeInstances.current.waterTank) gaugeInstances.current.waterTank.set(STATE_MAPPINGS.waterTank(liveData.waterTank));
                    if (gaugeInstances.current.soil) gaugeInstances.current.soil.set(STATE_MAPPINGS.soil(liveData.soil));
                } catch (e) {
                    console.error("Error updating gauges:", e);
                    isDashboardInitializedRef.current = false; 
                    initializeDashboard(); 
                }
            });
        }
    }, [liveData, scriptsLoaded, isClient, mode, initializeDashboard]);

    
    // --- SVG ICON COMPONENTS ---
    const ClockIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
    const CloudRainIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 20v-3"></path><path d="M8 20v-3"></path><path d="M12 18v-3"></path></svg>);
    const GaugeIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"></path><path d="M9 13l3 3 3-3"></path></svg>);
    const LeafIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A10 10 0 0 0 2 11c0-4 4-4 8-8 3 0 4 3 4 5 0 2-3 5-3 5l-1 1 1 1c1.5 1.5 3.5 1.5 5 0l1-1c3 0 5 3 5 5 0 3-4 5-8 5z"></path></svg>);
    const RefreshCcwIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 18A8 8 0 1 0 7 19l-4-4"></path><path d="M4 13v-2"></path><path d="M17 19h-2l-4-4"></path></svg>);
    // Icon for Water Tank Status
    const BoxIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><path d="M3.27 6.3L12 11.5l8.73-5.2"></path><path d="M12 22.78V11.5"></path></svg>);


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
                    max-width: 100% !important; 
                    height: auto !important; 
                }
                /* Adjusted for 4 gauges remaining */
                @media (min-width: 768px) {
                    .gauges-container {
                        grid-template-columns: repeat(4, 1fr); /* Back to 4 columns */
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
                                <p className="text-3xl font-black mb-1 text-slate-50">
                                    {rainStatus.reading}
                                </p>
                                <p className={`text-sm ${rainStatus.className}`}>{rainStatus.status}</p>
                            </article>

                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-purple-500/50 hover:scale-[1.02] border border-slate-700 hover:border-purple-600/70">
                                <GaugeIcon className="w-10 h-10 mb-3 text-purple-400 p-2 bg-purple-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Barometric Pressure</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{liveData.pressure.toFixed(1)} hPa</p>
                                <p className={`text-sm ${pressureStatus.className}`}>{pressureStatus.status}</p>
                            </article>
                            
                            {/* Water Tank Status (Categorical Ultrasonic) - Card 3 */}
                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-cyan-500/50 hover:scale-[1.02] border border-slate-700 hover:border-cyan-600/70">
                                <BoxIcon className="w-10 h-10 mb-3 text-cyan-400 p-2 bg-cyan-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Water Tank Status</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">{waterTankStatus.reading}</p>
                                <p className={`text-sm ${waterTankStatus.className}`}>{waterTankStatus.status}</p>
                            </article>

                            <article className="card p-5 bg-slate-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-orange-500/50 hover:scale-[1.02] border border-slate-700 hover:border-orange-600/70">
                                <LeafIcon className="w-10 h-10 mb-3 text-orange-400 p-2 bg-orange-900/40 rounded-lg" />
                                <h3 className="text-lg font-semibold mb-1 text-slate-300">Soil Moisture</h3>
                                <p className="text-3xl font-black mb-1 text-slate-50">
                                    {soilStatus.reading}
                                </p>
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
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Rain: <span className="text-sky-400">{rainStatus.reading}</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugePressure" ref={pressureGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Pressure: <span className="text-purple-400">{liveData.pressure.toFixed(1)} hPa</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeWaterTank" ref={waterTankGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Water Level: <span className="text-cyan-400">{waterTankStatus.reading}</span></p>
                                    </div>
                                    <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                        <canvas id="gaugeSoil" ref={soilGaugeRef} className="max-w-full h-auto"></canvas>
                                        <p className="mt-3 text-lg font-semibold text-slate-300">Soil Moisture: <span className="text-orange-400">{soilStatus.reading}</span></p>
                                    </div>
                                </div>
                            </article>

                            <article className="card p-6 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
                                <h3 className="text-2xl font-bold mb-6 text-slate-200 border-b border-slate-700 pb-2">7-Day Historical Trends (Chart)</h3>
                                <div className="chart-container">
                                    <canvas id="historyChart" ref={historyChartRef}></canvas>
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