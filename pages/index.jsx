import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router'; 
import { useAuth } from '../context/AuthContext'; 
import QRCode from 'react-qr-code'; 

import { getFormattedTime } from '../utils/sensorUtils';
import { useSensorData } from '../hooks/useSensorData';
import { useDashboardInit } from '../hooks/useDashboardInit';
import { ClockIcon, RefreshCcwIcon, CpuIcon } from '../utils/icons';
import ModeView from '../components/ModeView'; 

const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 
const FETCH_TODAY_LOG_INTERVAL_MS = 600000; 

const App = () => {
    // ⭐ Auth & Router Logic
    const { user, logOut, loading } = useAuth();
    const router = useRouter();

    // State
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // ⭐ QR Logic States
    const [showQR, setShowQR] = useState(false);
    const [qrValue, setQrValue] = useState(''); // Stores the dynamic secure URL

    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];
    const [currentTime, setCurrentTime] = useState('Loading...');
    const [todayData, setTodayData] = useState([]); 

    // ⭐ 1. Protect Route
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    // ⭐ 2. Function to Generate Secure Session QR
    const generateSecureQR = async () => {
        if (!user) return;
        setQrValue(''); // Clear previous value to show loading state
        setShowQR(true); // Open modal immediately

        try {
            // A. Get current user's ID token to prove identity
            const idToken = await user.getIdToken();
            
            // B. Ask server for a transfer token
            const response = await fetch('/api/generate-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });
            
            const data = await response.json();
            
            if (data.token) {
                // C. Create the Magic Link with the custom token
                const magicLink = `https://baha-alert.vercel.app/login?token=${data.token}`;
                setQrValue(magicLink);
            } else {
                console.error("Failed to generate token");
            }
        } catch (error) {
            console.error("QR Generation Error:", error);
        }
    };

    // 3. Fetch Data & Calculate Percentages
    const { liveData, historyData, fetchError, rainPercent, soilPercent, waterPercent } = useSensorData(isClient, mode);
    
    // 4. Initialize Dashboard Libraries
    const dashboardRefs = useDashboardInit(
        liveData, historyData, mode, rainPercent, soilPercent, waterPercent
    );

    const percents = useMemo(() => ({ rainPercent, soilPercent, waterPercent }), [rainPercent, soilPercent, waterPercent]);

    // ⭐ PDF Download Logic
    const downloadReportPDF = useCallback((dataToDownload) => {
        if (typeof window.jsPDF === 'undefined') {
            console.error('PDF library jsPDF not loaded.');
            return;
        }

        const { jsPDF } = window;
        if (!dataToDownload || dataToDownload.length === 0) {
            console.error('No data available to generate report.');
            return;
        }

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        const margin = 15;
        let currentY = 20; 
        const lineHeight = 8;
        
        const centerText = (text, y, size = 10, font = 'helvetica', style = 'normal') => {
            doc.setFont(font, style);
            doc.setFontSize(size);
            const textWidth = doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor;
            const x = (pageWidth - textWidth) / 2;
            doc.text(text, x, y);
        };

        // Header
        doc.setTextColor(22, 163, 74); 
        centerText('SMART WEATHER STATION', currentY, 18, 'helvetica', 'bold');
        currentY += 8;

        doc.setTextColor(60, 60, 60); 
        centerText(`Daily Log Report: ${getFormattedTime()}`, currentY, 12);
        currentY += 7;
        
        centerText(`Device Mode: ${liveData.deviceMode}`, currentY, 10, 'courier', 'bold');
        currentY += 15;

        // Table Header
        const col1 = margin;                   
        const col2 = margin + 35;              
        const col3 = margin + 75;              
        const col4 = margin + 105;             
        const col5 = margin + 135;             

        doc.setFillColor(240, 240, 240); 
        doc.rect(margin, currentY - 5, pageWidth - (margin * 2), 8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        
        doc.text('TIME', col1, currentY);
        doc.text('PRESSURE (hPa)', col2, currentY);
        doc.text('RAIN (Raw)', col3, currentY);
        doc.text('SOIL (Raw)', col4, currentY);
        doc.text('WATER (cm)', col5, currentY);
        
        currentY += 10; 

        // Data Rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);

        dataToDownload.forEach((item, index) => {
            if (currentY > pageHeight - 20) {
                doc.addPage();
                currentY = 20;
            }

            if (index % 2 === 0) {
                 doc.setFillColor(252, 252, 252);
                 doc.rect(margin, currentY - 5, pageWidth - (margin * 2), lineHeight, 'F');
            }

            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            
            const p = item.avgPressure ? item.avgPressure.toFixed(1) : '-';
            const r = item.avgRain ? item.avgRain.toFixed(0) : '-';
            const s = item.avgSoil ? item.avgSoil.toFixed(0) : '-';
            const w = item.avgWaterDistance ? item.avgWaterDistance.toFixed(1) : '-';

            doc.text(timeStr, col1, currentY);
            doc.text(p, col2, currentY);
            doc.text(r, col3, currentY); 
            doc.text(s, col4, currentY);
            doc.text(w, col5, currentY);

            currentY += lineHeight;
        });

        doc.setDrawColor(200, 200, 200);
        doc.line(margin, currentY - 5, pageWidth - margin, currentY - 5);

        doc.save(`weather_report_${new Date().toISOString().substring(0, 10)}.pdf`);

    }, [liveData.deviceMode]);

    // Orchestrator
    const fetchAndDownloadLogs = useCallback(async () => {
        if (!isClient || isDownloading) return;
        setIsDownloading(true);
        
        try {
            const response = await fetch(`${REAL_API_ENDPOINT}?today=true`);
            if (!response.ok) throw new Error("Fetch failed.");
            const result = await response.json();
            
            if (result.success && Array.isArray(result.data)) {
                setTodayData(result.data); 
                downloadReportPDF(result.data); 
            }
        } catch (e) {
            console.error("Download Orchestration Error:", e);
        } finally {
            setIsDownloading(false);
        }
    }, [isClient, isDownloading, downloadReportPDF]);
    
    // Init Effects
    useEffect(() => {
        setIsClient(true);
        const cdnUrls = [
            "https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js",
            "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
            "https://cdn.tailwindcss.com",
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        ];
        
        const loadScript = (url) => new Promise(resolve => {
            const script = document.createElement('script');
            script.src = url; script.async = true; 
            if (url.includes('jspdf')) {
                script.onload = () => {
                     if (window.jspdf && window.jspdf.jsPDF) window.jsPDF = window.jspdf.jsPDF;
                     resolve();
                };
            } else {
                 script.onload = resolve; 
            }
            if (url.includes('tailwindcss')) document.head.prepend(script); else document.head.appendChild(script);
            if (url.includes('tailwindcss')) resolve(); 
        });

        Promise.all(cdnUrls.map(loadScript)).then(() => { 
            if (typeof window.Gauge !== 'undefined' && typeof window.Chart !== 'undefined' && typeof window.jsPDF !== 'undefined' && typeof window.html2canvas !== 'undefined') {
                setScriptsLoaded(true); 
            }
        });
        
        setCurrentTime(getFormattedTime());
        const timeInterval = setInterval(() => setCurrentTime(getFormattedTime()), 10000);
        return () => clearInterval(timeInterval);
    }, []);
    
    // Passive Fetch
    useEffect(() => {
        const fetchTodayDataPassive = async () => {
             try {
                const response = await fetch(`${REAL_API_ENDPOINT}?today=true`);
                if (!response.ok) throw new Error("Passive fetch failed");
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    setTodayData(result.data);
                }
            } catch (e) {
                console.error("Passive Fetch Error:", e);
            }
        };
        fetchTodayDataPassive();
        const interval = setInterval(fetchTodayDataPassive, FETCH_TODAY_LOG_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [isClient]);

    // Auth Loading State
    if (loading || !user) return <div className="flex justify-center items-center h-screen bg-slate-900 text-emerald-400 font-inter">Checking Access...</div>;

    if (!isClient || !scriptsLoaded) return <div className="flex justify-center items-center h-screen bg-slate-900 text-emerald-400 font-inter"><RefreshCcwIcon className="animate-spin w-8 h-8 mr-2" /> Initializing...</div>;

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
            <style>{`
                .chart-container { height: 50vh; width: 100%; }
                .gauges-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }
                .gauge-wrapper canvas { max-width: 100%; height: auto; }
                @media (min-width: 1024px) { .gauges-container { grid-template-columns: repeat(4, 1fr); } .chart-container { height: 400px; } }
            `}</style>
            
            {/* Header */}
            <header className="mb-8 p-5 bg-slate-800 rounded-3xl shadow-lg border-b-4 border-emerald-500/50 flex flex-col md:flex-row justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-extrabold text-emerald-400 mb-2 md:mb-0">Baha-Alert</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Device Mode Badge */}
                        <div className="flex items-center text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-700 w-fit">
                            <CpuIcon className="w-3 h-3 mr-1 text-yellow-400" />
                            MODE: <span className="text-emerald-300 ml-1 font-mono font-bold">{liveData.deviceMode}</span>
                        </div>
                        {/* QR Toggle Button - Calls the Secure Gen Function */}
                        <button onClick={generateSecureQR} className="text-xs bg-indigo-600 px-2 py-1 rounded text-white font-bold hover:bg-indigo-500 transition-colors">
                             SHOW QR
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-col md:items-end gap-2 mt-4 md:mt-0">
                    <div className="flex items-center text-slate-400 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
                        <ClockIcon className="w-5 h-5 mr-2 text-indigo-400" />
                        <span>{currentTime}</span>
                    </div>
                     {/* User Info & Logout */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{user.email}</span>
                        <button onClick={logOut} className="text-xs text-red-400 border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/20 transition-colors">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* ⭐ QR Code Modal (Secure) */}
            {showQR && (
                <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4" onClick={() => setShowQR(false)}>
                    <div className="bg-white p-6 rounded-2xl flex flex-col items-center shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-black text-lg font-bold mb-4">Scan to Share Session</h3>
                        
                        <div className="bg-white p-2 border-2 border-slate-200 rounded-lg flex items-center justify-center" style={{ minHeight: '200px', minWidth: '200px' }}>
                            {/* Check if QR Value exists before rendering */}
                            {qrValue ? (
                                <QRCode 
                                    value={qrValue} 
                                    size={200} 
                                />
                            ) : (
                                <div className="flex flex-col items-center text-slate-500">
                                    <RefreshCcwIcon className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
                                    <span className="text-xs">Generating Secure Key...</span>
                                </div>
                            )}
                        </div>
                        <p className="text-slate-500 text-xs mt-4 font-mono">
                            {qrValue ? "Valid for 1 Hour" : "Requesting Server..."}
                        </p>
                    </div>
                    <button className="mt-6 text-white text-sm underline hover:text-emerald-400">Tap anywhere to close</button>
                </div>
            )}

            <main className="space-y-8">
                {/* UI Mode Selector */}
                <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                    {modes.map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === m ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{m}</button>
                    ))}
                </div>
                
                <ModeView
                    mode={mode}
                    setMode={setMode}
                    liveData={liveData}
                    fetchError={fetchError}
                    refs={dashboardRefs}
                    percents={percents}
                />
            </main>
            
            {/* Fetch & Download Button */}
            {mode === 'Auto' && liveData.deviceMode === 'AUTO' && (
                <div className="mt-8 p-4 bg-slate-800 rounded-2xl border border-slate-700 text-center">
                    <h3 className="text-xl font-bold mb-4 text-slate-200">Daily Report Generation</h3>
                    <button
                        onClick={fetchAndDownloadLogs}
                        disabled={isDownloading}
                        className={`flex items-center justify-center mx-auto px-6 py-2 font-semibold rounded-lg shadow-md transition-colors 
                            ${isDownloading 
                                ? 'bg-indigo-400 text-white cursor-wait' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    >
                        {isDownloading ? (
                            <>
                                <RefreshCcwIcon className='w-4 h-4 mr-2 animate-spin'/>
                                Generating Report...
                            </>
                        ) : (
                            <>
                                <svg className='w-4 h-4 mr-2' xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Fetch & Download Today's Log
                            </>
                        )}
                    </button>
                    <p className='text-xs text-slate-500 mt-2'>Downloads sampled data (every 10 minutes).</p>
                </div>
            )}
        </div>
    );
}

export default App;