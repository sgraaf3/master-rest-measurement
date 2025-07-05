let chartInstances = {};

// Helper to create a shell object for an empty report
function createEmptyDataObject() {
    return {
        rrIntervals: [],
        n: 0,
        meanRR: NaN,
        avgHR: NaN,
        sdnn: NaN,
        rmssd: NaN,
        nn50: 0,
        pnn50: NaN,
        rrHistogram: { labels: [], counts: [], maxCount: 0 },
        hrvTriangularIndex: NaN,
        tinn: NaN,
        baevskyStressIndex: NaN,
        sd1: NaN,
        sd2: NaN,
        sd2_sd1_ratio: NaN,
        frequency: {
            'VLF Power (ms²)': NaN,
            'LF
 
document.addEventListener('DOMContentLoaded', () => {
    // 1. Retrieve the analysis data from sessionStorage
    const reportDataJSON = sessionStorage.getItem('hrvReportData');

    if (reportDataJSON) {
        try {
            const reportData = JSON.parse(reportDataJSON);
            const processedData = reportData.analysisResults;
            const userProfile = { name: reportData.clientName };

            // 2. Render the entire report with the retrieved data
            renderFullReport(processedData, userProfile);
 
        } catch (error) {
            console.error("Failed to parse report data from sessionStorage:", error);
            document.body.innerHTML = `<div class="container"><p class="alert-message">Fout: Kon rapportgegevens niet laden. Ga terug en probeer het opnieuw.</p></div>`;
        }
    } else {
        console.warn("No hrvReportData found in sessionStorage.");
        document.body.innerHTML = `<div class="container"><p class="alert-message">Geen rapportgegevens gevonden. Genereer eerst een analyse.</p></div>`;
    }
});

/**
 * Main function to orchestrate the rendering of the entire report.
 * @param {object} processedData - The fully processed HRV data object.
 * @param {object} userProfile - The user's profile data.
 */
function renderFullReport(processedData, userProfile) {
    populateHeaderAndSummary(processedData, userProfile);
    renderAllCharts(processedData);
    // renderAnalysisDetails(processedData); // And this
}

/**
 * Populates the header and summary metric widgets with data.
 * @param {object} processedData - The fully processed HRV data object.
 * @param {object} userProfile - The user's profile data.
 */
function populateHeaderAndSummary(processedData, userProfile) {
    // Populate client info in the header
    const clientNameEl = document.getElementById('client-name');
    if (clientNameEl) {
        clientNameEl.textContent = userProfile.name || '[Cliëntnaam]';
    }

    const reportDateEl = document.getElementById('report-date');
    if (reportDateEl) {
        reportDateEl.textContent = new Date().toLocaleDateString('nl-NL', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Populate the summary grid metrics
    // The data structure from HRVAnalyzer is flat, not nested under summaryMetrics
    if (processedData) {
        const conditioningScoreEl = document.getElementById('conditioning-score');
        if (conditioningScoreEl) {
            conditioningScoreEl.textContent = processedData.conditioning?.toFixed(1) ?? '--';
        }

        const recoveryScoreEl = document.getElementById('recovery-score');
        if (recoveryScoreEl) {
            recoveryScoreEl.textContent = processedData.recovery?.toFixed(1) ?? '--';
        }

        const energyScoreEl = document.getElementById('energy-score');
        if (energyScoreEl) {
            energyScoreEl.textContent = processedData.energy?.toFixed(1) ?? '--';
        }

        const hrvStateEl = document.getElementById('hrv-state');
        if (hrvStateEl) {
            hrvStateEl.textContent = processedData.state || '--';
        }
    }
}

/**
 * Destroys a chart instance if it exists to prevent memory leaks.
 * @param {string} chartId The ID of the canvas element.
 */
function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

/**
 * Renders all charts on the report page.
 * @param {object} processedData The fully processed HRV data object.
 */
function renderAllCharts(processedData) {
    renderRRChart(processedData);
    renderPoincareChart(processedData);
    renderHrvMetricsChart(processedData);
    renderHistogramChart(processedData);
    renderFrequencyChart(processedData);
    renderBreathingChart(processedData);
}

/**
 * Renders the RR Intervals and Heart Rate chart.
 * @param {object} processedData The fully processed HRV data object.
 */
function renderRRChart(processedData) {
    const chartId = 'rr-chart';
    destroyChart(chartId);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const rrIntervals = processedData.rrIntervals || [];
    const heartRateData = rrIntervals.map(rr => (rr > 0 ? 60000 / rr : null));
    const labels = rrIntervals.map((_, i) => i + 1);

    chartInstances[chartId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'RR-interval (ms)',
                data: rrIntervals,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                yAxisID: 'y-rr',
                tension: 0.1,
                pointRadius: 1,
                fill: true,
            }, {
                label: 'Hartslag (bpm)',
                data: heartRateData,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                yAxisID: 'y-hr',
                tension: 0.1,
                pointRadius: 1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Hartslag Index' } },
                'y-rr': {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'RR-interval (ms)' },
                    grid: { drawOnChartArea: true },
                },
                'y-hr': {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Hartslag (bpm)' },
                    grid: { drawOnChartArea: false },
                }
            },
            plugins: { tooltip: { mode: 'index', intersect: false } }
        }
    });
}

/**
 * Renders the HRV Metrics bar chart.
 * @param {object} processedData The fully processed HRV data object.
 */
function renderHrvMetricsChart(processedData) {
    const chartId = 'hrv-metrics-chart';
    destroyChart(chartId);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const labels = ['RMSSD (ms)', 'SDNN (ms)'];
    const data = [processedData.rmssd, processedData.sdnn];

    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Waarde',
                data: data,
                backgroundColor: ['#2980b9', '#8e44ad'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'ms' } }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Kern Tijdsdomein Metrieken' }
            }
        }
    });
}

