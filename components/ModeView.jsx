import React, { useState, useEffect } from "react";
import {
  getRainStatus,
  getSoilStatus,
  getWaterTankStatus,
  getPressureStatus,
} from "../utils/sensorUtils";
import {
  CloudRainIcon,
  GaugeIcon,
  BoxIcon,
  LeafIcon,
  MoonIcon,
  RefreshCcwIcon,
  CpuIcon,
  CheckCircleIcon,
  XCircleIcon,
  ActivityIcon,
  ArrowUpRightIcon,
  LockIcon,
  BellIcon,
} from "../utils/icons";
import AICard from "./AICard"; 
import { useAuth } from '../context/AuthContext'; // Needed for AlertSettingsComponent

const API_ENDPOINT = "https://baha-alert.vercel.app/api";

// --- START: ALERT SETTINGS PAGE COMPONENT (Integrated) ---

const AlertSettingsComponent = ({ setMode }) => {
    // 1. Get user context
    const { user, loading } = useAuth(); 
    const userEmail = user && user.email ? user.email : null; 
    
    // 2. State for form and status
    const [recipientNumber, setRecipientNumber] = useState('');
    const [currentStatus, setCurrentStatus] = useState(loading ? 'Initializing...' : 'Loading...');
    const [toastMessage, setToastMessage] = useState(null); 

    // --- Fetch current number ---
    useEffect(() => {
        if (loading) {
            setCurrentStatus('Initializing...');
            return;
        }
        
        if (!userEmail) {
            setCurrentStatus('Error: User not logged in.');
            return;
        }
        
        const fetchCurrentRecipient = async () => {
            setCurrentStatus('Fetching saved number...');
            setToastMessage(null);
            
            try {
                const res = await fetch(`${API_ENDPOINT}?recipient_email=${userEmail}`);
                const data = await res.json();
                
                if (data.success && data.phoneNumber) {
                    setRecipientNumber(data.phoneNumber);
                    setCurrentStatus('Loaded.');
                } else {
                    setRecipientNumber(''); 
                    setCurrentStatus('Ready to save new number.');
                }
            } catch (error) {
                console.error("Failed to fetch settings:", error);
                setCurrentStatus('Failed to connect to server.');
            }
        };
        fetchCurrentRecipient();
    }, [userEmail, loading]);

    // --- Handle saving the new number ---
    const handleSave = async () => {
        setToastMessage(null);
        
        if (!userEmail) {
             setToastMessage({ success: false, message: 'User email missing. Cannot save.' });
             setCurrentStatus('Error');
             return;
        }
        if (!recipientNumber || !recipientNumber.startsWith('+') || recipientNumber.length < 10) {
            setToastMessage({ success: false, message: 'Invalid number format. Use +CountryCodeNumber.' });
            setCurrentStatus('Error');
            return; 
        }

        setCurrentStatus('Saving...');
        
        try {
            const res = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'UPDATE_RECIPIENT',
                    userEmail: userEmail,
                    phoneNumber: recipientNumber,
                }),
            });

            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    setToastMessage({ success: true, message: 'Settings saved successfully!' });
                    // ⭐ SUCCESS ACTION: Navigate back to the dashboard
                    setTimeout(() => setMode('Auto'), 500); 
                    return;
                } else {
                    setToastMessage({ success: false, message: result.error || 'Server rejected save.' });
                    setCurrentStatus('Error');
                }
            } else {
                setToastMessage({ success: false, message: `API Error: ${res.status} ${res.statusText}` });
                setCurrentStatus('Error');
            }
        } catch (error) {
            setToastMessage({ success: false, message: 'Network error during save.' });
            setCurrentStatus('Error');
        }
    };

    const isSaving = currentStatus.includes('Saving');
    const isLoggedIn = !!userEmail;
    const isError = currentStatus.includes('Error');
    
    return (
        <div className="animate-fadeIn p-6 bg-slate-900 rounded-2xl border border-slate-700">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3 border-b border-slate-700 pb-4">
                <BellIcon className='w-8 h-8 text-indigo-400'/>
                Alert Recipient Configuration
            </h2>
            
            {/* Navigation Header */}
            <div className="flex justify-between items-center mb-6">
                <span className='text-md text-slate-400'>
                    Logged in as: <strong className='text-white'>{userEmail || "N/A"}</strong>
                </span>
                <button 
                    onClick={() => setMode('Auto')} 
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                >
                    <ArrowUpRightIcon className="w-4 h-4 transform rotate-180" /> Back to Dashboard
                </button>
            </div>


            {/* ⭐ TOAST MESSAGE DISPLAY */}
            {toastMessage && (
                <div className={`p-3 mb-6 rounded-lg flex items-center gap-3 font-bold ${
                    toastMessage.success 
                        ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600'
                        : 'bg-red-900/50 text-red-400 border border-red-600'
                }`}>
                    {toastMessage.success 
                        ? <CheckCircleIcon className='w-5 h-5'/> 
                        : <XCircleIcon className='w-5 h-5'/>
                    }
                    {toastMessage.message}
                </div>
            )}
            
            {/* FORM */}
            <form className="space-y-6 bg-slate-800 p-6 rounded-xl border border-slate-700"> 
                <div>
                    <label htmlFor="recipient" className="block text-sm font-medium text-slate-400 mb-2">
                        Recipient Phone Number (E.164 format)
                    </label>
                    <input
                        id="recipient"
                        type="tel"
                        value={recipientNumber}
                        onChange={(e) => setRecipientNumber(e.target.value)}
                        placeholder="+639xxxxxxxxx"
                        className="w-full p-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                        required
                        disabled={!isLoggedIn || isSaving}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                        This is the number that receives SMS alerts. It must be manually verified in the Twilio Console due to free trial restrictions.
                    </p>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                    <span className={`text-sm font-medium ${isError ? 'text-red-400' : 'text-indigo-400'}`}>
                        Current Save Status: {currentStatus}
                    </span>
                    <button
                        type="button" 
                        onClick={handleSave} 
                        disabled={!isLoggedIn || isSaving}
                        className={`px-6 py-2 font-bold rounded-lg shadow-md transition-colors 
                            ${isLoggedIn && !isSaving ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-500 text-slate-300 cursor-not-allowed'}`}
                    >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- END: ALERT SETTINGS PAGE COMPONENT ---


// --- HELPER: Analog/Raw Status in Maintenance (Unchanged) ---
const getMaintenanceStatus = (sensor, value) => {
  if (value === null || value === undefined)
    return { label: "WAITING...", color: "text-slate-500" };

  const val = parseFloat(value);

  switch (sensor) {
    case "rain":
      if (val < 307) return { label: "HEAVY RAIN", color: "text-red-400" };
      if (val < 512) return { label: "MODERATE RAIN", color: "text-orange-400" };
      if (val < 768) return { label: "LIGHT RAIN", color: "text-yellow-400" };
      return { label: "NO RAIN", color: "text-emerald-400" };

    case "soil":
      if (val < 512) return { label: "WET", color: "text-cyan-400" };
      if (val < 819) return { label: "MOIST", color: "text-emerald-400" };
      return { label: "DRY", color: "text-red-400" };

   case 'water':
    if (val === 0 || val >= 400) return { label: 'ERROR', color: 'text-red-500 animate-pulse' };
    if (val <= 4) return { label: 'HIGH LEVEL', color: 'text-yellow-400' }; 
    if (val <= 5) return { label: 'NORMAL', color: 'text-emerald-400' };    
    return { label: 'LOW LEVEL', color: 'text-red-400' };

    case "pressure":
      if (val < 990) return { label: "LOW PRESSURE", color: "text-red-400" };
      if (val > 1030) return { label: "HIGH PRESSURE", color: "text-yellow-400" };
      return { label: "STABLE", color: "text-emerald-400" };

    default:
      return { label: "--", color: "text-slate-500" };
  }
};

// --- COMPONENT: Status Card (Unchanged) ---
const StatusCard = ({ Icon, title, reading, status, className }) => {
  const isCritical = className.includes("text-red") || className.includes("text-yellow");
  return (
    <article
      className={`relative p-5 bg-slate-800 rounded-xl shadow-lg border border-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden
            ${isCritical ? "border-l-4" : ""} 
            ${className.includes("text-red") ? "border-l-red-500" : ""}
            ${className.includes("text-yellow") ? "border-l-yellow-500" : ""}
        `}
    >
      {isCritical && (
        <div className={`absolute inset-0 opacity-10 animate-pulse ${className.includes("text-red") ? "bg-red-500" : "bg-yellow-500"}`}></div>
      )}
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2">
          <Icon className={`w-8 h-8 p-1.5 rounded-lg ${className} ${isCritical ? "animate-bounce-slow" : ""}`} />
          {isCritical && (
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${className.includes("text-red") ? "bg-red-400" : "bg-yellow-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${className.includes("text-red") ? "bg-red-500" : "bg-yellow-500"}`}></span>
            </span>
          )}
        </div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</h3>
        <p className="text-2xl font-black text-white mt-1">{reading}</p>
        <p className={`text-xs font-bold mt-2 ${className.split(" ")[0]}`}>{status}</p>
      </div>
    </article>
  );
};

// --- COMPONENT: TestControlCard (Unchanged) ---
const TestControlCard = ({ Icon, title, sensorKey, dbValue, onToggle, isActive }) => {
  const statusObj = getMaintenanceStatus(sensorKey, dbValue);

  return (
    <div className={`p-5 rounded-xl border shadow-md flex flex-col justify-between transition-all duration-500 
            ${isActive ? "bg-indigo-900/30 border-indigo-500 scale-[1.02] ring-2 ring-indigo-500/20" : "bg-slate-800 border-slate-700 hover:border-slate-600"}`}>
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors duration-300 ${isActive ? "bg-indigo-500 text-white" : "bg-slate-700 text-indigo-400"}`}>
            <Icon className={`w-6 h-6 ${isActive ? "animate-spin-slow" : ""}`} />
          </div>
          <div>
            <h4 className="font-bold text-slate-200">{title}</h4>
            <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
              {isActive ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  TESTING...
                </span>
              ) : "IDLE"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 p-3 rounded-lg mb-4 border border-slate-700/50 flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm font-mono border-b border-slate-700/50 pb-2">
          <span className="text-slate-500">Raw Value:</span>
          <span className={`font-bold text-lg transition-all duration-300 ${dbValue !== null ? "text-white" : "text-slate-600"}`}>
            {dbValue !== null ? dbValue : "--"}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs font-bold uppercase">
          <span className="text-slate-500">Status:</span>
          <span className={`transition-all duration-300 ${statusObj.color}`}>
            {statusObj.label}
          </span>
        </div>
      </div>

      <button onClick={() => onToggle(sensorKey)} className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 ${isActive ? "bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-500/25"}`}>
        {isActive ? <><XCircleIcon className="w-4 h-4" /> STOP TEST</> : <><ActivityIcon className="w-4 h-4" /> START LOOP</>}
      </button>
    </div>
  );
};

// --- MAIN VIEW COMPONENT ---
const ModeView = ({ mode, setMode, liveData, fetchError, refs, percents }) => {
  const [activeTests, setActiveTests] = useState({ rain: false, soil: false, water: false, pressure: false });
  const [dbValues, setDbValues] = useState({ rain: null, soil: null, water: null, pressure: null });
  const commandMap = { rain: "R", soil: "S", water: "U", pressure: "P" };

  useEffect(() => {
    const intervals = {};
    Object.keys(activeTests).forEach((sensorKey) => {
      if (activeTests[sensorKey]) {
        runTestCycle(sensorKey);
        intervals[sensorKey] = setInterval(() => runTestCycle(sensorKey), 3000);
      }
    });
    return () => Object.values(intervals).forEach(clearInterval);
  }, [activeTests]);

  const runTestCycle = async (sensorKey) => {
    try {
      await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MAINTENANCE_TEST", sensor: sensorKey, command: commandMap[sensorKey], timestamp: new Date().toISOString(), userAction: "LOOP_TRIGGER" }),
      });
      setTimeout(async () => {
        const res = await fetch(`${API_ENDPOINT}?latest_result=true&sensor=${sensorKey}`);
        const data = await res.json();
        if (data.success) setDbValues((prev) => ({ ...prev, [sensorKey]: data.value }));
      }, 1500);
    } catch (error) {
      console.error("Loop Error:", error);
    }
  };

  const toggleTest = (sensorKey) => setActiveTests((prev) => ({ ...prev, [sensorKey]: !prev[sensorKey] }));

  // --- LOCK SCREENS (Unchanged) ---
  if (liveData.deviceMode === "AUTO" && mode !== "Auto" && mode !== "AlertSettings") {
    return (
      <div className="p-10 bg-slate-800 rounded-2xl border border-slate-700 text-center flex flex-col items-center min-h-[40vh] justify-center animate-fadeIn">
        <CpuIcon className="w-24 h-24 text-emerald-500 mb-6" />
        <h3 className="text-3xl font-bold text-white mb-2">Device is in Auto Mode</h3>
        <p className="text-slate-400 max-w-md mb-8">The physical switch is set to <strong>AUTO</strong>. Other controls are locked.</p>
        <button onClick={() => setMode("Auto")} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-1">Go to Dashboard</button>
      </div>
    );
  }

  if (liveData.deviceMode === "MAINTENANCE" && mode !== "Maintenance" && mode !== "AlertSettings") {
    return (
      <div className="p-10 bg-slate-800 rounded-2xl border border-slate-700 text-center flex flex-col items-center min-h-[40vh] justify-center animate-fadeIn">
        <RefreshCcwIcon className="w-24 h-24 text-yellow-500 mb-6 animate-spin-slow" />
        <h3 className="text-3xl font-bold text-white mb-2">Device is in Maintenance</h3>
        <p className="text-slate-400 max-w-md mb-8">The physical switch is set to <strong>MAINTENANCE</strong>. Auto and Sleep views are disabled.</p>
        <button onClick={() => setMode("Maintenance")} className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl shadow-lg shadow-yellow-900/20 transition-all hover:-translate-y-1">Open Console</button>
      </div>
    );
  }

  if (liveData.deviceMode === "SLEEP" && mode !== "Sleep" && mode !== "AlertSettings") {
    return (
      <div className="p-10 bg-slate-800 rounded-2xl border border-slate-700 text-center flex flex-col items-center min-h-[40vh] justify-center animate-fadeIn">
        <MoonIcon className="w-24 h-24 text-indigo-400 mb-6 relative z-10" />
        <h3 className="text-3xl font-bold text-white mb-2">System is Sleeping</h3>
        <p className="text-slate-400 max-w-md mb-8">The device is in low-power mode. Live Dashboard and Maintenance tools are disabled.</p>
        <button onClick={() => setMode("Sleep")} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all hover:-translate-y-1 flex items-center gap-2"><MoonIcon className="w-4 h-4" /> Go to Sleep Mode</button>
      </div>
    );
  }


  // ============================================
  //  RENDER ALERT SETTINGS VIEW (New Page Mode)
  // ============================================
  if (mode === "AlertSettings") {
      // Pass a dummy onClose as the component expects it, even though we use setMode
      return <AlertSettingsComponent setMode={setMode} onClose={() => setMode('Auto')} />;
  }

  // ============================================
  //  RENDER DASHBOARD (Auto & Sleep)
  // ============================================
  if (mode === "Auto" || mode === "Sleep") {
    const rainStatus = getRainStatus(percents.rainPercent);
    const soilStatus = getSoilStatus(percents.soilPercent);
    const waterTankStatus = getWaterTankStatus(percents.waterPercent, liveData.waterDistanceCM);
    const pressureStatus = getPressureStatus(liveData.pressure);
    const isSleep = mode === "Sleep";

    return (
      <div className="animate-fadeIn">
        {fetchError && (
          <div className="p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 text-center font-bold mb-6 animate-pulse">
            ⚠️ {fetchError}
          </div>
        )}

        {isSleep && (
          <div className="p-4 bg-indigo-900/80 border border-indigo-500 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-950 rounded-full animate-pulse"><MoonIcon className="w-6 h-6 text-indigo-400" /></div>
              <div className="text-center sm:text-left">
                <h3 className="font-bold text-indigo-100">System Sleeping</h3>
                <p className="text-xs text-indigo-300">Displaying cached data. Sensors are inactive.</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-black/30 rounded text-[10px] font-mono text-indigo-200 border border-indigo-500/30">LOW POWER MODE</span>
          </div>
        )}

        <div className={`transition-all duration-500 ${isSleep ? "opacity-60 grayscale-[0.3] pointer-events-none" : "opacity-100"}`}>
          
          {/* TOP BAR: ALERTS SETTINGS BUTTON (Toggles Page) */}
          <div className="flex justify-end mb-4">
              <button
                  onClick={() => setMode('AlertSettings')} 
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-900/40 transition-all active:scale-95"
                  title="Configure SMS Alert Recipient"
              >
                  <BellIcon className="w-5 h-5" />
                  Alert Settings
              </button>
          </div>
          
          {/* SECTION 1: SENSOR CARDS (Top Row) */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatusCard Icon={CloudRainIcon} title="Rain Sensor" reading={rainStatus.reading} status={rainStatus.status} className="text-sky-400 bg-sky-500/10" />
            <StatusCard Icon={GaugeIcon} title="Pressure" reading={`${liveData.pressure.toFixed(1)} hPa`} status={pressureStatus.status} className="text-purple-400 bg-purple-500/10" />
            <StatusCard Icon={BoxIcon} title="Water Level" reading={waterTankStatus.reading} status={waterTankStatus.status} className="text-cyan-400 bg-cyan-500/10" />
            <StatusCard Icon={LeafIcon} title="Soil Moisture" reading={soilStatus.reading} status={soilStatus.status} className="text-orange-400 bg-orange-500/10" />
          </section>

          {/* SECTION 2: MAIN GRID (Chart Left, AI + Gauges Right) */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: HISTORY CHART (Takes up 2/3 width) */}
            <article className="lg:col-span-2 p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ActivityIcon className="w-5 h-5 text-indigo-400" />
                  Historical Trends
                </h3>
                <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">Last 7 Days</span>
              </div>
              <div className="chart-container flex-grow min-h-[300px]">
                <canvas ref={refs.historyChartRef}></canvas>
              </div>
            </article>

            {/* RIGHT COLUMN: AI CARD + GAUGES (Takes up 1/3 width) */}
            <div className="flex flex-col gap-6 lg:col-span-1">
              
              {/* AI CARD (Placed here for visibility) */}
              <AICard liveData={liveData} />

              {/* LIVE GAUGES */}
              <article className="p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700 hover:border-slate-600 transition-colors flex-grow">
                <h3 className="text-xl font-bold mb-6 text-white text-center">Live Gauges</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center group">
                    <canvas ref={refs.rainGaugeRef} className="w-full transition-transform group-hover:scale-110 duration-300"></canvas>
                    <span className="text-[10px] mt-1 text-slate-400 font-bold uppercase tracking-wide">Rain</span>
                  </div>
                  <div className="flex flex-col items-center group">
                    <canvas ref={refs.pressureGaugeRef} className="w-full transition-transform group-hover:scale-110 duration-300"></canvas>
                    <span className="text-[10px] mt-1 text-slate-400 font-bold uppercase tracking-wide">Pressure</span>
                  </div>
                  <div className="flex flex-col items-center group">
                    <canvas ref={refs.waterTankGaugeRef} className="w-full transition-transform group-hover:scale-110 duration-300"></canvas>
                    <span className="text-[10px] mt-1 text-slate-400 font-bold uppercase tracking-wide">Water</span>
                  </div>
                  <div className="flex flex-col items-center group">
                    <canvas ref={refs.soilGaugeRef} className="w-full transition-transform group-hover:scale-110 duration-300"></canvas>
                    <span className="text-[10px] mt-1 text-slate-400 font-bold uppercase tracking-wide">Soil</span>
                  </div>
                </div>
              </article>

            </div>
          </section>
        </div>
      </div>
    );
  }

  // RENDER MAINTENANCE (Unchanged)
  if (mode === "Maintenance") {
    return (
      <section className="space-y-6 animate-fadeIn">
        <div className="p-6 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl animate-pulse"><CpuIcon className="w-8 h-8 text-yellow-500" /></div>
            <div>
              <h2 className="text-xl font-bold text-white">Maintenance Console</h2>
              <p className="text-yellow-200/70 text-sm">Physical switch confirmed. Running diagnostics.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TestControlCard Icon={CloudRainIcon} title="Rain Sensor" sensorKey="rain" dbValue={dbValues.rain} isActive={activeTests.rain} onToggle={toggleTest} />
          <TestControlCard Icon={LeafIcon} title="Soil Sensor" sensorKey="soil" dbValue={dbValues.soil} isActive={activeTests.soil} onToggle={toggleTest} />
          <TestControlCard Icon={BoxIcon} title="Water Sensor" sensorKey="water" dbValue={dbValues.water} isActive={activeTests.water} onToggle={toggleTest} />
          <TestControlCard Icon={GaugeIcon} title="Barometer" sensorKey="pressure" dbValue={dbValues.pressure} isActive={activeTests.pressure} onToggle={toggleTest} />
        </div>
      </section>
    );
  }

  return null;
};

export default ModeView;