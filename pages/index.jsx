import React from 'react';

// Hardcoded data and structure for a static UI demonstration
const App = () => {
    const hardcodedData = {
        pressure: 1015, // hPa
        rain: 5, // mm/hr
        waterLevel: 75, // %
        soil: 55, // %
        currentTime: "Monday, November 24, 2025, 02:40 PM"
    };

    // Helper functions removed, replaced with hardcoded status and classes
    const rainStatus = { reading: 'Light Rain', status: 'STATUS: Light Rainfall', className: 'text-green-400 font-bold' };
    const pressureStatus = { status: 'STATUS: Normal Pressure', className: 'text-green-400 font-bold' };
    const waterStatus = { status: 'STATUS: Optimal', className: 'text-green-400 font-bold' };
    const soilStatus = { reading: 'Optimal', status: 'STATUS: Soil Moisture Optimal', className: 'text-green-400 font-bold' };
    
    // Canvas elements are kept but will not initialize without the libraries
    
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
                    /* Placeholder for Canvas sizing */
                    max-width: 100% !important; 
                    height: 100px !important; 
                    background-color: #374151; /* Dark background placeholder */
                    border-radius: 8px;
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
                    Smart Farm Monitor (Static UI)
                </h1>
                <div className="flex items-center text-sm font-medium text-gray-400">
                    {/* Placeholder for Clock Icon */}
                    <span className="w-4 h-4 mr-2 text-indigo-400">🕒</span> 
                    <span id="current-time">{hardcodedData.currentTime}</span>
                </div>
            </header>

            <main className="space-y-8">
                {/* Status Grid Section */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-emerald-500">
                        {/* Placeholder for CloudRain Icon */}
                        <span className="w-8 h-8 mb-2 text-emerald-400 text-3xl">🌧️</span> 
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Rain Sensor</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{rainStatus.reading}</p>
                        <p className={`text-sm ${rainStatus.className}`}>{rainStatus.status}</p>
                    </article>

                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-violet-500">
                        {/* Placeholder for Gauge Icon */}
                        <span className="w-8 h-8 mb-2 text-violet-400 text-3xl">🎚️</span> 
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Barometric Pressure</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{hardcodedData.pressure} hPa</p>
                        <p className={`text-sm ${pressureStatus.className}`}>{pressureStatus.status}</p>
                    </article>

                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-cyan-500">
                        {/* Placeholder for Droplet Icon */}
                        <span className="w-8 h-8 mb-2 text-cyan-400 text-3xl">💧</span> 
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Water Level (Tank)</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{hardcodedData.waterLevel}%</p>
                        <p className={`text-sm ${waterStatus.className}`}>{waterStatus.status}</p>
                    </article>

                    <article className="card p-4 bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] border-t-4 border-lime-500">
                        {/* Placeholder for Leaf Icon */}
                        <span className="w-8 h-8 mb-2 text-lime-400 text-3xl">🌱</span> 
                        <h3 className="text-lg font-semibold mb-1 text-gray-300">Soil Moisture</h3>
                        <p className="text-xl font-extrabold mb-1 text-gray-100">{soilStatus.reading}</p>
                        <p className={`text-sm ${soilStatus.className}`}>{soilStatus.status}</p>
                    </article>
                </section>

                {/* Main Content Section - Gauges & Chart (Static Canvas Placeholders) */}
                <section className="grid grid-cols-1 gap-8 md:grid-cols-1">
                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl">
                        <h3 className="text-2xl font-bold mb-4 text-gray-200">Live Sensor Readings (Gauges Placeholder)</h3>
                        <div className="gauges-container">
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                {/* Static Canvas element for Gauge */}
                                <canvas id="gaugeRain" className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Rain: {hardcodedData.rain} mm/hr</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                {/* Static Canvas element for Gauge */}
                                <canvas id="gaugePressure" className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Pressure: {hardcodedData.pressure} hPa</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                {/* Static Canvas element for Gauge */}
                                <canvas id="gaugeWaterLevel" className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Water Level: {hardcodedData.waterLevel}%</p>
                            </div>
                            <div className="gauge-wrapper flex flex-col items-center justify-center p-2">
                                {/* Static Canvas element for Gauge */}
                                <canvas id="gaugeSoil" className="max-w-full h-auto"></canvas>
                                <p className="mt-2 text-sm text-gray-400">Soil Moisture: {hardcodedData.soil}%</p>
                            </div>
                        </div>
                    </article>

                    <article className="card p-6 bg-gray-800 rounded-xl shadow-2xl">
                        <h3 className="text-2xl font-bold mb-4 text-gray-200">7-Day Historical Trends Placeholder</h3>
                        <div className="chart-container">
                            {/* Static Canvas element for Chart */}
                            <canvas id="historyChart" className="bg-gray-700 rounded-lg"></canvas>
                        </div>
                    </article>
                </section>
            </main>
        </div>
    );
}

export default App;