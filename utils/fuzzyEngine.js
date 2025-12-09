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
    //    Water thresholds: Critical 3cm-5cm, High 3cm-10cm
    // ============================================

    // --- RAIN SENSOR (Raw: 0-1023) ---
    const rainHeavy = isLow(rainRaw, 307, 511);        
    const rainModerate = isMiddle(rainRaw, 307, 511, 767); 
    
    // --- SOIL MOISTURE (Raw: 0-1023) ---
    const soilSaturated = isLow(soilRaw, 511, 818);    
    const soilMoist = isMiddle(soilRaw, 511, 818, 1023); 
    
    // --- WATER LEVEL (Distance: CM) ---
    const waterCritical = isLow(waterDist, 3, 5);     
    const waterHigh = isLow(waterDist, 3, 10); 

    // --- BAROMETRIC PRESSURE (hPa) ---
    const pressureStorm = isLow(pressure, 990, 1000);  

    // ============================================
    // 2. INFERENCE (The "Communication" Rules)
    // ============================================

    // Rule A: Heavy Runoff (Heavy Rain + Soil Saturated)
    const heavyRunoffRisk = Math.min(rainHeavy, soilSaturated);

    // Rule B: Storm Surge (Water High + Pressure Storm)
    const surgeRisk = Math.min(waterHigh, pressureStorm); 

    // Rule C: Active Flood (Heavy Rain + Water Critical)
    const activeFloodRisk = Math.min(rainHeavy, waterCritical);

    // Rule D: Triple Failure Combo (Heavy Rain + Soil Saturated + Water Critical)
    const systemFailure = Math.min(rainHeavy, soilSaturated, waterCritical);

    // Rule E: Persistence Risk (Moderate Rain + Soil Saturated)
    const persistenceRisk = Math.min(rainModerate, soilSaturated);
    
    // Rule F: Moist Runoff (Heavy Rain + Soil Moist)
    const moistRunoffRisk = Math.min(rainHeavy, soilMoist);


    // ============================================
    // 3. DEFUZZIFICATION (Weighted Total - Fine-Tuned)
    // ============================================

    let totalRisk = 0;

    // If the three key systems fail together (Rule D), instant 100%
    if (systemFailure > 0.5) {
        totalRisk = 100;
    } 
    else {
        // Active Flooding (Rule C) is the most dangerous scenario (Weight 65)
        totalRisk = (activeFloodRisk * 65);
        
        // Base risk if Water is critical on its own (Weight 45)
        totalRisk += (waterCritical * 45); 

        // Heavy Runoff (Rule A) adds high risk (Weight 30)
        totalRisk += (heavyRunoffRisk * 30);
        
        // Persistence Risk (Rule E) adds sustained moderate risk (Weight 20)
        totalRisk += (persistenceRisk * 20);
        
        // Moist Runoff Risk (Rule F) adds minor precursor risk (Weight 15)
        totalRisk += (moistRunoffRisk * 15);
        
        // Reduced Surge (Rule B) low weight (Weight 5)
        totalRisk += (surgeRisk * 5); 
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