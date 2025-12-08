// src/utils/fuzzyEngine.js

// --- Helper Functions ---

// Returns 1.0 (True) if value is LOWER than threshold (e.g., Low Distance = High Risk)
const isLow = (val, trueThreshold, falseThreshold) => {
    if (val <= trueThreshold) return 1.0; 
    if (val >= falseThreshold) return 0.0; 
    return (falseThreshold - val) / (falseThreshold - trueThreshold);
};

// Returns 1.0 (True) if value is in the MIDDLE of a range
const isMiddle = (val, start, peak, end) => {
    return Math.max(0, Math.min((val - start) / (peak - start), (end - val) / (end - peak)));
};

// --- MAIN AI FUNCTION ---
export const calculateFloodRisk = (rainRaw, soilRaw, waterDist, pressure) => {
    
    // ============================================
    // 1. FUZZIFICATION (Mapping to your specific thresholds)
    // ============================================

    // --- RAIN SENSOR (0-1023) [Lower = Wet] ---
    // Heavy Rain: Raw Value < 307
    const rainHeavy = isLow(rainRaw, 307, 511);        
    
    // Moderate Rain: Between 307 and 767
    const rainModerate = isMiddle(rainRaw, 307, 511, 767); 
    
    // --- SOIL SENSOR (0-1023) [Lower = Wet] ---
    // Saturated < 511
    const soilSaturated = isLow(soilRaw, 511, 818);    
    
    // --- WATER TANK (cm) [Lower = High/Full] ---
    // High <= 4cm, Normal <= 5cm
    const waterCritical = isLow(waterDist, 4, 5);     

    // --- PRESSURE (hPa) ---
    // Low < 990
    const pressureStorm = isLow(pressure, 990, 1000);  

    // ============================================
    // 2. INFERENCE (The Logic Rules)
    // ============================================

    // Rule 1: Extreme Danger 
    // Trigger: Water is Critical (<=4cm) OR (Heavy Rain + Wet Soil)
    const dangerScore = Math.max(
        waterCritical, 
        Math.min(rainHeavy, soilSaturated)
    );

    // Rule 2: Storm Warning 
    // Trigger: Pressure Low + Moderate Rain
    const stormScore = Math.min(pressureStorm, rainModerate);

    // ============================================
    // 3. DEFUZZIFICATION (Final Score 0-100)
    // ============================================

    // ADJUSTMENT HERE: 
    // I changed Storm Score multiplier from 60 to 45.
    // This prevents the score from jumping too high just because of rain.
    // Real "Critical" status will now mostly rely on the Water Level.
    let finalRisk = (dangerScore * 100) + (stormScore * 45);
    
    // Clamp result to max 100%
    finalRisk = Math.min(100, finalRisk);

    // --- GRADUAL TEXT RECOMMENDATION (6 Levels) ---
    let status = "SAFE";
    let message = "Conditions are normal.";
    
    if (finalRisk >= 90) {
        // Level 6: Emergency
        status = "EMERGENCY";
        message = "WATER OVERFLOW IMMINENT. EVACUATE NOW.";
    } 
    else if (finalRisk >= 70) {
        // Level 5: Critical
        status = "CRITICAL";
        message = "Water is at capacity limits. Prepare for flooding.";
    } 
    else if (finalRisk >= 50) {
        // Level 4: Warning
        status = "WARNING";
        message = "Water levels rising significantly. Monitor closely.";
    } 
    else if (finalRisk >= 30) {
        // Level 3: Advisory
        status = "ADVISORY";
        message = "Heavy rain detected. Soil is saturated.";
    } 
    else if (finalRisk >= 15) {
        // Level 2: Notice
        status = "NOTICE";
        message = "Light to moderate rain detected.";
    } 
    else {
        // Level 1: Safe
        status = "SAFE";
        message = "Water levels low. Conditions stable.";
    }

    return {
        score: finalRisk.toFixed(1),
        status,
        message,
        details: {
            rain: (rainHeavy * 100).toFixed(0),
            soil: (soilSaturated * 100).toFixed(0),
            water: (waterCritical * 100).toFixed(0),
            pressure: (pressureStorm * 100).toFixed(0)
        }
    };
};