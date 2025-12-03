import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFormattedTime } from '../utils/sensorUtils';
import { useSensorData } from '../hooks/useSensorData';
import { useDashboardInit } from '../hooks/useDashboardInit';
import { ClockIcon, RefreshCcwIcon, CpuIcon } from '../utils/icons';
import ModeView from '../components/ModeView';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];
    const [currentTime, setCurrentTime] = useState('Loading...');

    // 1. Fetch Data
    const { liveData, historyData, fetchError, rainPercent, soilPercent, waterPercent } = useSensorData(isClient, mode);

    // 2. Initialize Dashboard Libraries (FIXED: Capturing the return value)
    const dashboardRefs = useDashboardInit(liveData, historyData, mode, rainPercent, soilPercent, waterPercent);

    // Group percentages
    const percents = useMemo(() => ({ rainPercent, soilPercent, waterPercent }), [rainPercent, soilPercent, waterPercent]);

    // Client-side hydration and Clock
    useEffect(() => {
        setIsClient(true);
        const timer = setInterval(() => setCurrentTime(getFormattedTime()), 1000);
        return () => clearInterval(timer);
    }, []);

    // PDF Download Logic
    const downloadReportPDF = useCallback(() => {
        const dataToDownload = historyData;

        if (!dataToDownload || dataToDownload.length === 0) {
            alert("No data available to download.");
            return;
        }

        setIsDownloading(true);

        try {
            const doc = new jsPDF();

            // -- Title --
            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text("Baha-Alert: Sensor Data Log", 14, 22);

            // -- Subtitle / Date --
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

            // -- Table Columns --
            const tableColumn = ["Time", "Water Lvl (%)", "Rain Lvl (%)", "Soil Mst (%)", "Status"];

            // -- Table Rows --
            const tableRows = dataToDownload.map(item => {
                let status = "Normal";
                const waterVal = parseFloat(item.waterLevel);
                if (waterVal > 75) status = "Critical";
                else if (waterVal > 50) status = "Warning";

                return [
                    new Date(item.timestamp).toLocaleTimeString(),
                    `${item.waterLevel}%`,
                    `${item.rainLevel}%`,
                    `${item.soilMoisture}%`,
                    status
                ];
            });

            // -- Generate Table --
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 40,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 3, halign: 'center' },
                headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] }
            });

            doc.save(`BahaAlert_Log_${new Date().toISOString().slice(0, 10)}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF report.");
        } finally {
            setIsDownloading(false);
        }
    }, [historyData]);

    if (!isClient) return null;

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
            {/* --- Top Bar --- */}
            <header className="bg-white shadow-sm p-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="h-8 w-8 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                            B
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-teal-700">Baha-Alert</h1>
                    </div>

                    <div className="flex items-center space-x-6 text-sm">
                        <div className="flex items-center space-x-1 text-gray-500">
                            <ClockIcon className="w-4 h-4" />
                            <span>{currentTime}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                            {modes.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`px-3 py-1 rounded-md transition-all ${
                                        mode === m 
                                        ? 'bg-teal-600 text-white shadow-md' 
                                        : 'text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {/* --- Main Dashboard Content --- */}
            <main className="max-w-7xl mx-auto p-4 space-y-6">
                
                {/* Status & Actions Bar */}
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h2 className="text-lg font-semibold">System Dashboard</h2>
                        <p className="text-xs text-gray-400">Real-time monitoring of flood sensors</p>
                    </div>
                    
                    <button
                        onClick={downloadReportPDF}
                        disabled={isDownloading}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            isDownloading 
                            ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                            : 'bg-teal-600 hover:bg-teal-700 text-white'
                        }`}
                    >
                        {isDownloading ? (
                            <span>Generating...</span>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span>Download Report</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Error Display */}
                {fetchError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-sm flex items-center">
                        <CpuIcon className="w-4 h-4 mr-2" />
                        Connection Error: {fetchError}
                    </div>
                )}

                {/* Main Visualization Component (FIXED: Passed dashboardRefs) */}
                <ModeView 
                    mode={mode} 
                    liveData={liveData} 
                    historyData={historyData}
                    percents={percents}
                    dashboardRefs={dashboardRefs}
                />
            </main>
        </div>
    );
};

export default App;