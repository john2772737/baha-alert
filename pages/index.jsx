import React, { useState, useEffect } from 'react';

const initialData = {
    pressure: '---', 
    rain: '---', 
    waterLevel: '---', 
    soil: '---'
};

export default function Home() {
    const [sensorData, setSensorData] = useState(initialData);
    const [loading, setLoading] = useState(true);

    const fetchLatestData = async () => {
        console.log(`--- Attempting to fetch data at ${new Date().toLocaleTimeString()} ---`);
        try {
            // NOTE: Using cache: 'no-store' is CRITICAL to prevent the browser from serving stale data
            const response = await fetch('/api/data', { 
                cache: 'no-store' 
            }); 
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json(); 
            
            // 💡 Console log to verify updated data
            console.log('✅ Fetch successful! Data Received:', data); 

            setSensorData(data);
            setLoading(false);

        } catch (error) {
            console.error('❌ Fetch failed:', error.message);
            setLoading(false);
        }
    };

    // Set up the polling loop
    useEffect(() => {
        fetchLatestData(); // Initial immediate fetch

        // Poll every 1 second (1000 milliseconds) for continuous updates
        const intervalId = setInterval(fetchLatestData, 1000); 

        // Cleanup function to stop the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, []); 

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>Next.js Live Sensor Data Feed</h1>
            <p>Status: {loading ? 'Connecting...' : 'Live'}</p>
            <p style={{ color: 'red' }}>Check your browser's console (F12) to see data updates every second.</p>
            
            <hr />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '20px' }}>
                <div>
                    <h2>Pressure</h2>
                    <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{sensorData.pressure} hPa</p>
                </div>
                <div>
                    <h2>Rain</h2>
                    <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{sensorData.rain} mm</p>
                </div>
                <div>
                    <h2>Water Level</h2>
                    <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{sensorData.waterLevel} cm</p>
                </div>
                <div>
                    <h2>Soil Moisture</h2>
                    <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{sensorData.soil} %</p>
                </div>
            </div>
        </div>
    );
}