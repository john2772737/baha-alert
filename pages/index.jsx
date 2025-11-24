import React, { useState, useEffect, useCallback } from 'react';

// --- Configuration ---
const initialSensorData = { pressure: 1012.0, rain: 0.0, waterLevel: 65.0, soil: 60.0 };
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

// --- Helper Functions ---
const getFormattedTime = () => new Date().toLocaleTimeString('en-US');

// Helper function to map descriptive API strings back to numerical values 
// (Kept for logging to see the converted result)
const mapDescriptiveValue = (key, value) => {
    if (typeof value === 'number') return value;
    if (!value) return initialSensorData[key] || 0.0;
    
    const normalizedValue = String(value).toLowerCase().trim();

    switch (key) {
        case 'rain': 
            if (normalizedValue.includes('dry') || normalizedValue.includes('no rain')) return 0.0;
            if (normalizedValue.includes('light')) return 5.0; 
            if (normalizedValue.includes('heavy')) return 35.0; 
            return 0.0; 
            
        case 'waterlevel': 
            if (normalizedValue.includes('low') || normalizedValue.includes('below normal')) return 20.0; 
            if (normalizedValue.includes('normal') || normalizedValue.includes('optimal')) return 65.0; 
            if (normalizedValue.includes('above normal') || normalizedValue.includes('high')) return 85.0; 
            return 65.0; 
            
        case 'soil': 
            if (normalizedValue.includes('dry')) return 20.0; 
            if (normalizedValue.includes('optimal') || normalizedValue.includes('normal')) return 50.0;
            if (normalizedValue.includes('wet')) return 80.0; 
            return 50.0; 
            
        default: return initialSensorData[key] || 0.0;
    }
};

// --- Console Tester Component ---
const App = () => {
    // Only track mode and whether the component is mounted (isClient)
    const [isClient, setIsClient] = useState(false);
    const [mode] = useState('Auto'); // Hardcode mode to Auto for testing

    useEffect(() => {
        setIsClient(true);
    }, []);

    // 1. Fetch Live Data (1-second polling)
    const fetchSensorData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;

        try {
            const response = await fetch(REAL_API_ENDPOINT); 
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Map the data for consistency (this is what the UI would use)
            const mappedData = {
                pressure: parseFloat(data.pressure) || initialSensorData.pressure,
                rain: mapDescriptiveValue('rain', data.rain),
                waterLevel: mapDescriptiveValue('waterLevel', data.waterLevel),
                soil: mapDescriptiveValue('soil', data.soil),
            };

            // *** CRITICAL STEP: CONSOLE LOGGING ***
            console.log(`[${getFormattedTime()}] API SUCCESS - Raw Data:`, data);
            console.log(`[${getFormattedTime()}] Mapped Numeric Data:`, mappedData);
            
        } catch (error) {
            console.error(`[${getFormattedTime()}] API FETCH FAILED:`, error.message);
        }
    }, [isClient, mode]); 

    // === 2. Data Polling Effect (1 second interval) ===
    useEffect(() => {
        if (mode !== 'Auto') return;
        
        // Initial fetch right away
        fetchSensorData(); 

        const interval = setInterval(fetchSensorData, 1000); 
        return () => clearInterval(interval);
    }, [fetchSensorData, mode]);
    
    // --- RENDER ---
    // Return null since we want no UI, just console output
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-400 font-inter p-4">
            <svg className="w-8 h-8 animate-spin mr-3 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 18A8 8 0 1 0 7 19l-4-4"></path><path d="M4 13v-2"></path><path d="M17 19h-2l-4-4"></path></svg>
            <p className="text-lg">Testing live API connection. Check your browser console (F12).</p>
        </div>
    );
}

export default App;