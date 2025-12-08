// src/utils/fuzzyEngine.js

// --- Helper Functions ---
const isLow = (val, trueThreshold, falseThreshold) => {
    if (val <= trueThreshold) return 1.0; 
    if (val >= falseThreshold) return 0.0; 
    return (falseThreshold - val) / (falseThreshold - trueThreshold);
};

const isMiddle = (val, start, peak, end) => {
    return Math.max(0, Math.min((val - start) / (peak - start), (end - val) / (end - peak)));
};

export const calculateFloodRisk = (rainRaw, soilRaw, waterDist, pressure) => {
    
    // --- 1. FUZZIFICATION (Updated for New Water Levels) ---

    // RAIN (Keep existing Thesis values)
    const rainHeavy = isLow(rainRaw, 306, 511);        
    const rainModerate = isMiddle(rainRaw, 306, 409, 767); 
    
    // SOIL (Keep existing Thesis values)
    const soilSaturated = isLow(soilRaw, 511, 818);    
    
    // WATER TANK (UPDATED) 
    // High Risk = Distance is <= 4cm
    // Safe = Distance is > 5cm
    const waterCritical = isLow(waterDist, 4, 5.5); // 1.0 Risk at 4cm, 0.0 Risk at 5.5cm    
    
    // PRESSURE (Keep existing)
    const pressureStorm = isLow(pressure, 990, 1000);  

    // --- 2. INFERENCE (Logic Rules) ---

    // ... inside calculateFloodRisk ...

    // Rule 1: Extreme Danger (Water Critical OR Heavy Rain+Wet Soil)
    const dangerScore = Math.max(waterCritical, Math.min(rainHeavy, soilSaturated));

    // Rule 2: Storm Warning (Pressure Drop + Moderate Rain)
    const stormScore = Math.min(pressureStorm, rainModerate);
    
    // Rule 3: General Rain Factor (NEW)
    // Even if it's just raining a little, add a tiny bit of risk
    const rainScore = rainModerate * 0.2; // 20% weight

    // --- CALCULATION ---
    // We sum them up, but clamp the result to 100 max
    let finalRisk = (dangerScore * 100) + (stormScore * 60) + (rainScore * 20);
    
    finalRisk = Math.min(100, finalRisk); // Ensure it never goes over 100%

    // Generate Status Text
    let status = "SAFE";
    let message = "Water levels are low. Conditions stable.";
    
    if (finalRisk > 80) {
        status = "CRITICAL";
        message = "EVACUATE. Water is at High Capacity limits.";
    } else if (finalRisk > 50) {
        status = "WARNING";
        message = "Water levels rising rapidly. Monitor closely.";
    } else if (finalRisk > 20) {
        status = "CAUTION";
        message = "Rain detected. Check water reserves.";
    }

    return {
        score: finalRisk.toFixed(1),
        status,
        message,
        details: {
            rain: (rainHeavy * 100).toFixed(0),
            soil: (soilSaturated * 100).toFixed(0),
            water: (waterCritical * 100).toFixed(0) // This will now show 100% if dist <= 4
        }
    };
};