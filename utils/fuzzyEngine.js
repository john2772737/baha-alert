// src/utils/fuzzyEngine.js

// --- Helper Functions (Unchanged) ---
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
    
    // ============================================
    // 1. FUZZIFICATION (Inputs -> 0.0 to 1.0)
    // ============================================

    // Rain (Low value = Wet)
    const rainHeavy = isLow(rainRaw, 307, 511);        
    const rainModerate = isMiddle(rainRaw, 307, 511, 767); 
    
    // Soil (Low value = Wet)
    const soilSaturated = isLow(soilRaw, 511, 818);    
    
    // Water Level (Low distance = High/Full)
    const waterHigh = isLow(waterDist, 4, 10); 
    const waterCritical = isLow(waterDist, 4, 5);     

    // Pressure (Low value = Storm)
    const pressureStorm = isLow(pressure, 990, 1000);  

    // ============================================
    // 2. INFERENCE (The "Communication" Rules)
    // ============================================

    /* Here, sensors "talk" to each other using Math.min() (AND gate). */

    // RULE A: The "Runoff" Effect (Rain + Soil)
    const runoffRisk = Math.min(rainHeavy, soilSaturated);

    // RULE B: The "Storm Surge" Effect (Water + Pressure)
    // This risk is kept low to reflect reduced importance.
    const surgeRisk = Math.min(waterHigh, pressureStorm); 

    // RULE C: The "Active Flood" Effect (Rain + Water)
    const activeFloodRisk = Math.min(rainHeavy, waterCritical);

    // ⭐ MODIFICATION: RULE D is now a 3-sensor failure (Pressure removed)
    // The three most immediate flood indicators failing together.
    const systemFailure = Math.min(rainHeavy, soilSaturated, waterCritical);


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
        
        // Active Flooding (Rain + Water) is the most dangerous scenario (weight 60)
        totalRisk = (activeFloodRisk * 60);
        
        // Runoff (Rain + Soil) adds moderate risk (weight 35)
        totalRisk += (runoffRisk * 35);
        
        // ⭐ MODIFICATION: Reduced Surge (Pressure + Water) weight significantly (weight 5)
        totalRisk += (surgeRisk * 5); 
        
        // Base risk if Water is critical on its own (failsafe)
        // Weight increased slightly to compensate for overall loss of pressure's influence
        totalRisk += (waterCritical * 50);
    }

    // Clamp to 0-100
    let finalRisk = Math.min(100, totalRisk);
    
    // --- STATUS TEXT (Unchanged) ---
    let status = "SAFE";
    let message = "Conditions stable.";

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
        status = "SAFE";
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
            runoff_factor: (runoffRisk * 100).toFixed(0),
            surge_factor: (surgeRisk * 100).toFixed(0),
            flood_factor: (activeFloodRisk * 100).toFixed(0)
        }
    };
};