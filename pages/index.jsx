import React, { useState, useEffect, useCallback } from 'react';

// The main application component for testing the API endpoint
const App = () => {
    // State variables to hold the fetched data, loading status, and any errors
    const [latestData, setLatestData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // New state to manage the visual flash when new data arrives
    const [newDataAvailable, setNewDataAvailable] = useState(false);
    
    // The API endpoint URL to test
    const API_URL = 'https://baha-alert.vercel.app/api';
    
    // Define a short-lived key to reset the new data state, triggering the flash effect
    const NEW_DATA_FLASH_DURATION = 500; // ms

    const fetchLatestData = useCallback(async () => {
        // Only set loading state on the first run, not subsequent interval updates
        if (!latestData) setLoading(true); 
        setError(null);
        
        console.log(`--- Starting GET request to ${API_URL} ---`);

        try {
            // 1. Make the GET request
            const response = await fetch(API_URL);

            // 2. Check for non-OK HTTP status
            if (!response.ok) {
                const errorDetails = await response.json().catch(() => ({}));
                throw new Error(`HTTP error! Status: ${response.status}. Message: ${errorDetails.message || 'Unknown server error.'}`);
            }

            // 3. Parse the JSON body
            const result = await response.json();

            // 4. Log the successful result to the console (as requested)
            console.log('✅ API Test Successful! Latest Document Received:');
            console.log(result);

            // 5. Update state
            if (result.success && result.data) {
                // IMPORTANT: Check if the fetched document is actually NEW (different ID)
                const isNewRecord = !latestData || (latestData._id !== result.data._id);
                
                if (isNewRecord) {
                    // Only trigger the visual flash if the record is distinct
                    setNewDataAvailable(true);
                    // Use a timeout to turn the flash off after the defined duration
                    setTimeout(() => setNewDataAvailable(false), NEW_DATA_FLASH_DURATION);
                }
                
                // Always update the data, even if the ID is the same (to refresh the time display)
                setLatestData(result.data);

            } else {
                setLatestData({ message: 'Success, but no data was returned (DB may be empty).' });
                console.warn('API returned success: true, but no data object. Database might be empty.');
            }

        } catch (err) {
            // 6. Log the error to the console
            console.error('❌ API Test Failed:', err.message);
            // 7. Update error state
            setError(err.message);
        } finally {
            // 8. Always set loading to false when the request completes
            setLoading(false);
            console.log('--- GET Request Finished ---');
        }
    }, [API_URL, latestData]); // latestData is needed here to compare the new data's ID against the current data's ID

    // useEffect to run the fetch function continuously every 1 second
    useEffect(() => {
        // Run once immediately on mount
        fetchLatestData();

        // Set up the interval for fetching every 1000 milliseconds (1 second)
        const intervalId = setInterval(fetchLatestData, 1000);

        // Cleanup function: Clear the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [fetchLatestData]); 

    // Helper function to render the data content
    const renderData = () => {
        // Dynamic classes for the visual flash effect
        const dataBoxClasses = `bg-gray-50 p-4 rounded-lg border min-h-[100px] transition duration-500 ease-in-out ${
            newDataAvailable
                ? 'border-green-400 shadow-lg shadow-green-200 ring-4 ring-green-300 ring-opacity-50'
                : 'border-gray-200 shadow-inner'
        }`;

        if (loading && !latestData) { // Only show full loading screen on initial load
            return (
                <div className={dataBoxClasses}>
                    <div className="flex items-center space-x-2 text-yellow-600">
                        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p>Fetching initial data...</p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="p-2 bg-red-100 border-l-4 border-red-500 text-red-700">
                    <p className="font-bold">Error Fetching Data (Stopped):</p>
                    <pre className="text-xs whitespace-pre-wrap">{error}</pre>
                </div>
            );
        }

        if (latestData && latestData.data) {
            const data = latestData.data;
            const updateTime = new Date(data.createdAt).toLocaleTimeString('en-US', { hour12: false });
            
            return (
                <div className={dataBoxClasses}>
                    <p className="font-bold text-green-700 mb-2 flex justify-between items-center">
                        <span>Latest Record Found</span> 
                        <span className="text-xs font-normal bg-green-100 px-2 py-1 rounded-full text-green-800">
                            Last DB Time: {updateTime}
                        </span>
                    </p>
                    <p className="text-sm"><strong>Document ID:</strong> <code className="text-gray-500 break-all">{data._id}</code></p>
                    <p className="text-sm"><strong>Creation Time:</strong> {new Date(data.createdAt).toISOString()}</p>
                    <p className="text-sm mt-3"><strong>Full Payload:</strong></p>
                    <pre className="bg-gray-200 p-3 mt-1 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                        {/* Stringify the payload for display */}
                        {JSON.stringify(data.payload, null, 2)}
                    </pre>
                </div>
            );
        }
        
        if (latestData && latestData.message) {
             return <p className="text-orange-600">{latestData.message}</p>;
        }

        return <div className={dataBoxClasses}><p className="text-gray-700">Waiting for the first data fetch...</p></div>;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <h1 className="text-3xl font-extrabold text-indigo-700 mb-2">Real-Time API Monitor (1s Refresh)</h1>
                <p className="text-gray-600 mb-4">
                    Continuously fetching the **latest** document every 1 second from: <code className="bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded text-sm">{API_URL}</code>
                </p>
                <p className="text-sm font-semibold text-red-600 mb-6">
                    Watch the console (F12) for detailed logs of every request. The data box will **flash green** only when a *new* document is recorded.
                </p>

                <div id="data-display">
                    {renderData()}
                </div>
                
                {/* Removed the button for automatic fetching */}
            </div>
        </div>
    );
};

export default App;