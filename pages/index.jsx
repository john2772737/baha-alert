import React, { useState, useEffect, useMemo } from 'react';
import { Clock, CloudRain, Gauge, Droplet, Leaf, RefreshCcw } from 'lucide-react';

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
    // State to hold the live data and time
    const [liveData, setLiveData] = useState(initialSensorData);
    const [currentTime, setCurrentTime] = useState(getFormattedTime());

    // --- Data Update Logic (Mock Data) ---
    const updateMockData = () => {
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

    // Time and Data Update Intervals
    useEffect(() => {
        // Time update
        const timeInterval = setInterval(() => {
            setCurrentTime(getFormattedTime());
        }, 10000);

        // Data update (every 5 seconds)
        const dataInterval = setInterval(updateMockData, 5000);

        return () => {
            clearInterval(timeInterval);
            clearInterval(dataInterval);
        };
    }, []);

    // --- Status Calculation Functions ---
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

    // Use useMemo to prevent unnecessary recalculations
    const rainStatus = useMemo(() => getRainStatus(liveData.rain), [liveData.rain]);
    const pressureStatus = useMemo(() => getPressureStatus(liveData.pressure), [liveData.pressure]);
    const waterStatus = useMemo(() => getWaterStatus(liveData.waterLevel), [liveData.waterLevel]);
    const soilStatus = useMemo(() => getSoilStatus(liveData.soil), [liveData.soil]);

    // Hardcoded historical data (kept for the table)
    const hardcodedHistory = [
        { day: 'Sun', rain: 0, pressure: 1018, level: 70, soil: 68 },
        { day: 'Mon', rain: 1, pressure: 1012, level: 65, soil: 60 },
        { day: 'Tue', rain: 0, pressure: 1008, level: 68, soil: 55 },
        { day: 'Wed', rain: 20, pressure: 1015, level: 70, soil: 65 },
        { day: 'Thu', rain: 5, pressure: 1010, level: 62, soil: 70 },
        { day: 'Fri', rain: 0, pressure: 995, level: 75, soil: 80 },
        { day: 'Sat', rain: 0, pressure: 1000, level: 80, soil: 75 },
    ];
    
    // --- SVG ICON COMPONENTS (Kept for compatibility without external library) ---
    const ClockIcon = (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
    );
    const CloudRainIcon = (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 20v-3"></path><path d="M8 20v-3"></path><path d="M12 18v-3"></path></svg>
    );
    const GaugeIcon = (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"></path><path d="M9 13l3 3 3-3"></path></svg>
    );
    const DropletIcon = (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69L6 8.52A10.74 10.74 0 0 0 12 22a10.74 10.74 0 0 0 6-13.48L12 2.69z"></path></svg>
    );
    const LeafIcon = (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A10 10 0 0 0 2 11c0-4 4-4 8-8 3 0 4 3 4 5 0 2-3 5-3 5l-1 1 1 1c1.5 1.5 3.5 1.5 5 0l1-1c3 0 5 3 5 5 0 3-4 5-8 5z"></path></svg>
    );


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
                    /* Placeholder for Canvas sizing - Enhanced background */
                    max-width: 100% !important; 
                    height: 100px !important; 
                    background-color: #1f2937; /* Gray-800 */
                    border-radius: 8px;
                    border: 1px solid #374151; /* Subtle border */
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
                    <span id="current-time">{currentTime}</span> {/* Dynamic */}
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
                        <p className="text-2xl font-black mb-1 text-gray-50">{liveData.pressure} hPa</p> {/* Dynamic */}
                        <p className={`text-sm ${pressureStatus.className}`}>{pressureStatus.status}</p>
                    </article>

                    <article className="card p-5 bg-gray-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-cyan-500/30 hover:scale-[1.02] border border-gray-700/50">
                        <DropletIcon className="w-9 h-9 mb-3 text-cyan-400 p-1 bg-cyan-900/40 rounded-lg" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Water Level (Tank)</h3>
                        <p className="text-2xl font-black mb-1 text-gray-50">{liveData.waterLevel}%</p> {/* Dynamic */}
                        <p className={`text-sm ${waterStatus.className}`}>{waterStatus.status}</p>
                    </article>

                    <article className="card p-5 bg-gray-800 rounded-xl shadow-2xl transition duration-300 hover:shadow-lime-500/30 hover:scale-[1.02] border border-gray-700/50">
                        <LeafIcon className="w-9 h-9 mb-3 text-lime-400 p-1 bg-lime-900/40 rounded-lg" />
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Soil Moisture</h3>
                        <p className="text-2xl font-black mb-1 text-gray-50">{soilStatus.reading}</p>
                        <p className={`text-sm ${soilStatus.className}`}>{soilStatus.status}</p>
                    </article>
                </section>

                {/* Main Content Section - Gauges & Chart (Dynamic Data with Static Canvas Placeholders) */}
                <section className="grid grid-cols-1 gap-8 md:grid-cols-1">
                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700/50">
                        <h3 className="text-2xl font-bold mb-6 text-gray-200 border-b border-gray-700 pb-2">Live Sensor Readings (Gauges Placeholder)</h3>
                        <div className="gauges-container">
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeRain" className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Rain: <span className="text-emerald-400">{liveData.rain} mm/hr</span></p> {/* Dynamic */}
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugePressure" className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Pressure: <span className="text-violet-400">{liveData.pressure} hPa</span></p> {/* Dynamic */}
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeWaterLevel" className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Water Level: <span className="text-cyan-400">{liveData.waterLevel}%</span></p> {/* Dynamic */}
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                <canvas id="gaugeSoil" className="max-w-full h-auto"></canvas>
                                <p className="mt-3 text-md font-semibold text-gray-300">Soil Moisture: <span className="text-lime-400">{liveData.soil}%</span></p> {/* Dynamic */}
                            </div>
                        </div>
                    </article>

                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700/50">
                        <h3 className="text-2xl font-bold mb-6 text-gray-200 border-b border-gray-700 pb-2">7-Day Historical Trends (Data Table)</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden">
                                <thead className="bg-gray-700">
                                    <tr className="uppercase text-xs tracking-wider">
                                        <th className="px-4 py-3 text-left font-bold text-gray-300">Day</th>
                                        <th className="px-4 py-3 text-left font-bold text-emerald-400">Rain (mm)</th>
                                        <th className="px-4 py-3 text-left font-bold text-violet-400">Pressure (hPa)</th>
                                        <th className="px-4 py-3 text-left font-bold text-cyan-400">Water Level (%)</th>
                                        <th className="px-4 py-3 text-left font-bold text-lime-400">Soil Moisture (%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700 bg-gray-800">
                                    {hardcodedHistory.map((dayData, index) => (
                                        <tr key={index} className="hover:bg-gray-700 transition duration-150">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-300">{dayData.day}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${dayData.rain > 15 ? 'text-red-400' : dayData.rain > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>{dayData.rain}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-violet-300">{dayData.pressure}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm text-cyan-300 ${dayData.level < 30 ? 'text-red-400 font-bold' : ''}`}>{dayData.level}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm text-lime-300 ${dayData.soil < 30 ? 'text-red-400 font-bold' : ''}`}>{dayData.soil}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </section>
            </main>
        </div>
    );
}

export default App;