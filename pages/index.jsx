Skip to content
john2772737's projects
john2772737's projects

Hobby

baha-alert

CnBWngBff


Find…
F

Source
Output
pages/index.jsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// --- Initial Data Structure ---
const initialSensorData = {
    pressure: 1012.0, // hPa (numeric)
    rain: 0.0, // mm/hr (numeric, or categorical string)
    soil: 60.0, // % (numeric, or categorical string)
    waterTank: 'Normal' // Ultrasonic status
};

// Real API Endpoint provided by the user
const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 

// Define timing constant
const FETCH_INTERVAL_MS = 1000; // 5 seconds

// Helper function to get the current formatted time
const getFormattedTime = () => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- Main App Component (Dynamic Structure) ---
const App = () => {
    // CRITICAL: isMounted flag is still essential for client-side initialization
    const [isClient, setIsClient] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [fetchError, setFetchError] = useState(null); // State for showing API errors
    
    // NEW STATE: System mode control
    const [mode, setMode] = useState('Auto');
    const modes = ['Auto', 'Maintenance', 'Sleep'];
baha-alert – Deployment Source – Vercel