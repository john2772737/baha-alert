// hooks/useDashboardInit.js
import { useRef, useCallback, useEffect } from 'react';

export const useDashboardInit = (liveData, historyData, mode, rainPercent, soilPercent, waterPercent) => {
    const rainGaugeRef = useRef(null);
    const pressureGaugeRef = useRef(null);
    const soilGaugeRef = useRef(null);
    const waterTankGaugeRef = useRef(null);
    const historyChartRef = useRef(null);
    const isDashboardInitializedRef = useRef(false);
    const gaugeInstances = useRef({});

    const initializeDashboard = useCallback(() => {
        // Guard checks for external libraries and current mode
        if (mode !== 'Auto' || liveData.deviceMode !== 'AUTO' || typeof window.Gauge === 'undefined' || typeof window.Chart === 'undefined') return;
        if (!rainGaugeRef.current || !pressureGaugeRef.current || !soilGaugeRef.current || !waterTankGaugeRef.current || !historyChartRef.current) return;

        // Cleanup previous chart instance
        if (gaugeInstances.current.chart) {
             gaugeInstances.current.chart.destroy();
             gaugeInstances.current.chart = null;
        }

        const Gauge = window.Gauge;
        const Chart = window.Chart;
        const baseOptions = { angle: 0.15, lineWidth: 0.25, pointer: { color: '#f3f4f6' }, staticLabels: { color: '#9ca3af' }, limitMax: true, limitMin: true, strokeColor: '#374151', generateGradient: true };

        const initGauge = (ref, max, min, initialVal, labels, zones) => {
            if (ref.current) {
                const options = { ...baseOptions, staticLabels: { ...baseOptions.staticLabels, labels: labels }, staticZones: zones };
                const gauge = new Gauge(ref.current).setOptions(options);
                gauge.maxValue = max;
                gauge.setMinValue(min);
                gauge.set(initialVal);
                return gauge;
            }
        };

        // 1. Rain Gauge
        gaugeInstances.current.rain = initGauge(rainGaugeRef, 100, 0, rainPercent, [0, 25, 50, 75, 100], [{strokeStyle: "#10b981", min: 0, max: 20}, {strokeStyle: "#f59e0b", min: 20, max: 60}, {strokeStyle: "#ef4444", min: 60, max: 100}]);
        // 2. Pressure Gauge
        gaugeInstances.current.pressure = initGauge(pressureGaugeRef, 1050, 950, liveData.pressure, [950, 975, 1000, 1025, 1050], [{strokeStyle: "#f59e0b", min: 950, max: 980}, {strokeStyle: "#10b981", min: 980, max: 1040}, {strokeStyle: "#f59e0b", min: 1040, max: 1050}]);
        // 3. Water Tank Gauge
        gaugeInstances.current.waterTank = initGauge(waterTankGaugeRef, 100, 0, waterPercent, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 20}, {strokeStyle: "#f59e0b", min: 20, max: 50}, {strokeStyle: "#10b981", min: 50, max: 90}, {strokeStyle: "#ef4444", min: 90, max: 100}]);
        // 4. Soil Moisture Gauge
        gaugeInstances.current.soil = initGauge(soilGaugeRef, 100, 0, soilPercent, [0, 25, 50, 75, 100], [{strokeStyle: "#ef4444", min: 0, max: 30}, {strokeStyle: "#10b981", min: 30, max: 70}, {strokeStyle: "#f59e0b", min: 70, max: 100}]);

        // Chart Init
        const labels = historyData.length > 0 ? historyData.map(d => d.day) : ['No Data'];
        const datasets = [
            { label: 'Rain Wetness (%)', data: historyData.map(d => d.rain), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, yAxisID: 'yPercent', tension: 0.4, pointRadius: 6, pointHoverRadius: 8 }, 
            { label: 'Soil Moisture (%)', data: historyData.map(d => d.soil), borderColor: '#84cc16', fill: false, yAxisID: 'yPercent', tension: 0.4, pointRadius: 6, pointHoverRadius: 8 }, 
            { label: 'Water Level (%)', data: historyData.map(d => d.water), borderColor: '#06b6d4', fill: false, yAxisID: 'yPercent', tension: 0.4, pointRadius: 6, pointHoverRadius: 8 }, 
            { label: 'Pressure (hPa)', data: historyData.map(d => d.pressure), borderColor: '#a855f7', fill: false, yAxisID: 'yPressure', tension: 0.4, pointRadius: 6, pointHoverRadius: 8 }
        ];
        
        gaugeInstances.current.chart = new Chart(historyChartRef.current.getContext('2d'), {
            type: 'line', data: { labels, datasets },
            options: { 
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, 
                scales: { 
                    x: { grid: { color: '#374151' }, ticks: { color: '#e2e8f0' } }, 
                    yPercent: { type: 'linear', position: 'left', min: 0, max: 100, ticks: { callback: v => v + '%', color: '#e2e8f0' } }, 
                    yPressure: { type: 'linear', position: 'right', min: 950, max: 1050, grid: { display: false }, ticks: { callback: v => v + ' hPa', color: '#e2e8f0' } } 
                }, 
                plugins: { legend: { labels: { color: '#e2e8f0' } }, tooltip: { backgroundColor: 'rgba(17, 24, 39, 0.95)', titleColor: '#10b981', bodyColor: '#f3f4f6', borderColor: '#374151', borderWidth: 1 } } 
            }
        });
        isDashboardInitializedRef.current = true;
    }, [liveData.pressure, liveData.deviceMode, rainPercent, soilPercent, waterPercent, historyData, mode]);

    // Live Update Logic (Gauges) & Dashboard Initialization Trigger
    useEffect(() => {
        const isActive = mode === 'Auto' && liveData.deviceMode === 'AUTO' && typeof window.Gauge !== 'undefined' && typeof window.Chart !== 'undefined';
        if (!isActive) {
            if (isDashboardInitializedRef.current) {
                try { if (gaugeInstances.current.chart) gaugeInstances.current.chart.destroy(); } catch(e) {}
                gaugeInstances.current = {};
                isDashboardInitializedRef.current = false;
            }
            return;
        }
        if (!isDashboardInitializedRef.current) initializeDashboard();

        requestAnimationFrame(() => {
            try {
                if (gaugeInstances.current.rain) gaugeInstances.current.rain.set(rainPercent);
                if (gaugeInstances.current.pressure && liveData.pressure > 800) gaugeInstances.current.pressure.set(liveData.pressure);
                if (gaugeInstances.current.waterTank) gaugeInstances.current.waterTank.set(waterPercent);
                if (gaugeInstances.current.soil) gaugeInstances.current.soil.set(soilPercent);
            } catch (e) {
                isDashboardInitializedRef.current = false;
            }
        });
    }, [mode, rainPercent, soilPercent, waterPercent, liveData.pressure, liveData.deviceMode, initializeDashboard]);

    // CHART Update Logic (History)
    useEffect(() => {
        if (liveData.deviceMode === 'AUTO' && isDashboardInitializedRef.current && gaugeInstances.current.chart && historyData.length > 0) {
            const chart = gaugeInstances.current.chart;
            chart.data.labels = historyData.map(d => d.day);
            chart.data.datasets[0].data = historyData.map(d => d.rain);
            chart.data.datasets[1].data = historyData.map(d => d.soil);
            if(chart.data.datasets[2]) chart.data.datasets[2].data = historyData.map(d => d.water);
            if(chart.data.datasets[3]) chart.data.datasets[3].data = historyData.map(d => d.pressure);
            chart.update();
        }
    }, [historyData, liveData.deviceMode]);

    return { rainGaugeRef, pressureGaugeRef, soilGaugeRef, waterTankGaugeRef, historyChartRef };
};