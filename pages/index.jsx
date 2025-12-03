import React, { useState, useEffect, useMemo, useCallback } from 'react';
// ⭐ FIX: Ensuring paths start with the required number of dots or relative path pattern
import { getFormattedTime } from '../utils/sensorUtils';
import { useSensorData } from '../hooks/useSensorData';
import { useDashboardInit } from '../hooks/useDashboardInit';
import { ClockIcon, RefreshCcwIcon, CpuIcon } from '../utils/icons';
import ModeView from '../components/ModeView'; 

const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 
const FETCH_TODAY_LOG_INTERVAL_MS = 600000; // 10 minutes (for passive background fetch)

const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false); 
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


    // ⭐ PDF Download Logic (Uses jsPDF and jspdf-autotable)
    const downloadReportPDF = useCallback((dataToDownload) => {
        const { jsPDF } = window;
        // FIX: Check jsPDF.prototype.autoTable instead of window.autoTable
        if (typeof jsPDF === 'undefined' || typeof window.html2canvas === 'undefined' || typeof jsPDF.prototype.autoTable === 'undefined') {
            console.error('PDF libraries not fully loaded. Check for jsPDF, html2canvas, and autoTable plugin.');
            return;
        }

        if (!dataToDownload || dataToDownload.length === 0) {
            console.error('No data available to generate report.');
            return;
        }
        
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 10;
        let finalY = margin;
        
        // --- 1. Add Title and Header ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("Smart Weather Station Daily Report", margin, finalY);
        finalY += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Generated Time: ${getFormattedTime()}`, margin, finalY);
        finalY += 5;
        doc.text(`Device Mode: ${liveData.deviceMode}`, margin, finalY);
        finalY += 8; // Spacer before table

        // --- 2. Prepare Table Data ---
        const tableHeaders = [
            'Time', 
            'Pressure (hPa)', 
            'Rain (%)', 
            'Soil (%)', 
            'Water Dist. (cm)'
        ];

        const tableBody = dataToDownload.map(item => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            
            return [
                timeStr,
                item.avgPressure ? item.avgPressure.toFixed(1) : 'N/A',
                item.avgRain ? item.avgRain.toFixed(0) : 'N/A',
                item.avgSoil ? item.avgSoil.toFixed(0) : 'N/A',
                item.avgWaterDistance ? item.avgWaterDistance.toFixed(1) : 'N/A',
            ];
        });

        // --- 3. Generate Table using autoTable ---
        doc.autoTable({
            head: [tableHeaders],
            body: tableBody,
            startY: finalY,
            theme: 'striped',
            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [51, 65, 85], textColor: 255 }, // slate-700 color
            margin: { left: margin, right: margin }
        });

        // Get the final Y position after the table finishes
        finalY = doc.lastAutoTable.finalY + 10;

        // --- 4. Add Chart Snapshot (using html2canvas) ---
        if (dashboardRefs.historyChartRef.current && typeof window.html2canvas !== 'undefined') {
             const canvas = dashboardRefs.historyChartRef.current;
             
             if (canvas.width > 0 && canvas.height > 0) {
                 window.html2canvas(canvas, { scale: 1 }).then(chartCanvas => {
                     const chartDataURL = chartCanvas.toDataURL('image/png');
                     
                     // Check if chart will fit on current page, if not, add page
                     if (finalY + 100 > 280) { // Approx A4 height is 297mm
                         doc.addPage();
                         finalY = margin;
                     }
                     
                     doc.setFontSize(12);
                     doc.text("Historical Trend Chart (Last 7 Days)", margin, finalY);
                     finalY += 3;
                     
                     // Add image below title
                     doc.addImage(chartDataURL, 'PNG', margin, finalY, 190, 100); 
                     
                     doc.save(`weather_report_${new Date().toISOString().substring(0, 10)}.pdf`);
                 }).catch(err => {
                    console.error("Error generating chart snapshot:", err);
                    doc.save(`weather_report_${new Date().toISOString().substring(0, 10)}.pdf`); // Fallback save
                 });
             } else {
                 doc.save(`weather_report_${new Date().toISOString().substring(0, 10)}.pdf`); // Fallback save
             }
        } else {
             doc.save(`weather_report_${new Date().toISOString().substring(0, 10)}.pdf`);
        }
        
    }, [liveData.deviceMode, dashboardRefs.historyChartRef]);


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
            // PDF Libraries
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js",
        ];
        
        const loadScript = (url) => new Promise(resolve => {
            const script = document.createElement('script');
            script.src = url; script.async = true; 
            
            // Special handling for jsPDF global setup
            if (url.includes('jspdf') && !url.includes('autotable')) {
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

        // FIX: Refined the dependency check to ensure autoTable plugin is available
        Promise.all(cdnUrls.map(loadScript)).then(() => { 
            const isReady = (
                typeof window.Gauge !== 'undefined' && 
                typeof window.Chart !== 'undefined' && 
                typeof window.jsPDF !== 'undefined' && 
                typeof window.html2canvas !== 'undefined' &&
                // Critical Check: Ensure autoTable function is attached to jsPDF prototype
                (window.jsPDF && typeof window.jsPDF.prototype.autoTable !== 'undefined')
            );
            if (isReady) {
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
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-10 font-inter dark">
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
            
            {/* Fetch & Download Button */}
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