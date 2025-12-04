import React, { useState } from 'react';
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

const TestControlCard = ({ Icon, title, sensorKey, rawData, onTest, testState }) => (
    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <Icon className="w-10 h-10 p-2 bg-slate-700 rounded-lg text-indigo-400" />
                <div>
                    <h4 className="font-bold text-slate-200">{title}</h4>
                    <span className="text-xs text-slate-500 font-mono">STATUS: {testState.status.toUpperCase()}</span>
                </div>
            </div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded-lg mb-4 text-sm font-mono flex justify-between">
            <span className="text-slate-500">Current Value:</span>
            <span className="text-emerald-400">{rawData || 'N/A'}</span>
        </div>
        <button onClick={() => onTest(sensorKey)} disabled={testState.status === 'loading'} className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${testState.status === 'loading' ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'}`}>
            {testState.status === 'loading' ? <><RefreshCcwIcon className="w-4 h-4 animate-spin" /> Queuing...</> : testState.status === 'success' ? <><CheckCircleIcon className="w-4 h-4" /> Command Sent</> : <><ActivityIcon className="w-4 h-4" /> Trigger Test</>}
        </button>
        {testState.message && <p className={`mt-3 text-xs text-center ${testState.status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{testState.message}</p>}
    </div>
);

const ModeView = ({ mode, setMode, liveData, fetchError, refs, percents }) => {
    const [testStates, setTestStates] = useState({
        rain: { status: 'idle', message: '' },
        soil: { status: 'idle', message: '' },
        water: { status: 'idle', message: '' },
        pressure: { status: 'idle', message: '' },
    });

    const rainStatus = getRainStatus(percents.rainPercent);
    const soilStatus = getSoilStatus(percents.soilPercent);
    const waterTankStatus = getWaterTankStatus(percents.waterPercent, liveData.waterDistanceCM);
    const pressureStatus = getPressureStatus(liveData.pressure);

    // MAPPING: Sensor Key -> Arduino Character
    const commandMap = { rain: 'R', soil: 'S', water: 'U', pressure: 'P' };

    const postSensorTest = async (sensorKey) => {
        setTestStates(prev => ({ ...prev, [sensorKey]: { status: 'loading', message: '' } }));
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'MAINTENANCE_TEST',
                    sensor: sensorKey,
                    command: commandMap[sensorKey], 
                    timestamp: new Date().toISOString(),
                    userAction: 'MANUAL_TRIGGER'
                })
            });
            if (response.ok) {
                setTestStates(prev => ({ ...prev, [sensorKey]: { status: 'success', message: 'Command Queued for ESP' } }));
                setTimeout(() => setTestStates(prev => ({ ...prev, [sensorKey]: { status: 'idle', message: '' } })), 3000);
            } else throw new Error('API Failed');
        } catch (error) {
            setTestStates(prev => ({ ...prev, [sensorKey]: { status: 'error', message: 'Failed to post command' } }));
        }
    };

    if (mode === 'Auto' && liveData.deviceMode === 'AUTO') {
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
                            <p className="text-yellow-400/70 text-sm">Click buttons below to queue commands for the device.</p>
                        </div>
                    </div>
                    <button onClick={() => setMode('Auto')} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg font-semibold transition-colors flex items-center gap-2">
                        <ArrowUpRightIcon className="w-4 h-4" /> Exit Mode
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <TestControlCard Icon={CloudRainIcon} title="Rain Sensor" sensorKey="rain" rawData={liveData.rainAnalog} testState={testStates.rain} onTest={postSensorTest} />
                    <TestControlCard Icon={LeafIcon} title="Soil Sensor" sensorKey="soil" rawData={liveData.soilAnalog} testState={testStates.soil} onTest={postSensorTest} />
                    <TestControlCard Icon={BoxIcon} title="Water Sensor" sensorKey="water" rawData={`${liveData.waterDistanceCM} cm`} testState={testStates.water} onTest={postSensorTest} />
                    <TestControlCard Icon={GaugeIcon} title="Barometer" sensorKey="pressure" rawData={`${liveData.pressure} hPa`} testState={testStates.pressure} onTest={postSensorTest} />
                </div>
            </section>
        );
    }

    const isConflict = liveData.deviceMode !== 'AUTO';
    const displayMode = isConflict ? liveData.deviceMode : mode;
    const FallbackIcon = displayMode === 'SLEEP' ? MoonIcon : CpuIcon;

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