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
    // Your Logic: > 70% is Heavy. 
    // Calculation: 1023 * (1 - 0.70) ≈ 307.
    // Heavy Rain: Raw Value < 307
    const rainHeavy = isLow(rainRaw, 307, 511);        
    
    // Moderate Rain: Between 307 and 767 (25%-70%)
    const rainModerate = isMiddle(rainRaw, 307, 511, 767); 
    
    // --- SOIL SENSOR (0-1023) [Lower = Wet] ---
    // Your Logic: > 50% is Wet.
    // Calculation: 1023 * (1 - 0.50) ≈ 511.
    const soilSaturated = isLow(soilRaw, 511, 818);    
    
    // --- WATER TANK (cm) [Lower = High/Full] ---
    // Your Logic: High <= 4cm, Normal <= 5cm
    // RISK MAPPING: 
    // If distance is <= 4cm, Risk is 100% (1.0)
    // If distance is >= 5cm, Risk drops to 0% (0.0)
    const waterCritical = isLow(waterDist, 4, 5);     

    // --- PRESSURE (hPa) ---
    // Your Logic: Low < 990
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

    // Weighted Calculation
    // Danger counts for 100%, Storm signs count for 60%
    let finalRisk = (dangerScore * 100) + (stormScore * 60);
    
    // Clamp result to max 100%
    finalRisk = Math.min(100, finalRisk);

    // --- Text Recommendation ---
    let status = "SAFE";
    let message = "Conditions are normal.";
    
    if (finalRisk > 80) {
        status = "CRITICAL";
        message = "EVACUATE IMMEDIATELY. Water is at capacity.";
    } else if (finalRisk > 50) {
        status = "WARNING";
        message = "Water levels rising. Monitor alerts closely.";
    } else if (finalRisk > 20) {
        status = "CAUTION";
        message = "Rain detected. Soil saturation increasing.";
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