/**
 * Renders the RR Interval Histogram chart.
 * @param {object} processedData The fully processed HRV data object.
 */
function renderHistogramChart(processedData) {
    const chartId = 'histogram-chart';
    destroyChart(chartId);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const histogramData = processedData.rrHistogram || { labels: [], counts: [] };

    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: histogramData.labels,
            datasets: [{
                label: 'Aantal Intervallen',
                data: histogramData.counts,
                backgroundColor: 'rgba(26, 188, 156, 0.7)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Aantal' } },
                x: { title: { display: true, text: 'RR-interval Bins (ms)' } }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'RR-interval Distributie' }
            }
        }
    });
}

/**
 * Renders the Frequency Domain bar chart.
 * @param {object} processedData The fully processed HRV data object.
 */
function renderFrequencyChart(processedData) {
    const chartId = 'frequency-chart';
    destroyChart(chartId);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const freqData = processedData.frequency || {};
    const labels = ['VLF', 'LF', 'HF'];
    const data = [
        freqData['VLF Power (ms²)'],
        freqData['LF Power (ms²)'],
        freqData['HF Power (ms²)']
    ];

    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vermogen (ms²)',
                data: data,
                backgroundColor: ['#34495e', '#f1c40f', '#1abc9c'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'logarithmic', beginAtZero: true, title: { display: true, text: 'Vermogen (ms²)' } }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Frequentiedomein Vermogen (Illustratief)' }
            }
        }
    });
}

/**
 * Renders the Breathing Wave chart.
 * @param {object} processedData The fully processed HRV data object.
 */
function renderBreathingChart(processedData) {
    const chartId = 'breathing-chart';
    destroyChart(chartId);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const breathingData = processedData.breathingWave || [];
    const labels = breathingData.map((_, i) => i + 1);

    chartInstances[chartId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ademhalingsgolf (gesimuleerd)',
                data: breathingData,
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { title: { display: true, text: 'Relatieve Amplitude' } },
                x: { title: { display: true, text: 'Tijd (index)' } }
            },
            plugins: {
                title: { display: true, text: 'Gesimuleerde Ademhalingsgolf' }
            }
        }
    });
}

/**
 * Renders the Poincaré Plot chart.
 * @param {object} processedData The fully processed HRV data object.
 */
function renderPoincareChart(processedData) {
    const chartId = 'poincare-chart';
    destroyChart(chartId);

    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const rrIntervals = processedData.rrIntervals || [];
    const poincareData = rrIntervals.slice(0, -1).map((rr, i) => ({ x: rr, y: rrIntervals[i + 1] }));

    chartInstances[chartId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'RRn vs RRn+1',
                data: poincareData,
                backgroundColor: 'rgba(41, 128, 185, 0.7)',
                pointRadius: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', position: 'bottom', title: { display: true, text: 'RRn (ms)' } },
                y: { title: { display: true, text: 'RRn+1 (ms)' } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `(RRn: ${context.raw.x.toFixed(1)} ms, RRn+1: ${context.raw.y.toFixed(1)} ms)`
                    }
                }
            }
        }
    });
}
