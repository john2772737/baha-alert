// hooks/useSensorData.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initialSensorData, STATE_MAPPINGS } from '../utils/sensorUtils';

const REAL_API_ENDPOINT = 'https://baha-alert.vercel.app/api'; 
const FETCH_INTERVAL_MS = 1000;

export const useSensorData = (isClient, mode) => {
    const [liveData, setLiveData] = useState(initialSensorData);
    const [historyData, setHistoryData] = useState([]);
    const [fetchError, setFetchError] = useState(null);
    const lastIdRef = useRef(null);

    const fetchSensorData = useCallback(async () => {
        if (!isClient) return;
        try {
            const response = await fetch(REAL_API_ENDPOINT);
            if (!response.ok) throw new Error("HTTP error");
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.payload) throw new Error("Invalid structure");
            const payload = result.data.payload;
            const newId = result.data._id;

            if (lastIdRef.current !== newId || liveData.deviceMode !== payload.mode) lastIdRef.current = newId;

            setLiveData(prev => ({
                pressure: parseFloat(payload.pressure) || prev.pressure,
                rainRaw: parseInt(payload.rain, 10) || prev.rainRaw,
                soilRaw: parseInt(payload.soil, 10) || prev.soilRaw,
                waterDistanceCM: parseFloat(payload.waterDistanceCM) || prev.waterDistanceCM,
                deviceMode: payload.mode || prev.deviceMode
            }));
            setFetchError(null);
        } catch (error) {
            setFetchError(`Connection Error`);
        }
    }, [isClient, liveData.deviceMode]);

    const fetchHistoryData = useCallback(async () => {
        if (mode !== 'Auto' || !isClient) return;
        try {
            const response = await fetch(`${REAL_API_ENDPOINT}?history=true`);
            if (!response.ok) throw new Error("History fetch failed");
            const result = await response.json();
            
            if (result.success && Array.isArray(result.data)) {
                const processed = result.data.map(item => ({
                    day: new Date(item._id).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
                    rain: STATE_MAPPINGS.rain(item.avgRain),
                    soil: STATE_MAPPINGS.soil(item.avgSoil),
                    water: STATE_MAPPINGS.waterTank(item.avgWaterDistance),
                    pressure: item.avgPressure
                }));
                setHistoryData(processed);
            }
        } catch (e) {
            console.error("History Error:", e);
        }
    }, [isClient, mode]);

    // Live Data Loop
    useEffect(() => {
        fetchSensorData();
        const interval = setInterval(fetchSensorData, FETCH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchSensorData]);

    // Initial History Fetch
    useEffect(() => {
        fetchHistoryData();
    }, [fetchHistoryData]);

    // Calculated Percentages
    const rainPercent = useMemo(() => STATE_MAPPINGS.rain(liveData.rainRaw), [liveData.rainRaw]);
    const soilPercent = useMemo(() => STATE_MAPPINGS.soil(liveData.soilRaw), [liveData.soilRaw]);
    const waterPercent = useMemo(() => STATE_MAPPINGS.waterTank(liveData.waterDistanceCM), [liveData.waterDistanceCM]);

    return { liveData, historyData, fetchError, rainPercent, soilPercent, waterPercent };
};