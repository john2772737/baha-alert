import React, { useState, useEffect, useCallback } from 'react';

// The main application component for testing the API endpoint
const App = () => {
    // State variables to hold the fetched data, loading status, and any errors
    const [latestData, setLatestData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // The API endpoint URL to test
    const API_URL = 'https://baha-alert.vercel.app/api';

    // useCallback is used to memoize the function, preventing infinite re-renders
    // if it were used as a dependency in useEffect, though not strictly necessary here, 
    // it's a good practice for asynchronous actions.
    const fetchLatestData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setLatestData(null);
        
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
    }, [API_URL]);

    // useEffect to run the fetch function once when the component mounts
    useEffect(() => {
        fetchLatestData();
    }, [fetchLatestData]); // Dependency array includes fetchLatestData

    // Helper function to render the data content
    const renderData = () => {
        if (loading) {
            return (
                <div className="flex items-center space-x-2 text-yellow-600">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p>Fetching data...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="p-2 bg-red-100 border-l-4 border-red-500 text-red-700">
                    <p className="font-bold">Error Fetching Data:</p>
                    <pre className="text-xs whitespace-pre-wrap">{error}</pre>
                </div>
            );
        }

        if (latestData && latestData.data) {
            const data = latestData.data;
            return (
                <div>
                    <p className="font-bold text-green-700 mb-2">Latest Record Found:</p>
                    <p className="text-sm"><strong>ID:</strong> {data._id}</p>
                    <p className="text-sm"><strong>Time:</strong> {new Date(data.createdAt).toLocaleTimeString()}</p>
                    <p className="text-sm mt-3"><strong>Full Payload:</strong></p>
                    <pre className="bg-gray-200 p-3 mt-1 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                        {JSON.stringify(data.payload, null, 2)}
                    </pre>
                </div>
            );
        }
        
        if (latestData && latestData.message) {
             return <p className="text-orange-600">{latestData.message}</p>;
        }

        return <p className="text-gray-700">Press the button to initiate the test.</p>;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <h1 className="text-3xl font-extrabold text-indigo-700 mb-2">API Test Client (React)</h1>
                <p className="text-gray-600 mb-4">
                    Testing API endpoint: <code className="bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded text-sm">{API_URL}</code>
                </p>
                <p className="text-sm font-semibold text-red-600 mb-6">
                    Check your browser's console (F12) for detailed request logs.
                </p>

                <div id="data-display" className="bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-[100px]">
                    {renderData()}
                </div>
                
                <button 
                    onClick={fetchLatestData} 
                    disabled={loading}
                    className={`mt-6 w-full px-4 py-3 font-semibold rounded-lg shadow-md transition duration-150 ease-in-out ${
                        loading 
                            ? 'bg-indigo-400 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                >
                    {loading ? 'Fetching...' : 'Re-run Test & Fetch Latest Data'}
                </button>
            </div>
        </div>
    );
};

export default App;