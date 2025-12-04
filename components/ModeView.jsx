import React, { useState, useEffect, useRef } from 'react';
import { getRainStatus, getSoilStatus, getWaterTankStatus, getPressureStatus } from '../utils/sensorUtils';
import { CloudRainIcon, GaugeIcon, BoxIcon, LeafIcon, MoonIcon, RefreshCcwIcon, CpuIcon, CheckCircleIcon, XCircleIcon, ActivityIcon, ArrowUpRightIcon } from '../utils/icons';

const API_ENDPOINT = 'https://baha-alert.vercel.app/api';

// --- Card Components ---
const StatusCard = ({ Icon, title, reading, status, className }) => (
    <article className="p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700 transition-transform hover:scale-105">
        <Icon className={`w-8 h-8 mb-3 p-1.5 rounded-lg ${className}`} />
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <p className="text-2xl font-black text-white">{reading}</p>
        <p className={`text-xs ${className.split(' ')[2]}`}>{status}</p>
    </article>
);

const TestControlCard = ({ Icon, title, sensorKey, dbValue, onToggle, isActive }) => (
    <div className={`p-5 rounded-xl border shadow-md flex flex-col justify-between transition-all ${isActive ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <Icon className={`w-10 h-10 p-2 rounded-lg ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-indigo-400'}`} />
                <div>
                    <h4 className="font-bold text-slate-200">{title}</h4>
                    <span className="text-xs text-slate-500 font-mono">
                        STATUS: {isActive ? <span className="text-emerald-400 animate-pulse">TESTING...</span> : 'IDLE'}
                    </span>
                </div>
            </div>
        </div>

        {/* Display Value from Database */}
        <div className="bg-slate-900/50 p-3 rounded-lg mb-4 text-sm font-mono flex justify-between items-center">
            <span className="text-slate-500">Live Result:</span>
            <span className={`font-bold text-lg ${dbValue && dbValue !== 'Waiting...' ? 'text-white' : 'text-slate-600'}`}>
                {dbValue || '--'}
            </span>
        </div>

        <button
            onClick={() => onToggle(sensorKey)}
            className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all
                ${isActive 
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'}`}
        >
            {isActive ? (
                <> <XCircleIcon className="w-4 h-4" /> STOP TEST </>
            ) : (
                <> <ActivityIcon className="w-4 h-4" /> START LOOP </>
            )}
        </button>
        
        <p className="text-[10px] text-center text-slate-500 mt-2 min-h-[15px]">
            {isActive ? "Sending commands to Arduino..." : "Ready to test"}
        </p>
    </div>
);

const ModeView = ({ mode, setMode, liveData, fetchError, refs, percents }) => {
    // State to track which sensors are currently looping
    const [activeTests, setActiveTests] = useState({
        rain: false, soil: false, water: false, pressure: false
    });

    // State to store the values fetched from DB
    const [dbValues, setDbValues] = useState({
        rain: null, soil: null, water: null, pressure: null
    });

    // MAPPING: Sensor Key -> Arduino Character
    const commandMap = { rain: 'R', soil: 'S', water: 'U', pressure: 'P' };

    // --- LOOP LOGIC ---
    useEffect(() => {
        const intervals = {};

        Object.keys(activeTests).forEach(sensorKey => {
            if (activeTests[sensorKey]) {
                // 1. Immediately trigger one cycle
                runTestCycle(sensorKey);

                // 2. Set interval to repeat every 3 seconds
                intervals[sensorKey] = setInterval(() => {
                    runTestCycle(sensorKey);
                }, 3000); 
            }
        });

        // Cleanup: Stop intervals when component unmounts or activeTests changes
        return () => {
            Object.values(intervals).forEach(clearInterval);
        };
    }, [activeTests]);

    // --- CORE FUNCTION: Post Command -> Wait -> Get Result ---
    const runTestCycle = async (sensorKey) => {
        try {
            // A. POST Command to DB
            await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'MAINTENANCE_TEST',
                    sensor: sensorKey,
                    command: commandMap[sensorKey], 
                    timestamp: new Date().toISOString(),
                    userAction: 'LOOP_TRIGGER'
                })
            });

            // B. Fetch Result (Wait 1.5s for ESP to process, then check DB)
            setTimeout(async () => {
                const res = await fetch(`${API_ENDPOINT}?latest_result=true&sensor=${sensorKey}`);
                const data = await res.json();
                if (data.success) {
                    setDbValues(prev => ({ ...prev, [sensorKey]: data.value }));
                }
            }, 1500);

        } catch (error) {
            console.error("Loop Error:", error);
        }
    };

    const toggleTest = (sensorKey) => {
        setActiveTests(prev => ({
            ...prev,
            [sensorKey]: !prev[sensorKey] // Toggle True/False
        }));
    };

    // --- VIEW 1: AUTO DASHBOARD ---
    if (mode === 'Auto' && liveData.deviceMode === 'AUTO') {
        // ... (Keep existing Auto View) ...
        const rainStatus = getRainStatus(percents.rainPercent);
        const soilStatus = getSoilStatus(percents.soilPercent);
        const waterTankStatus = getWaterTankStatus(percents.waterPercent, liveData.waterDistanceCM);
        const pressureStatus = getPressureStatus(liveData.pressure);

        return (
            <>
                {fetchError && <div className="p-3 bg-red-900/30 text-red-300 rounded-lg border border-red-800 text-center font-semibold text-sm mb-4">{fetchError}</div>}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatusCard Icon={CloudRainIcon} title="Rain Sensor" reading={rainStatus.reading} status={rainStatus.status} className="text-sky-400 bg-sky-900/30" />
                    <StatusCard Icon={GaugeIcon} title="Pressure" reading={`${liveData.pressure.toFixed(1)} hPa`} status={pressureStatus.status} className="text-purple-400 bg-purple-900/30" />
                    <StatusCard Icon={BoxIcon} title="Water Level" reading={waterTankStatus.reading} status={waterTankStatus.status} className="text-cyan-400 bg-cyan-900/30" />
                    <StatusCard Icon={LeafIcon} title="Soil Moisture" reading={soilStatus.reading} status={soilStatus.status} className="text-orange-400 bg-orange-900/30" />
                </section>
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <article className="lg:col-span-2 p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                        <h3 className="text-xl font-bold mb-6 text-slate-200">Historical Trends</h3>
                        <div className="chart-container h-64"><canvas ref={refs.historyChartRef}></canvas></div>
                    </article>
                    <article className="p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                        <h3 className="text-xl font-bold mb-6 text-slate-200">Live Gauges</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center"><canvas ref={refs.rainGaugeRef} className="w-full"></canvas><span className="text-xs mt-1 text-slate-400">Rain</span></div>
                            <div className="flex flex-col items-center"><canvas ref={refs.pressureGaugeRef} className="w-full"></canvas><span className="text-xs mt-1 text-slate-400">Pressure</span></div>
                            <div className="flex flex-col items-center"><canvas ref={refs.waterTankGaugeRef} className="w-full"></canvas><span className="text-xs mt-1 text-slate-400">Water</span></div>
                            <div className="flex flex-col items-center"><canvas ref={refs.soilGaugeRef} className="w-full"></canvas><span className="text-xs mt-1 text-slate-400">Soil</span></div>
                        </div>
                    </article>
                </section>
            </>
        );
    }

    // --- VIEW 2: MAINTENANCE / TEST MODE ---
    if (mode === 'Maintenance') {
        return (
            <section className="space-y-6">
                <div className="p-6 bg-yellow-900/10 rounded-2xl border border-yellow-600/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/10 rounded-xl">
                            <CpuIcon className="w-8 h-8 text-yellow-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-yellow-100">Maintenance Console</h2>
                            <p className="text-yellow-400/70 text-sm">Start a test loop to view live sensor readings from the hardware.</p>
                        </div>
                    </div>
                    <button onClick={() => setMode('Auto')} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg font-semibold transition-colors flex items-center gap-2">
                        <ArrowUpRightIcon className="w-4 h-4" /> Exit Mode
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <TestControlCard Icon={CloudRainIcon} title="Rain Sensor" sensorKey="rain" dbValue={dbValues.rain} isActive={activeTests.rain} onToggle={toggleTest} />
                    <TestControlCard Icon={LeafIcon} title="Soil Sensor" sensorKey="soil" dbValue={dbValues.soil} isActive={activeTests.soil} onToggle={toggleTest} />
                    <TestControlCard Icon={BoxIcon} title="Water Sensor" sensorKey="water" dbValue={dbValues.water} isActive={activeTests.water} onToggle={toggleTest} />
                    <TestControlCard Icon={GaugeIcon} title="Barometer" sensorKey="pressure" dbValue={dbValues.pressure} isActive={activeTests.pressure} onToggle={toggleTest} />
                </div>
                <div className="text-center text-xs text-slate-500 mt-4">
                    * Loops run every 3 seconds. Do not run multiple tests simultaneously to avoid bus conflict.
                </div>
            </section>
        );
    }

    // --- VIEW 3: FALLBACK ---
    const isConflict = liveData.deviceMode !== 'AUTO';
    const FallbackIcon = mode === 'SLEEP' ? MoonIcon : CpuIcon;

    return (
        <div className="p-10 bg-slate-800 rounded-2xl border border-slate-700 text-center flex flex-col items-center min-h-[40vh] justify-center">
            <FallbackIcon className={`w-16 h-16 mb-4 ${isConflict ? 'text-yellow-400' : 'text-indigo-400'}`} />
            <h3 className="text-2xl font-bold text-slate-200 mb-2">{isConflict ? `Device is in ${liveData.deviceMode}` : `System Sleeping`}</h3>
            <p className="text-slate-400 max-w-md mb-6">{isConflict ? `The physical device switch is set to ${liveData.deviceMode}.` : "Low power mode active."}</p>
            <button onClick={() => setMode('Auto')} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-colors">Return to Dashboard</button>
        </div>
    );
};

export default ModeView;