// components/ModeView.jsx
import React, { useState } from 'react';
import { getRainStatus, getSoilStatus, getWaterTankStatus, getPressureStatus } from '../utils/sensorUtils';
import { CloudRainIcon, GaugeIcon, BoxIcon, LeafIcon, MoonIcon, RefreshCcwIcon, CpuIcon, CheckCircleIcon, XCircleIcon, ActivityIcon } from '../utils/icons';

// --- Reusable Status Card (Auto Mode) ---
const StatusCard = ({ Icon, title, reading, status, className }) => (
    <article className="p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
        <Icon className={`w-8 h-8 mb-3 p-1.5 rounded-lg ${className}`} />
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <p className="text-2xl font-black text-white">{reading}</p>
        <p className={`text-xs ${className.split(' ')[2]}`}>{status}</p>
    </article>
);

// --- New Maintenance Test Card ---
const TestCard = ({ Icon, title, rawValue, percentValue, onTest, testState }) => {
    return (
        <div className="p-5 bg-slate-800 rounded-xl border border-slate-700 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <Icon className="w-10 h-10 p-2 bg-slate-700/50 rounded-lg text-indigo-400" />
                    <div>
                        <h4 className="font-bold text-slate-200">{title}</h4>
                        <span className="text-xs text-slate-500 font-mono">ID: {title.toUpperCase().slice(0, 3)}_01</span>
                    </div>
                </div>
                {/* Test Status Indicator */}
                {testState.status === 'success' && <CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
                {testState.status === 'error' && <XCircleIcon className="w-6 h-6 text-red-500" />}
            </div>

            <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Raw Input:</span>
                    <span className="font-mono text-slate-200">{rawValue}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Calibrated:</span>
                    <span className="font-mono text-emerald-400 font-bold">{percentValue}</span>
                </div>
            </div>

            <button
                onClick={onTest}
                disabled={testState.status === 'loading'}
                className={`w-full py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2
                    ${testState.status === 'loading' 
                        ? 'bg-slate-700 text-slate-400 cursor-wait' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}
            >
                {testState.status === 'loading' ? (
                    <>
                        <RefreshCcwIcon className="w-4 h-4 animate-spin" /> Testing...
                    </>
                ) : (
                    <>
                        <ActivityIcon className="w-4 h-4" /> Run Diagnostic
                    </>
                )}
            </button>
            
            {testState.message && (
                <p className={`mt-3 text-xs text-center ${testState.status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {testState.message}
                </p>
            )}
        </div>
    );
};

const ModeView = ({ mode, setMode, liveData, fetchError, refs, percents }) => {
    // State for managing individual sensor tests
    const [testStates, setTestStates] = useState({
        rain: { status: 'idle', message: '' },
        soil: { status: 'idle', message: '' },
        water: { status: 'idle', message: '' },
        pressure: { status: 'idle', message: '' },
    });

    // Helper to calculate statuses for Auto View
    const rainStatus = getRainStatus(percents.rainPercent);
    const soilStatus = getSoilStatus(percents.soilPercent);
    const waterTankStatus = getWaterTankStatus(percents.waterPercent, liveData.waterDistanceCM);
    const pressureStatus = getPressureStatus(liveData.pressure);

    // Mock Test Function (Replace with real API call later)
    const runSensorTest = async (sensorKey) => {
        setTestStates(prev => ({ ...prev, [sensorKey]: { status: 'loading', message: '' } }));

        // Simulate network delay
        setTimeout(() => {
            // Random pass/fail logic for demonstration
            const isSuccess = Math.random() > 0.1; 
            setTestStates(prev => ({
                ...prev,
                [sensorKey]: {
                    status: isSuccess ? 'success' : 'error',
                    message: isSuccess ? 'Sensor responding normally.' : 'Timeout: Check wiring.'
                }
            }));
        }, 1500);
    };

    // --- 1. AUTO MODE VIEW ---
    if (mode === 'Auto' && liveData.deviceMode === 'AUTO') {
        return (
            <>
                {fetchError && <div className="p-3 bg-red-900/30 text-red-300 rounded-lg border border-red-800 text-center font-semibold text-sm">{fetchError}</div>}

                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatusCard Icon={CloudRainIcon} title="Rain Sensor" reading={rainStatus.reading} status={rainStatus.status} className="text-sky-400 bg-sky-900/30" />
                    <StatusCard Icon={GaugeIcon} title="Pressure" reading={`${liveData.pressure.toFixed(1)} hPa`} status={pressureStatus.status} className="text-purple-400 bg-purple-900/30" />
                    <StatusCard Icon={BoxIcon} title="Water Level" reading={waterTankStatus.reading} status={waterTankStatus.status} className="text-cyan-400 bg-cyan-900/30" />
                    <StatusCard Icon={LeafIcon} title="Soil Moisture" reading={soilStatus.reading} status={soilStatus.status} className="text-orange-400 bg-orange-900/30" />
                </section>
                
                <section className="grid grid-cols-1 gap-6">
                    <article className="p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                        <h3 className="text-xl font-bold mb-6 text-slate-200">Live Sensors (Percent)</h3>
                        <div className="gauges-container">
                            <div className="gauge-wrapper flex flex-col items-center"><canvas ref={refs.rainGaugeRef}></canvas><p className="mt-2 text-sm font-bold text-slate-300">Wetness: <span className="text-sky-400">{percents.rainPercent}%</span></p></div>
                            <div className="gauge-wrapper flex flex-col items-center"><canvas ref={refs.pressureGaugeRef}></canvas><p className="mt-2 text-sm font-bold text-slate-300">Pressure: <span className="text-purple-400">{liveData.pressure.toFixed(0)} hPa</span></p></div>
                            <div className="gauge-wrapper flex flex-col items-center"><canvas ref={refs.waterTankGaugeRef}></canvas><p className="mt-2 text-sm font-bold text-slate-300">Tank Level: <span className="text-cyan-400">{percents.waterPercent}%</span></p>{liveData.waterDistanceCM >= 400 && <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Check Sensor</span>}</div>
                            <div className="gauge-wrapper flex flex-col items-center"><canvas ref={refs.soilGaugeRef}></canvas><p className="mt-2 text-sm font-bold text-slate-300">Moisture: <span className="text-orange-400">{percents.soilPercent}%</span></p></div>
                        </div>
                    </article>
                    <article className="p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                        <h3 className="text-xl font-bold mb-4 text-slate-200">Historical Trends</h3>
                        <div className="chart-container"><canvas ref={refs.historyChartRef}></canvas></div>
                    </article>
                </section>
            </>
        );
    }

    // --- 2. MAINTENANCE MODE VIEW ---
    if (mode === 'Maintenance') {
        return (
            <section className="space-y-6">
                <div className="p-6 bg-yellow-900/20 rounded-2xl border border-yellow-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-600/20 rounded-xl">
                            <RefreshCcwIcon className="w-8 h-8 text-yellow-500 animate-spin-slow" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-yellow-100">System Maintenance Mode</h2>
                            <p className="text-yellow-400/80 text-sm">Automatic data logging is paused. Manual testing enabled.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setMode('Auto')}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg font-semibold transition-colors"
                    >
                        Exit Maintenance
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <TestCard 
                        Icon={CloudRainIcon} 
                        title="Rain Sensor" 
                        rawValue={liveData.rainAnalog} // Assuming these exist in liveData
                        percentValue={`${percents.rainPercent}%`}
                        testState={testStates.rain}
                        onTest={() => runSensorTest('rain')}
                    />
                    <TestCard 
                        Icon={LeafIcon} 
                        title="Soil Sensor" 
                        rawValue={liveData.soilAnalog}
                        percentValue={`${percents.soilPercent}%`}
                        testState={testStates.soil}
                        onTest={() => runSensorTest('soil')}
                    />
                    <TestCard 
                        Icon={BoxIcon} 
                        title="Water Sensor" 
                        rawValue={`${liveData.waterDistanceCM}cm`}
                        percentValue={`${percents.waterPercent}%`}
                        testState={testStates.water}
                        onTest={() => runSensorTest('water')}
                    />
                    <TestCard 
                        Icon={GaugeIcon} 
                        title="Barometer" 
                        rawValue={`${liveData.pressure}hPa`}
                        percentValue="N/A"
                        testState={testStates.pressure}
                        onTest={() => runSensorTest('pressure')}
                    />
                </div>

                {/* Additional Raw Data Panel */}
                <article className="p-6 bg-slate-800 rounded-2xl border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <CpuIcon className="w-5 h-5 text-indigo-400" />
                        System Health Diagnostics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-mono text-slate-400">
                        <div className="p-3 bg-slate-900 rounded-lg">
                            <span className="block text-xs text-slate-500 mb-1">UPTIME</span>
                            <span className="text-emerald-400">04:22:11</span>
                        </div>
                        <div className="p-3 bg-slate-900 rounded-lg">
                            <span className="block text-xs text-slate-500 mb-1">WIFI SIGNAL</span>
                            <span className="text-emerald-400">-42 dBm</span>
                        </div>
                        <div className="p-3 bg-slate-900 rounded-lg">
                            <span className="block text-xs text-slate-500 mb-1">MEMORY</span>
                            <span className="text-emerald-400">142 KB Free</span>
                        </div>
                        <div className="p-3 bg-slate-900 rounded-lg">
                            <span className="block text-xs text-slate-500 mb-1">API LATENCY</span>
                            <span className="text-emerald-400">45ms</span>
                        </div>
                    </div>
                </article>
            </section>
        );
    }
    
    // --- 3. SLEEP / CONFLICT FALLBACK ---
    const isConflict = liveData.deviceMode !== 'AUTO';
    const displayMode = isConflict ? liveData.deviceMode : mode;
    const Icon = displayMode === 'SLEEP' ? MoonIcon : CpuIcon;

    return (
        <div className="p-10 bg-slate-800 rounded-2xl border border-slate-700 text-center flex flex-col items-center min-h-[40vh] justify-center">
            <Icon className={`w-12 h-12 mb-4 ${isConflict ? 'text-yellow-400' : 'text-indigo-400'}`} />
            <h3 className="text-2xl font-bold text-slate-200 mb-2">
                {isConflict ? 'Device Mode Conflict' : `System is Sleeping`}
            </h3>
            <p className="text-slate-400 max-w-md">
                The device is currently in <strong>{liveData.deviceMode}</strong> mode. 
                {displayMode === 'SLEEP' && " Sensors are powered down to save battery. Wake device to view data."}
            </p>
            <div className="flex space-x-4 mt-6">
                 <button onClick={() => setMode('Auto')} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md transition-colors">
                    Wake / View Auto
                </button>
            </div>
        </div>
    );
};

export default ModeView;