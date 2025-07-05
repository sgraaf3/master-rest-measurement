const elements = {
    connectButton: document.getElementById('connectBluetooth'),
    stopButton: document.getElementById('stopAndSave'),
    hrDisplay: document.getElementById('currentHR'),
    sdnnDisplay: document.getElementById('sdnnValue'),
    rmssdDisplay: document.getElementById('rmssdValue'),
    recoveryDisplay: document.getElementById('recoveryScore'),
    conditioningDisplay: document.getElementById('conditioningScore'),
    strainDisplay: document.getElementById('strainScore'),
    recoveryTimeDisplay: document.getElementById('recoveryTime'),
    statusMessage: document.getElementById('statusMessage'),
    dataList: document.getElementById('hrDataList'),
    baselineRmssdInput: document.getElementById('baselineRmssd'),
    hrRestInput: document.getElementById('hrRest'),
    hrMaxInput: document.getElementById('hrMax'),
    historyList: document.getElementById('historyList'),
    clearHistoryButton: document.getElementById('clearHistory'),
    historyContainer: document.getElementById('historyContainer'),
    chartCanvas: document.getElementById('hrvChart'),
};

export const getElements = () => elements;

export function getUserInputs() {
    return {
        baselineRmssd: parseFloat(elements.baselineRmssdInput.value) || 35,
        hrRest: parseInt(elements.hrRestInput.value, 10) || 55,
        hrMax: parseInt(elements.hrMaxInput.value, 10) || 195,
    };
}

export function updateStatus(message) {
    elements.statusMessage.textContent = message;
}

export function updateMetrics({ hr, sdnn, rmssd, recovery, conditioning, strain, recoveryTime }) {
    if (hr !== undefined) elements.hrDisplay.textContent = hr;
    if (sdnn !== undefined) elements.sdnnDisplay.textContent = isNaN(sdnn) ? '--' : sdnn.toFixed(2);
    if (rmssd !== undefined) elements.rmssdDisplay.textContent = isNaN(rmssd) ? '--' : rmssd.toFixed(2);
    if (recovery !== undefined) elements.recoveryDisplay.textContent = isNaN(recovery) ? '--' : recovery.toFixed(0);
    if (strain !== undefined) elements.strainDisplay.textContent = isNaN(strain) ? '--' : strain.toFixed(0);
    if (conditioning !== undefined) elements.conditioningDisplay.textContent = isNaN(conditioning) ? '--' : conditioning.toFixed(0);
    if (recoveryTime !== undefined) elements.recoveryTimeDisplay.textContent = isNaN(recoveryTime) ? '--' : recoveryTime.toFixed(1);
}

export function updateLog(timestamp, hr, rrIntervals) {
    const listItem = document.createElement('li');
    const rrText = rrIntervals.map(r => r.toFixed(2)).join(', ');
    listItem.textContent = `${timestamp.toLocaleTimeString()} - HR: ${hr} bpm, RR: [${rrText}] ms`;
    elements.dataList.prepend(listItem);
}

export function resetUI() {
    updateMetrics({ hr: '--', sdnn: '--', rmssd: '--', recovery: '--', conditioning: '--', strain: '--', recoveryTime: '--' });
    elements.dataList.innerHTML = '';
    clearChart();
}

export function renderHistory(history) {
    if (!history || history.length === 0) {
        elements.historyContainer.style.display = 'none';
        return;
    }
    elements.historyContainer.style.display = 'block';
    elements.historyList.innerHTML = '';
    history.forEach(session => {
        const li = document.createElement('li');
        const sessionDate = new Date(session.timestamp).toLocaleString();
        li.innerHTML = `
            <strong>${sessionDate}</strong><br>
            <small>
                Duration: ${session.durationMinutes.toFixed(1)} min | 
                Recovery: ${session.recoveryScore} | 
                Conditioning: ${session.conditioningScore} | 
                Strain: ${session.strainScore} | 
                RMSSD: ${session.finalHrv.rmssd.toFixed(2)} ms | 
                SDNN: ${session.finalHrv.sdnn.toFixed(2)} ms
            </small>`;
        elements.historyList.appendChild(li);
    });
}

// Charting variables
let hrvChartInstance = null;
const MAX_CHART_DATA_POINTS = 120; // Keep 2 minutes of data at 1-second intervals

export function initChart() {
    if (hrvChartInstance) {
        hrvChartInstance.destroy();
    }
    const ctx = elements.chartCanvas.getContext('2d');
    hrvChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Heart Rate (bpm)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'y-hr',
                    tension: 0.1,
                    pointRadius: 0,
                },
                {
                    label: 'RMSSD (ms)',
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    yAxisID: 'y-hr',
                    tension: 0.1,
                    pointRadius: 0,
                },
                {
                    label: 'SDNN (ms)',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    yAxisID: 'y-hr',
                    tension: 0.1,
                    pointRadius: 0,
                },
                {
                    label: 'Recovery Score',
                    data: [],
                    borderColor: 'rgb(255, 205, 86)',
                    backgroundColor: 'rgba(255, 205, 86, 0.2)',
                    yAxisID: 'y-hr',
                    tension: 0.1,
                    pointRadius: 0,
                },
                {
                    label: 'Conditioning Score',
                    data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    yAxisID: 'y-hr',
                    tension: 0.1,
                    pointRadius: 0,
                },
                {
                    label: 'Strain Score',
                    data: [],
                    borderColor: 'rgb(201, 203, 207)',
                    backgroundColor: 'rgba(201, 203, 207, 0.2)',
                    yAxisID: 'y-hr',
                    tension: 0.1,
                    pointRadius: 0,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'second' },
                    title: { display: true, text: 'Time' }
                },
                'y-hr': { type: 'linear', position: 'left', title: { display: true, text: 'data' } },
            }
        }
    });
}

export function updateChart(timestamp, { hr, sdnn, rmssd, recovery, conditioning, strain }) {
    if (!hrvChartInstance) return;
    const { data } = hrvChartInstance;
    data.datasets[0].data.push({ x: timestamp, y: hr });
    data.datasets[1].data.push({ x: timestamp, y: rmssd });
    data.datasets[2].data.push({ x: timestamp, y: sdnn });
    data.datasets[3].data.push({ x: timestamp, y: recovery });
    data.datasets[4].data.push({ x: timestamp, y: conditioning });
    data.datasets[5].data.push({ x: timestamp, y: strain });

    // Remove old data if exceeding max points
    if (data.datasets[0].data.length > MAX_CHART_DATA_POINTS) {
        data.datasets.forEach(dataset => dataset.data.shift());
    }
    hrvChartInstance.update('none');
}

export function clearChart() {
    if (hrvChartInstance) {
        hrvChartInstance.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        hrvChartInstance.update();
    }
}

export function setUIState(state, message = '') {
    elements.connectButton.disabled = state !== 'disconnected';
    elements.stopButton.disabled = state !== 'connected';

    switch (state) {
        case 'connecting':
            updateStatus('Searching for devices...');
            break;
        case 'connected':
            updateStatus('Connected');
            break;
        case 'disconnected':
            updateStatus(message || 'Disconnected');
            break;
        case 'error':
            updateStatus(message || 'Error');
            break;
    }
}