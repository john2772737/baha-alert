import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFormattedTime } from '../utils/sensorUtils';
import { useSensorData } from '../hooks/useSensorData';
import { useDashboardInit } from '../hooks/useDashboardInit';
import { ClockIcon, RefreshCcwIcon, CpuIcon } from '../utils/icons';
import ModeView from '../components/ModeView'; // Corrected component path

const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 
const FETCH_TODAY_LOG_INTERVAL_MS = 600000; // 10 minutes (for passive background fetch)

const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false); // ⭐ New state for download status
    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];
    const [currentTime, setCurrentTime] = useState('Loading...');
    
    const [todayData, setTodayData] = useState([]); 

    // 1. Fetch Data & Calculate Percentages
    const { liveData, historyData, fetchError, rainPercent, soilPercent, waterPercent } = useSensorData(isClient, mode);
    
    // 2. Initialize and Update Dashboard Libraries (Gauges/Chart)
    const dashboardRefs = useDashboardInit(
        liveData, historyData, mode, rainPercent, soilPercent, waterPercent
    );

    // Group percentages for easy passing to ModeView
    const percents = useMemo(() => ({ rainPercent, soilPercent, waterPercent }), [rainPercent, soilPercent, waterPercent]);


    // ⭐ PDF Download Logic (Uses jsPDF and html2canvas)
    // This function now accepts the data array directly.
    // ⭐ PDF Download Logic (Fixed: Displays Raw Analog Data correctly)
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

        // 1. Initialize Document
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Layout Config
        const margin = 15;
        let currentY = 20; // Start Y position
        const lineHeight = 8;
        
        // Helper: Center Text
        const centerText = (text, y, size = 10, font = 'helvetica', style = 'normal') => {
            doc.setFont(font, style);
            doc.setFontSize(size);
            const textWidth = doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor;
            const x = (pageWidth - textWidth) / 2;
            doc.text(text, x, y);
        };

        // --- HEADER SECTION ---
        // Main Title
        doc.setTextColor(22, 163, 74); // Emerald Color (RGB)
        centerText('SMART WEATHER STATION', currentY, 18, 'helvetica', 'bold');
        currentY += 8;

        // Subtitle / Date
        doc.setTextColor(60, 60, 60); // Dark Gray
        centerText(`Daily Log Report: ${getFormattedTime()}`, currentY, 12);
        currentY += 7;
        
        // Device Mode Badge
        centerText(`Device Mode: ${liveData.deviceMode}`, currentY, 10, 'courier', 'bold');
        currentY += 15;

        // --- TABLE HEADER ---
        // Define Column Positions
        const col1 = margin;                   // Time
        const col2 = margin + 35;              // Pressure
        const col3 = margin + 75;              // Rain
        const col4 = margin + 105;             // Soil
        const col5 = margin + 135;             // Water Level

        // Draw Header Background
        doc.setFillColor(240, 240, 240); // Light Gray
        doc.rect(margin, currentY - 5, pageWidth - (margin * 2), 8, 'F');

        // Draw Header Text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        
        doc.text('TIME', col1, currentY);
        doc.text('PRESSURE (hPa)', col2, currentY);
        // ⭐ UPDATED: Changed headers to indicate Raw Analog Data
        doc.text('RAIN (Raw)', col3, currentY);
        doc.text('SOIL (Raw)', col4, currentY);
        doc.text('WATER (cm)', col5, currentY);
        
        currentY += 10; // Move down for data

        // --- DATA ROWS ---
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);

        dataToDownload.forEach((item, index) => {
            // Check for Page Break
            if (currentY > pageHeight - 20) {
                doc.addPage();
                currentY = 20;
            }

            // Zebra Striping
            if (index % 2 === 0) {
                 doc.setFillColor(252, 252, 252);
                 doc.rect(margin, currentY - 5, pageWidth - (margin * 2), lineHeight, 'F');
            }

            // Parse Data
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            
            const p = item.avgPressure ? item.avgPressure.toFixed(1) : '-';
            const r = item.avgRain ? item.avgRain.toFixed(0) : '-';
            const s = item.avgSoil ? item.avgSoil.toFixed(0) : '-';
            const w = item.avgWaterDistance ? item.avgWaterDistance.toFixed(1) : '-';

            // Draw Row Data
            doc.text(timeStr, col1, currentY);
            doc.text(p, col2, currentY);
            
            // ⭐ UPDATED: Removed the '%' concatenation
            doc.text(r, col3, currentY); 
            doc.text(s, col4, currentY);
            
            doc.text(w, col5, currentY);

            currentY += lineHeight;
        });

        // Drawing a footer line
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, currentY - 5, pageWidth - margin, currentY - 5);

        // --- SAVE PDF ---
        doc.save(`weather_report_${new Date().toISOString().substring(0, 10)}.pdf`);

    }, [liveData.deviceMode]);


    // ⭐ ORCHESTRATOR: Fetches and then immediately downloads
    const fetchAndDownloadLogs = useCallback(async () => {
        if (!isClient || isDownloading) return;
        setIsDownloading(true);
        
        try {
            const response = await fetch(`${REAL_API_ENDPOINT}?today=true`);
            if (!response.ok) throw new Error("Fetch failed.");
            const result = await response.json();
            
            if (result.success && Array.isArray(result.data)) {
                setTodayData(result.data); // Update state for passive viewing
                downloadReportPDF(result.data); // Trigger immediate download
            }
        } catch (e) {
            console.error("Download Orchestration Error:", e);
        } finally {
            setIsDownloading(false);
        }
    }, [isClient, isDownloading, downloadReportPDF]);
    
    // 3. Client/CDN Init & Time update
    useEffect(() => {
        setIsClient(true);
        // Load external libraries required for gauges, charts, and PDF
        const cdnUrls = [
            "https://cdnjs.cloudflare.com/ajax/libs/gauge.js/1.3.7/gauge.min.js",
            "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
            "https://cdn.tailwindcss.com",
            // ⭐ PDF Libraries (Restored)
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        ];
        
        const loadScript = (url) => new Promise(resolve => {
            const script = document.createElement('script');
            script.src = url; script.async = true; 
            
            // Special handling for jsPDF global setup
            if (url.includes('jspdf')) {
                script.onload = () => {
                     // Attach jsPDF function to window directly
                     if (window.jspdf && window.jspdf.jsPDF) window.jsPDF = window.jspdf.jsPDF;
                     resolve();
                };
            } else {
                 script.onload = resolve; 
            }
            
            // Note: The imports below are correctly pointing to the relative paths of the Vercel structure
            if (url.includes('tailwindcss')) document.head.prepend(script); else document.head.appendChild(script);
            if (url.includes('tailwindcss')) resolve(); 
        });

        // Simplified dependency check for library loading
        Promise.all(cdnUrls.map(loadScript)).then(() => { 
            // Check for core libraries + PDF libraries
            if (typeof window.Gauge !== 'undefined' && typeof window.Chart !== 'undefined' && typeof window.jsPDF !== 'undefined' && typeof window.html2canvas !== 'undefined') {
                setScriptsLoaded(true); 
            }
        });
        
        setCurrentTime(getFormattedTime());
        const timeInterval = setInterval(() => setCurrentTime(getFormattedTime()), 10000);
        return () => clearInterval(timeInterval);
    }, []);
    
    // Passive background fetch (Kept for viewing logs)
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


    if (!isClient || !scriptsLoaded) return <div className="flex justify-center items-center h-screen bg-slate-900 text-emerald-400 font-inter"><RefreshCcwIcon className="animate-spin w-8 h-8 mr-2" /> Initializing...</div>;

    // --- RENDER ---
    return (
        <div className className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
            <style>{`
                .chart-container { height: 50vh; width: 100%; }
                .gauges-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }
                .gauge-wrapper canvas { max-width: 100%; height: auto; }
                @media (min-width: 1024px) { .gauges-container { grid-template-columns: repeat(4, 1fr); } .chart-container { height: 400px; } }
            `}</style>
            
            <header className="mb-8 p-5 bg-slate-800 rounded-3xl shadow-lg border-b-4 border-emerald-500/50 flex flex-col md:flex-row justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-extrabold text-emerald-400 mb-2 md:mb-0">Smart Weather Station</h1>
                    <div className="flex items-center text-xs text-slate-400 mt-1 bg-slate-900 px-2 py-1 rounded-md border border-slate-700 w-fit">
                        <CpuIcon className="w-3 h-3 mr-1 text-yellow-400" />
                        DEVICE MODE: <span className="text-emerald-300 ml-1 font-mono font-bold">{liveData.deviceMode}</span>
                    </div>
                </div>
                <div className="flex items-center text-slate-400 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 mt-4 md:mt-0">
                    <ClockIcon className="w-5 h-5 mr-2 text-indigo-400" />
                    <span>{currentTime}</span>
                </div>
            </header>

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
            
            {/* ⭐ NEW: Fetch & Download Button */}
            {mode === 'Auto' && liveData.deviceMode === 'AUTO' && (
                <div className="mt-8 p-4 bg-slate-800 rounded-2xl border border-slate-700 text-center">
                    <h3 className="text-xl font-bold mb-4 text-slate-200">Daily Report Generation</h3>
                    <button
                        onClick={fetchAndDownloadLogs} // Calls the orchestrator
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
                    <p className='text-xs text-slate-500 mt-2'>Downloads sampled data (every 10 minutes) + chart snapshot.</p>
                </div>
            )}
        </div>
    );
}

export default App;