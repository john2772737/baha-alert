// components/ModeView.jsx
import React from 'react';
import { getRainStatus, getSoilStatus, getWaterTankStatus, getPressureStatus } from '../utils/sensorUtils';
import { CloudRainIcon, GaugeIcon, BoxIcon, LeafIcon, MoonIcon, RefreshCcwIcon, CpuIcon } from '../utils/icons';

// --- Card Components (for brevity) ---
const StatusCard = ({ Icon, title, reading, status, className }) => (
    <article className="p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
        <Icon className={`w-8 h-8 mb-3 p-1.5 rounded-lg ${className}`} />
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <p className="text-2xl font-black text-white">{reading}</p>
        <p className={`text-xs ${className.split(' ')[2]}`}>{status}</p>
    </article>
);

const ModeView = ({ mode, setMode, liveData, fetchError, refs, percents }) => {
    // Computed Statuses
    const rainStatus = getRainStatus(percents.rainPercent);
    const soilStatus = getSoilStatus(percents.soilPercent);
    const waterTankStatus = getWaterTankStatus(percents.waterPercent, liveData.waterDistanceCM);
    const pressureStatus = getPressureStatus(liveData.pressure);

    // --- Auto Mode Display ---
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
    
    // --- Mode Conflict / Other Mode Display ---
    const isConflict = mode === 'Auto' && liveData.deviceMode !== 'AUTO';
    const displayMode = isConflict ? liveData.deviceMode : mode;
    const Icon = displayMode === 'SLEEP' ? MoonIcon : (displayMode === 'MAINTENANCE' ? RefreshCcwIcon : CpuIcon);

    return (
        <div className="p-10 bg-slate-800 rounded-2xl border border-slate-700 text-center flex flex-col items-center min-h-[40vh] justify-center">
            <Icon className={`w-12 h-12 mb-4 ${isConflict ? 'text-yellow-400' : 'text-indigo-400'} ${displayMode === 'MAINTENANCE' ? 'animate-spin' : ''}`} />
            <h3 className="text-2xl font-bold text-slate-200 mb-2">
                {isConflict ? 'Device Mode Conflict' : `UI in ${mode} View`}
            </h3>
            <p className="text-slate-400 max-w-md">
                The physical device is reporting its current operational mode as **<span className="text-yellow-300 font-mono font-bold">{liveData.deviceMode}</span>**.
                {isConflict 
                    ? ` The dashboard cannot display live data. Switch to the ${liveData.deviceMode} tab to view status details.`
                    : mode === 'Sleep' 
                        ? " This mode conserves power; the device must be woken by a physical button press."
                        : " This mode is for calibration/diagnostics; minimal data is uploaded."
                }
            </p>
            <div className="flex space-x-4 mt-6">
                {isConflict && liveData.deviceMode !== '---' && (
                    <button onClick={() => setMode(liveData.deviceMode)} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg shadow-md transition-colors">
                        Go to {liveData.deviceMode} Tab
                    </button>
                )}
                <button onClick={() => setMode('Auto')} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md transition-colors">
                    View Auto Dashboard
                </button>
            </div>
        </div>
    );
};

export default ModeView;