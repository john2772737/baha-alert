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

// --- MAIN AI FUNCTION ---
export const calculateFloodRisk = (rainRaw, soilRaw, waterDist, pressure) => {
    
    // 1. FUZZIFICATION (Mapping your tables)
    
    // Rain: Heavy (0-306), Moderate (307-511)
    const rainHeavy = isLow(rainRaw, 306, 511);        
    const rainModerate = isMiddle(rainRaw, 306, 409, 767); 
    
    // Soil: Wet (0-511)
    const soilSaturated = isLow(soilRaw, 511, 818);    
    
    // Water: High (0-3cm), Normal (4-15cm)
    const waterCritical = isLow(waterDist, 3, 15);     
    const waterHigh = isMiddle(waterDist, 3, 10, 20);  

    // Pressure: Low < 990
    const pressureStorm = isLow(pressure, 990, 1000);  

    // 2. INFERENCE (The Logic Rules)

    // Rule 1: Extreme Danger (Critical Water OR Heavy Rain + Wet Soil)
    const dangerScore = Math.max(
        waterCritical, 
        Math.min(rainHeavy, soilSaturated)
    );

    // Rule 2: Storm Warning (Low Pressure + Moderate Rain)
    const stormScore = Math.min(pressureStorm, rainModerate);

    // 3. RESULT (Score 0-100)
    let finalRisk = (dangerScore * 100) + (stormScore * 60);
    finalRisk = Math.min(100, finalRisk);

    // Generate Text Recommendation
    let status = "SAFE";
    let message = "Conditions are normal.";
    
    if (finalRisk > 80) {
        status = "CRITICAL";
        message = "EVACUATE IMMEDIATELY. Water levels are critical.";
    } else if (finalRisk > 50) {
        status = "WARNING";
        message = "Prepare for flooding. Monitor alerts closely.";
    } else if (finalRisk > 20) {
        status = "CAUTION";
        message = "Rain detected. Soil is absorbing water.";
    }

    return {
        score: finalRisk.toFixed(1),
        status,
        message,
        details: {
            rain: (rainHeavy * 100).toFixed(0),
            soil: (soilSaturated * 100).toFixed(0),
            water: (waterCritical * 100).toFixed(0)
        }
    };
};