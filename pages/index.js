import React, { useState, useEffect, useRef, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import '../styles/weather.css'; // Assuming this file is available in the styles folder

// Load Chart component dynamically (keep Chart.js managed by npm)
const DynamicChart = dynamic(() => import('chart.js'), { ssr: false });

// --- Initial Data Structure (Matching your ESP32 payload) ---
const initialSensorData = {
    pressure: 1012, // hPa
    rain: 0, // mm/hr (simulated)
    waterLevel: 65, // %
    soil: 60, // %
    timestamp_client: new Date().toISOString()
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

// --- Sensor Component (Refactored from your original JS) ---
function SensorDashboard() {
    // State to hold the live data
    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState(getFormattedTime());
    const [isDark] = useState(true); // Default to dark mode

    // Refs for the Canvas elements to initialize Gauge/Chart.js
    const rainGaugeRef = useRef(null);
    const pressureGaugeRef = useRef(null);
    const waterLevelGaugeRef = useRef(null);
    const soilGaugeRef = useRef(null);
    const historyChartRef = useRef(null);

    // Refs for Gauge instances (to update them later)
    const gaugeInstances = useRef({});

    // === 0. Theme Handling and Current Time ===
    useEffect(() => {
        // Apply initial theme attribute to body
        // Ensure this only runs on the client side
        if (typeof document !== 'undefined') {
            document.body.setAttribute('data-theme', 'dark');
        }

        // Time update interval
        const timeInterval = setInterval(() => {
            setCurrentTime(getFormattedTime());
        }, 10000);

        return () => clearInterval(timeInterval);
    }, []);

    // === 1. Initialization Effect (Runs after DOM is ready) ===
    useEffect(() => {
        // Check if the component is mounted AND if the CDN libraries are loaded onto the window object
        if (typeof window === 'undefined' || !window.Gauge || !window.Chart) return;
        
        // Base Gauge.js options (modified for React)
        const gaugeOptions = {
            angle: 0.15,
            lineWidth: 0.3,
            radiusScale: 0.9,
            pointer: { length: 0.5, strokeWidth: 0.035, color: isDark ? '#e2e8f0' : '#333333' },
            staticLabels: { font: "12px sans-serif", labels: [], color: isDark ? '#e2e8f0' : '#000000' },
            staticZones: [],
            limitMax: false, limitMin: false, highDpiSupport: true,
            strokeColor: isDark ? '#4a5568' : '#E0E0E0',
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

                // Use the globally available Gauge constructor (window.Gauge)
                const gauge = new window.Gauge(ref.current).setOptions(options);
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
        if (historyChartRef.current && window.Chart) {
            const chartTextColor = isDark ? '#e2e8f0' : '#333';
            
            // Sample data from your original JS
            const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const rainData = [0, 1, 0, 0, 2, 1, 0]; 
            const pressureData = [1012, 1008, 1015, 1010, 995, 1000, 1018];
            const waterLevelData = [65, 68, 70, 62, 75, 80, 70];
            const soilMoistureData = [60, 55, 65, 70, 80, 75, 68];

            gaugeInstances.current.chart = new window.Chart(historyChartRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Rain Sensor', data: rainData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: false, tension: 0.3, yAxisID: 'yRain', stepped: true },
                        { label: 'Barometer Pressure (hPa)', data: pressureData, borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 0.1)', fill: false, tension: 0.3, yAxisID: 'yPressure' },
                        { label: 'Water Level (%)', data: waterLevelData, borderColor: 'rgba(6, 182, 212, 1)', backgroundColor: 'rgba(6, 182, 212, 0.1)', fill: true, tension: 0.3, yAxisID: 'yWaterLevel' },
                        { label: 'Soil Moisture (%)', data: soilMoistureData, borderColor: 'rgba(132, 204, 22, 1)', backgroundColor: 'rgba(132, 204, 22, 0.1)', fill: true, tension: 0.3, yAxisID: 'ySoil' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { grid: { color: 'rgba(107, 114, 128, 0.2)' }, ticks: { color: chartTextColor } },
                        yRain: { type: 'linear', position: 'left', beginAtZero: true, max: 3, grid: { color: 'rgba(107, 114, 128, 0.2)' }, ticks: { stepSize: 1, callback: (v) => v === 0 ? 'No Rain' : v === 1 ? 'Light' : v === 2 ? 'Moderate' : v === 3 ? 'Heavy' : '', color: chartTextColor } },
                        yPressure: { type: 'linear', position: 'right', beginAtZero: false, grid: { display: false }, ticks: { callback: (v) => v + ' hPa', color: chartTextColor } },
                        yWaterLevel: { type: 'linear', position: 'left', offset: true, beginAtZero: true, max: 100, grid: { display: false }, ticks: { callback: (v) => v + '%', color: chartTextColor } },
                        ySoil: { type: 'linear', position: 'right', offset: true, beginAtZero: true, max: 100, grid: { display: false }, ticks: { callback: (v) => v + '%', color: chartTextColor } }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { color: chartTextColor } },
                        tooltip: { mode: 'index', intersect: false, callbacks: {
                            label: (c) => {
                                let label = c.dataset.label || '';
                                if (label) label += ': ';
                                if (c.dataset.label === 'Rain Sensor') label += c.raw === 0 ? 'No Rain' : c.raw === 1 ? 'Light' : c.raw === 2 ? 'Moderate' : 'Heavy';
                                else if (c.dataset.label.includes('Pressure')) label += c.raw + ' hPa';
                                else if (c.dataset.label.includes('%')) label += c.raw + '%';
                                else label += c.raw;
                                return label;
                            }
                        } }
                    }
                }
            });
        }
        
        // Cleanup function for charts/gauges (called when component unmounts)
        return () => {
            if (gaugeInstances.current.chart) {
                gaugeInstances.current.chart.destroy();
            }
        };
    }, [isDark]); 


    // === 2. Data Fetching and Mock Data Update (for testing) ===
    // Function to run mock data (for testing)
    const updateMockData = () => {
        // ... (Mock data generation logic here) ...
        const rainChance = Math.random();
        let newRainValue;
        if (rainChance < 0.1) newRainValue = (30 + Math.random() * 20).toFixed(0); // Heavy
        else if (rainChance < 0.3) newRainValue = (1 + Math.random() * 9).toFixed(0); // Light
        else newRainValue = 0; // No Rain

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
        // Run mock data updates every 5 seconds for testing purposes
        const interval = setInterval(updateMockData, 5000);
        return () => clearInterval(interval); // Cleanup
    }, []);

    // Effect to update the Gauge instances whenever liveData changes
    useEffect(() => {
        // Only attempt to set the gauges if they have been initialized AND the global Gauge object exists
        if (gaugeInstances.current.rain && window.Gauge) { 
            gaugeInstances.current.rain.set(liveData.rain);
            gaugeInstances.current.pressure.set(liveData.pressure);
            gaugeInstances.current.waterLevel.set(liveData.waterLevel);
            gaugeInstances.current.soil.set(liveData.soil);
        }
    }, [liveData]);


    // === 3. Helper functions to determine Status and Class Names ===
    const getRainStatus = (rain) => {
        if (rain > 30) return { reading: 'Heavy Rain', status: 'ALERT: Heavy Rainfall!', className: 'status alert' };
        if (rain > 0) return { reading: 'Light Rain', status: 'STATUS: Light Rainfall', className: 'status warning' };
        return { reading: 'No Rain', status: 'STATUS: Clear', className: 'status safe' };
    };
    const getPressureStatus = (pressure) => {
        if (pressure < 990) return { status: 'WARNING: Low Pressure!', className: 'status warning' };
        if (pressure > 1030) return { status: 'STATUS: High Pressure', className: 'status safe' };
        return { status: 'STATUS: Normal Pressure', className: 'status safe' };
    };
    const getWaterStatus = (level) => {
        if (level > 90) return { status: 'ALERT: Tank Nearing Full!', className: 'status warning' };
        if (level < 30) return { status: 'STATUS: Level Low', className: 'status alert' };
        return { status: 'STATUS: Optimal', className: 'status safe' };
    };
    const getSoilStatus = (moisture) => {
        if (moisture < 30) return { reading: 'Dry', status: 'ALERT: Soil is Dry!', className: 'status alert' };
        if (moisture < 70) return { reading: 'Optimal', status: 'STATUS: Soil Moisture Optimal', className: 'status safe' };
        return { reading: 'Wet', status: 'WARNING: Soil is Wet!', className: 'status warning' };
    };

    const rainStatus = useMemo(() => getRainStatus(liveData.rain), [liveData.rain]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);
    const waterStatus = useMemo(() => getWaterStatus(liveData.waterLevel), [liveData.waterLevel]);
    const soilStatus = useMemo(() => getSoilStatus(liveData.soil), [liveData.soil]);


    // --- RENDER ---
    return (
        <>
            <Head>
                <title>Smart Farm Monitor</title>
                {/* CRITICAL FIX: Load gauge.js via CDN since it fails npm install 
                  We keep Chart.js (which is more modern) via npm package.
                */}
                <script src="https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js" async defer></script>
                
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </Head>

            <div className="dashboard-container">
                <header>
                    <h1>Smart Farm Monitor</h1>
                    <div className="time" id="current-time">{currentTime}</div>
                </header>

                <main>
                    {/* Status Grid Section */}
                    <section className="status-grid">
                        <article className="card">
                            <h3>Rain Sensor</h3>
                            <i className="fas fa-cloud-rain icon" style={{color: 'var(--primary-color)'}}></i>
                            <p className="reading">{rainStatus.reading}</p>
                            <p className={rainStatus.className}>{rainStatus.status}</p>
                        </article>

                        <article className="card">
                            <h3>Barometric Pressure</h3>
                            <i className="fas fa-tachometer-alt icon" style={{color: '#6d28d9'}}></i>
                            <p className="reading">{liveData.pressure} hPa</p>
                            <p className={pressureStatus.className}>{pressureStatus.status}</p>
                        </article>

                        <article className="card">
                            <h3>Water Level(Tank)</h3>
                            <i className="fas fa-water icon" style={{color: '#0e7490'}}></i>
                            <p className="reading">Tank: {liveData.waterLevel}%</p>
                            <p className={waterStatus.className}>{waterStatus.status}</p>
                        </article>

                        <article className="card">
                            <h3>Soil Moisture</h3>
                            <i className="fas fa-seedling icon" style={{color: '#65a30d'}}></i>
                            <p className="reading">{soilStatus.reading}</p>
                            <p className={soilStatus.className}>{soilStatus.status}</p>
                        </article>
                    </section>

                    {/* Main Content Section - Gauges & Chart */}
                    <section className="main-content">
                        <article className="card live-readings">
                            <h3>Live Readings</h3>
                            <div className="gauges-container">
                                <div className="gauge-wrapper">
                                    <canvas id="gaugeRain" ref={rainGaugeRef} width="200" height="100"></canvas>
                                    <p>Rain: {liveData.rain} mm/hr</p>
                                </div>
                                <div className="gauge-wrapper">
                                    <canvas id="gaugePressure" ref={pressureGaugeRef} width="200" height="100"></canvas>
                                    <p>Pressure: {liveData.pressure} hPa</p>
                                </div>
                                <div className="gauge-wrapper">
                                    <canvas id="gaugeWaterLevel" ref={waterLevelGaugeRef} width="200" height="100"></canvas>
                                    <p>Water Level: {liveData.waterLevel}%</p>
                                </div>
                                <div className="gauge-wrapper">
                                    <canvas id="gaugeSoil" ref={soilGaugeRef} width="200" height="100"></canvas>
                                    <p>Soil Moisture: {liveData.soil}%</p>
                                </div>
                            </div>
                        </article>

                        <article className="card history-chart">
                            <h3>7-Day History</h3>
                            <div className="chart-container">
                                <canvas id="historyChart" ref={historyChartRef}></canvas>
                            </div>
                        </article>
                    </section>
                </main>
            </div>
        </>
    );
}

export default SensorDashboard;