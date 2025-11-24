import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Real API Endpoint provided by the user
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

const ApiTestPage = () => {
    const [fetchError, setFetchError] = useState(null);
    const [liveData, setLiveData] = useState({ message: "Awaiting first fetch..." });
    const [status, setStatus] = useState('info');

    // Helper to get formatted time (simulating minimal environment utilities)
    const getFormattedTime = () => new Date().toLocaleTimeString('en-US');

    const updateStatus = (message, type = 'info') => {
        setFetchError(message);
        setStatus(type);
    };

    // Core Fetch Logic - Executes every 1 second
    const fetchLiveTest = useCallback(async () => {
        updateStatus('Pinging API...', 'info');

        try {
            const response = await fetch(REAL_API_ENDPOINT);

            if (!response.ok) {
                // Read response body for better debugging info
                const errorText = await response.text(); 
                throw new Error(`HTTP Status ${response.status}: ${response.statusText || 'Unknown Error'}. Body: ${errorText.substring(0, 50)}...`);
            }

            const data = await response.json();
            
            // Critical check to ensure the format is what the gauge dashboard expects
            const requiredKeys = ['pressure', 'rain', 'waterLevel', 'soil'];
            const isValidFormat = requiredKeys.every(key => key in data);

            if (isValidFormat) {
                 updateStatus('SUCCESS: Data Fetched and Format is Correct!', 'success');
            } else {
                 updateStatus('WARNING: Fetch Succeeded, but Data Format is Unexpected.', 'error');
            }
            
            setLiveData(data);

        } catch (error) {
            updateStatus(`FETCH FAILED! Error: ${error.message}. Check browser console.`, 'error');
            setLiveData({ message: 'Fetch failed. See error status above.' });
            console.error(`[${getFormattedTime()}] CRITICAL FETCH ERROR:`, error);
        }
    }, []);

    // Set up 1-second polling interval
    useEffect(() => {
        fetchLiveTest(); // Initial fetch
        const interval = setInterval(fetchLiveTest, 1000); 
        return () => clearInterval(interval); // Cleanup interval on unmount
    }, [fetchLiveTest]);

    // Tailwind CSS classes based on status state
    const statusClasses = useMemo(() => {
        if (status === 'success') return 'bg-emerald-600/30 text-emerald-300';
        if (status === 'error') return 'bg-red-600/30 text-red-300';
        return 'bg-sky-600/30 text-sky-300';
    }, [status]);


    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <style jsx global>{`
                /* Ensure global styling for dark mode appearance */
                body {
                    margin: 0;
                    padding: 0;
                    background-color: #0f172a;
                }
            `}</style>
            
            <div className="max-w-4xl mx-auto bg-slate-800 rounded-xl shadow-2xl p-6">
                <h1 className="text-4xl font-extrabold text-emerald-400 mb-4 border-b border-slate-700 pb-2">
                    Next.js API Live Data Tester
                </h1>
                <p className="text-md text-slate-400 mb-6">
                    Polling Vercel API endpoint every 1 second to verify live data stream and data format.
                </p>

                <div id="status-display" className={`mb-4 p-3 rounded-lg font-bold transition-colors ${statusClasses}`}>
                    {fetchError || "Initializing..."}
                </div>

                <h2 className="text-xl font-semibold text-slate-300 mt-6 mb-3">Latest API Response (JSON):</h2>
                <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-slate-50 text-left">
                    {JSON.stringify(liveData, null, 2)}
                </pre>
            </div>
        </div>
    );
}

export default ApiTestPage;