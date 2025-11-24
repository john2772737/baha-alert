import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- Initial Data Structure (Retained for reference) ---
const initialSensorData = {
    pressure: 1012.0, // hPa
    rain: 0.0, // mm/hr
    waterLevel: 65.0, // %
    soil: 60.0, // %
};

// Real API Endpoint provided by the user
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

// Helper function to get the current formatted time
const getFormattedTime = () => {
    return new Date().toLocaleTimeString('en-US');
};

// --- Main App Component (Console Debugging Mode) ---
const App = () => {
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [mode, setMode] = useState('Auto'); // Keep mode set to Auto to enable fetch

    // State used internally for mapping, even if not displayed
    const [liveData, setLiveData] = useState(initialSensorData);

    // === 0. Client Mount, Script Injection ===
    useEffect(() => {
        setIsClient(true);
        
        // Only load essential scripts (React/DOM and Tailwind)
        const cdnUrls = [
            "https://unpkg.com/react@18/umd/react.production.min.js",
            "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
            "https://cdn.tailwindcss.com",
        ];

        const loadScript = (url) => {
            return new Promise(resolve => {
                if (document.querySelector(`script[src="${url}"]`)) return resolve();
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        };

        Promise.all(cdnUrls.map(loadScript)).then(() => {
            setScriptsLoaded(true);
            console.log('Scripts loaded. Starting fetch initialization.');
        });
        
    }, []);

    /**
     * Helper function to map descriptive API strings back to numerical values.
     * This ensures the received data is processed before logging.
     */
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
    
    // 1. Fetch Live Data (1-second polling)
    const fetchSensorData = useCallback(async () => {
        if (!isClient || !scriptsLoaded) return;
        
        console.log(`[${getFormattedTime()}] --- Fetching...`);

        try {
            const response = await fetch(REAL_API_ENDPOINT); 
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}.`);
            }
            
            const data = await response.json();
            
            // Process data using the mapper
            const mappedData = {
                pressure: parseFloat(data.pressure) || initialSensorData.pressure,
                rain: mapDescriptiveValue('rain', data.rain),
                waterLevel: mapDescriptiveValue('waterLevel', data.waterLevel),
                soil: mapDescriptiveValue('soil', data.soil),
            };

            // Update internal state
            setLiveData(mappedData); 
            
            console.log(`[${getFormattedTime()}] ✅ SUCCESS | Raw Data:`, data);
            console.log(`[${getFormattedTime()}] ✅ SUCCESS | Mapped Data:`, mappedData);

        } catch (error) {
            console.error(`[${getFormattedTime()}] ❌ FETCH FAILED:`, error.message);
        }
    }, [isClient, scriptsLoaded]); 

    // === 2. Data Polling Effect (1 second interval) ===
    useEffect(() => {
        if (mode !== 'Auto' || !isClient || !scriptsLoaded) return;

        // Fetch immediately upon component mounting (or when dependencies change)
        fetchSensorData(); 
        
        const interval = setInterval(fetchSensorData, 1000); 
        console.log('Polling interval started (1000ms).');
        
        return () => clearInterval(interval);
        
    }, [fetchSensorData, mode, isClient, scriptsLoaded]); 

    
    // --- NO RENDER SECTION ---
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-400 font-inter">
            <p className="text-xl">
                Debugging Mode Active. Check your browser's console (F12) for live data updates every second.
            </p>
        </div>
    );
}

export default App;