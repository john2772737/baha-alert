// src/utils/fuzzyEngine.js

// --- Helper Functions (Unchanged) ---
const isLow = (val, trueThreshold, falseThreshold) => {
    if (val <= trueThreshold) return 1.0; 
    if (val >= falseThreshold) return 0.0; 
    // Linear membership function
    return (falseThreshold - val) / (falseThreshold - trueThreshold);
};

const isMiddle = (val, start, peak, end) => {
    // Calculates the triangular membership function output
    let left = (val - start) / (peak - start);
    let right = (end - val) / (end - peak);
    return Math.max(0, Math.min(left, right));
};

// --- MAIN AI FUNCTION ---
export const calculateFloodRisk = (rainRaw, soilRaw, waterDist, pressure) => {
    
    // ============================================
    // 1. FUZZIFICATION (Inputs -> 0.0 to 1.0)
    // ============================================

    // --- RAIN SENSOR (Raw: 0-1023) ---
    const rainHeavy = isLow(rainRaw, 307, 511);        
    const rainModerate = isMiddle(rainRaw, 307, 511, 767); 
    
    // --- SOIL MOISTURE (Raw: 0-1023) ---
    // soilSaturated: From 511 (wet) to 818 (moist).
    const soilSaturated = isLow(soilRaw, 511, 818);    
    // ⭐ NEW: soilMoist: Peaks around 818 (moist), transitions from 511 (wet) to 1023 (dry)
    const soilMoist = isMiddle(soilRaw, 511, 818, 1023); 
    
    // --- WATER LEVEL (Distance: 0-50 CM) ---
    const waterCritical = isLow(waterDist, 3, 5);     
    const waterHigh = isLow(waterDist, 3, 10); 
    
    // --- BAROMETRIC PRESSURE (hPa) ---
    const pressureStorm = isLow(pressure, 990, 1000);  

    // ============================================
    // 2. INFERENCE (The "Communication" Rules)
    // ============================================

    // RULE A: The "Heavy Runoff" Effect (Heavy Rain + Soil Saturated)
    const heavyRunoffRisk = Math.min(rainHeavy, soilSaturated);

    // RULE B: The "Storm Surge" Effect (Water High + Pressure Storm)
    const surgeRisk = Math.min(waterHigh, pressureStorm); 

    // RULE C: The "Active Flood" Effect (Heavy Rain + Water Critical)
    const activeFloodRisk = Math.min(rainHeavy, waterCritical);

    // RULE D: The "Triple Failure" Combo (Heavy Rain + Soil Saturated + Water Critical)
    const systemFailure = Math.min(rainHeavy, soilSaturated, waterCritical);

    // RULE E: The "Persistence" Effect (Moderate Rain + Soil Saturated)
    const persistenceRisk = Math.min(rainModerate, soilSaturated);
    
    // ⭐ NEW RULE F: The "Moist Runoff" Effect (Heavy Rain + Soil Moist)
    // Heavy rain on moist soil is a precursor risk.
    const moistRunoffRisk = Math.min(rainHeavy, soilMoist);


    // ============================================
    // 3. DEFUZZIFICATION (Weighted Total)
    // ============================================

    let totalRisk = 0;

    // If the three key systems fail together (Rule D), instant 100%
    if (systemFailure > 0.5) {
        totalRisk = 100;
    } 
    else {
        // Otherwise, weigh the specific interactions:
        
        // Active Flooding (Rule C) is the most dangerous scenario (weight 60)
        totalRisk = (activeFloodRisk * 60);
        
        // Heavy Runoff (Rule A) adds high risk (weight 35)
        totalRisk += (heavyRunoffRisk * 35);
        
        // Persistence Risk (Rule E) adds low/moderate risk (weight 15)
        totalRisk += (persistenceRisk * 15);
        
        // ⭐ NEW: Moist Runoff Risk (Rule F) adds minor precursor risk (weight 10)
        totalRisk += (moistRunoffRisk * 10);
        
        // Reduced Surge (Rule B) low weight (weight 5)
        totalRisk += (surgeRisk * 5); 
        
        // Base risk if Water is critical on its own (failsafe)
        totalRisk += (waterCritical * 50);
    }

    // Clamp to 0-100
    let finalRisk = Math.min(100, totalRisk);
    
    // --- STATUS TEXT (Unchanged) ---
    let status = "STABLE";
    let message = "Normal levels.";

    if (finalRisk >= 90) {
        status = "EMERGENCY";
        message = "ALL SENSORS CRITICAL. EVACUATE.";
    } 
    else if (finalRisk >= 70) {
        status = "CRITICAL";
        message = "High water with active rain/storm inputs.";
    } 
    else if (finalRisk >= 50) {
        status = "WARNING";
        message = "Water rising due to rain/soil saturation.";
    } 
    else if (finalRisk >= 30) {
        status = "ADVISORY";
        message = "Sensors detecting potential runoff.";
    } 
    else {
        status = "STABLE";
        message = "Normal levels.";
    }

    // --------------------------------------------
    // 5. RETURN OBJECT (Unchanged structure)
    // --------------------------------------------
    return {
        score: finalRisk.toFixed(1),
        status,
        message,
        
        details: {
            rain: (rainHeavy * 100).toFixed(0),
            soil: (soilSaturated * 100).toFixed(0),
            water: (waterCritical * 100).toFixed(0),
            pressure: (pressureStorm * 100).toFixed(0)
        },

        interactions: {
            runoff_factor: (heavyRunoffRisk * 100).toFixed(0),
            surge_factor: (surgeRisk * 100).toFixed(0),
            flood_factor: (activeFloodRisk * 100).toFixed(0)
        }
    };
};