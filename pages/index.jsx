import React, { useState, useEffect } from 'react';

// Define the expected sensor data structure
const initialData = {
    pressure: '---', 
    rain: '---', 
    waterLevel: '---', 
    soil: '---'
};

export default function Home() {
    // State to hold the fetched data
    const [sensorData, setSensorData] = useState(initialData);
    const [loading, setLoading] = useState(true);

    // Function to fetch the latest sensor data from the API
    const fetchLatestData = async () => {
        console.log('--- Attempting to fetch data from /api/data ---');
        try {
            // NOTE: The API endpoint is relative to the root: /api/data
            const response = await fetch('/api/data'); 
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json(); 
            
            // 💡 LOG the successful data to the console for testing
            console.log('✅ Fetch successful! Latest Sensor Data Received:');
            console.log(data); 

            // Update the React state
            setSensorData(data);
            setLoading(false);

        } catch (error) {
            console.error('❌ Fetch failed:', error.message);
            setLoading(false);
        }
    };

    // useEffect hook to run the fetch when the component mounts
    useEffect(() => {
        // Initial fetch
        fetchLatestData();

        // Set up the continuous polling (e.g., every 5 seconds)
        const intervalId = setInterval(fetchLatestData, 5000); 

        // Cleanup function: stop the polling when the component is unmounted
        return () => clearInterval(intervalId);
    }, []); // Empty dependency array ensures it runs only once on mount

    return (
        <div>
            <h1>Next.js Sensor Data Live Feed</h1>
            {loading ? (
                <p>Loading...</p>
            ) : (
                <div style={{ display: 'flex', gap: '20px' }}>
                    <p>Pressure: <strong>{sensorData.pressure}</strong></p>
                    <p>Rain: <strong>{sensorData.rain}</strong></p>
                    <p>Water Level: <strong>{sensorData.waterLevel}</strong></p>
                    <p>Soil: <strong>{sensorData.soil}</strong></p>
                </div>
            )}
            <p>Check your browser's console (F12) to see the polling logs.</p>
        </div>
    );
}