import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Script from 'next/script'; // Standard Next.js script loader
import { getFormattedTime } from '../utils/sensorUtils';
import { useSensorData } from '../hooks/useSensorData';
import { useDashboardInit } from '../hooks/useDashboardInit';
import { ClockIcon, RefreshCcwIcon, CpuIcon } from '../utils/icons';
import ModeView from '../components/ModeView';

const App = () => {
    // State Management
    const [isClient, setIsClient] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [mode, setMode] = useState('Auto');
    const [currentTime, setCurrentTime] = useState('Loading...');
    
    // Fetch Data
    const { liveData, historyData, fetchError, rainPercent, soilPercent, waterPercent } = useSensorData(isClient, mode);

    // Initialize Dashboard Charts/Gauges
    useDashboardInit(liveData, historyData, mode, rainPercent, soilPercent, waterPercent);

    // Group Percentages
    const percents = useMemo(() => ({ 
        rainPercent, soilPercent, waterPercent 
    }), [rainPercent, soilPercent, waterPercent]);


    // ---------------------------------------------------------
    // ⭐ PDF Logic using CDN (window.jspdf)
    // ---------------------------------------------------------
    const downloadReportPDF = useCallback((dataToDownload) => {
        // 1. Check if CDN scripts are loaded
        if (typeof window === 'undefined' || !window.jspdf) {
            alert("PDF Library is still loading. Please try again in a few seconds.");
            return;
        }

        if (!dataToDownload || dataToDownload.length === 0) {
            alert("No data available to generate report.");
            return;
        }

        setIsDownloading(true);

        try {
            // 2. Instantiate jsPDF from the global window object
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // 3. Document Header
            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text("Baha-Alert System Report", 14, 22);

            // 4. Metadata
            doc.setFontSize(11);
            doc.setTextColor(100);
            const dateStr = new Date().toLocaleString();
            doc.text(`Generated on: ${dateStr}`, 14, 30);
            doc.text(`System Mode: ${mode}`, 14, 36);

            // 5. Prepare Table Data
            const tableBody = dataToDownload.map(log => [
                log.timestamp || log.createdAt ? new Date(log.timestamp || log.createdAt).toLocaleTimeString() : 'N/A',
                `${log.rain_value ?? log.rain ?? 0}%`,
                `${log.soil_value ?? log.soil ?? 0}%`,
                `${log.water_level ?? log.water ?? 0}%`
            ]);

            // 6. Generate Table (autoTable attaches itself to doc automatically via CDN)
            doc.autoTable({
                head: [["Time", "Rain Level", "Soil Moisture", "Water Level"]],
                body: tableBody,
                startY: 45,
                theme: 'grid',
                headStyles: { fillColor: [22, 160, 133] }, // Teal Header
                styles: { fontSize: 10, cellPadding: 3 },
                alternateRowStyles: { fillColor: [240, 240, 240] } // Gray stripes
            });

            // 7. Save
            doc.save(`BahaAlert_Log_${new Date().toISOString().slice(0, 10)}.pdf`);

        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("Failed to generate PDF. Check console for details.");
        } finally {
            setIsDownloading(false);
        }
    }, [mode]);

    // UI Initialization
    useEffect(() => {
        setIsClient(true);
        const timer = setInterval(() => setCurrentTime(getFormattedTime()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
            {/* ⭐ CDN SCRIPTS 
               strategy="beforeInteractive" ensures they load early
            */}
            <Script 
                src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" 
                strategy="beforeInteractive"
            />
            <Script 
                src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js" 
                strategy="beforeInteractive"
            />

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 shadow-sm rounded-lg">
                <div className="flex items-center gap-2 mb-4 md:mb-0">
                   <h1 className="text-2xl font-bold text-teal-600">Baha-Alert Dashboard</h1>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                        <ClockIcon /> <span>{currentTime}</span>
                    </div>
                    
                    {/* Download Button */}
                    <button 
                        onClick={() => downloadReportPDF(historyData)}
                        disabled={isDownloading}
                        className={`px-4 py-2 rounded text-white transition font-medium ${
                            isDownloading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isDownloading ? 'Generating...' : 'Download Report'}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. Mode Controls */}
                <section className="col-span-1 md:col-span-2 lg:col-span-3">
                   <ModeView 
                        mode={mode} 
                        setMode={setMode} 
                        modes={['Auto', 'Maintenance', 'Sleep']}
                        percents={percents}
                   />
                </section>

                {/* 2. Visualization Containers */}
                <div className="bg-white p-4 rounded-lg shadow h-64 flex flex-col items-center justify-center">
                    <h3 className="text-lg font-semibold mb-2">Rain Level</h3>
                    <div id="gauge-rain" className="w-full h-full"></div> 
                </div>

                <div className="bg-white p-4 rounded-lg shadow h-64 flex flex-col items-center justify-center">
                    <h3 className="text-lg font-semibold mb-2">Soil Moisture</h3>
                    <div id="gauge-soil" className="w-full h-full"></div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow h-64 flex flex-col items-center justify-center">
                    <h3 className="text-lg font-semibold mb-2">Water Level</h3>
                    <div id="gauge-water" className="w-full h-full"></div>
                </div>

            </main>
        </div>
    );
};

export default App;