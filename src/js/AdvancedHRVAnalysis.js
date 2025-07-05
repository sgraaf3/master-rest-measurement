
// Add at the top of your <script type="module">
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const rrfile = params.get('rrfile');
    if (rrfile) {
        fetch(rrfile)
            .then(res => res.text())
            .then(text => {
                // Simulate file upload
                const rrIntervalsRaw = text.split('\n').map(s => s.trim()).filter(s => s !== '');
                const rrIntervals = rrIntervalsRaw.map(Number).filter(n => !isNaN(n) && n > 0);
                try {
                    const hrvAnalyzer = new HRVAnalyzer(rrIntervals);
                    displayAnalysisResults(hrvAnalyzer);
                } catch (error) {
                    displayError(error.message);
                    document.getElementById('analysisResults').innerHTML = '';
                }
            });
    }
});

// Helper function to display error messages
function displayError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}

// Helper function to clear error messages
function clearError() {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.textContent = '';
    errorContainer.classList.add('hidden');
}

// --- HRV Analyzer Class ---
class HRVAnalyzer {
    constructor(rrIntervals) {
        // Filter out non-numeric or non-positive values from the start
        this.rrIntervals = rrIntervals.filter(n => typeof n === 'number' && !isNaN(n) && n > 0);
        this.n = this.rrIntervals.length;

        if (this.n < 2) {
            throw new Error("Not enough valid RR interval data for analysis (minimum 2 intervals required).");
        }

        this.meanRR = this.calculateMeanRR();
        this.avgHR = this.calculateAvgHR();
        this.sdnn = this.calculateSDNN();
        this.rmssd = this.calculateRMSSD();
        this.nn50 = this.calculateNN50();
        this.pnn50 = this.calculatePNN50();

        // Geometric Measures
        this.rrHistogram = this.calculateRRHistogram(30); // Use 30 bins as per example
        this.hrvTriangularIndex = this.calculateHRVTriangularIndex(); // Uses 1/128s sbin
        this.tinn = this.calculateTINN(); // Simplified/Illustrative
        this.baevskyStressIndex = this.calculateBaevskyStressIndex(); // Simplified

        // Poincaré Plot
        this.sd1 = this.calculateSD1();
        this.sd2 = this.calculateSD2();
        this.sd2_sd1_ratio = this.calculateSD2SD1Ratio();

        // Frequency Domain (Illustrative)
        this.frequency = this.calculateIllustrativeFrequencyDomain();

        // Derived Wellness Scores
        this.conditioning = this.calculateConditioning();
        this.recovery = this.calculateRecovery();
        this.strain = this.calculateStrain();
        this.energy = this.calculateEnergy();
        this.state = this.calculateState();

        // Breathing Wave Data
        this.breathingWave = this.calculateBreathingWave();


        // Advanced/Nonlinear (Placeholders/Complex - these require dedicated libraries for accurate scientific calculation)
        this.dc = 'Complex/Not Implemented';
        this.ac = 'Complex/Not Implemented';
        this.dcMod = 'Complex/Not Implemented';
        this.acMod = 'Complex/Not Implemented';
        this.apEn = 'Complex/Not Implemented';
        this.sampEn = 'Complex/Not Implemented';
        this.dfaAlpha1 = 'Complex/Not Implemented';
        this.dfaAlpha2 = 'Complex/Not Implemented';
        this.d2 = 'Complex/Not Implemented';
        this.rec = 'Complex/Not Implemented';
        this.lMean = 'Complex/Not Implemented';
        this.lMax = 'Complex/Not Implemented';
        this.det = 'Complex/Not Implemented';
        this.shanEn = 'Complex/Not Implemented';
        this.mse = 'Complex/Not Implemented';
    }

    calculateMeanRR() {
        if (this.n === 0) return NaN;
        const sum = this.rrIntervals.reduce((acc, val) => acc + val, 0);
        return sum / this.n;
    }

    calculateAvgHR() {
        if (isNaN(this.meanRR) || this.meanRR === 0) return NaN;
        return 60000 / this.meanRR; // bpm
    }

    calculateSDNN() {
        if (this.n < 2) return NaN;
        const mean = this.meanRR;
        const variance = this.rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (this.n - 1);
        return Math.sqrt(variance);
    }

    calculateRMSSD() {
        if (this.n < 2) return NaN;
        let sumSqDiff = 0;
        for (let i = 0; i < this.n - 1; i++) {
            sumSqDiff += Math.pow(this.rrIntervals[i + 1] - this.rrIntervals[i], 2);
        }
        return Math.sqrt(sumSqDiff / (this.n - 1));
    }

    calculateNN50() {
        if (this.n < 2) return 0;
        let count = 0;
        for (let i = 0; i < this.n - 1; i++) {
            if (Math.abs(this.rrIntervals[i + 1] - this.rrIntervals[i]) > 50) {
                count++;
            }
        }
        return count;
    }

    calculatePNN50() {
        if (this.n < 2) return NaN;
        return (this.nn50 / (this.n - 1)) * 100;
    }

    // --- Geometric Measures ---
    calculateRRHistogram(numBins = 30) {
        if (this.n === 0) return { labels: [], counts: [], maxCount: 0 };

        const minRR = Math.min(...this.rrIntervals);
        const maxRR = Math.max(...this.rrIntervals);
        // Ensure binWidth is not zero if minRR === maxRR (i.e., all intervals are same)
        const binWidth = (maxRR - minRR) / numBins > 0 ? (maxRR - minRR) / numBins : 1; // Default to 1ms if range is zero

        const counts = Array(numBins).fill(0);

        this.rrIntervals.forEach(val => {
            let binIndex = Math.floor((val - minRR) / binWidth);
            if (binIndex >= numBins) binIndex = numBins - 1; // Ensure last bin for max value
            if (binIndex < 0) binIndex = 0; // Ensure first bin for min value
            counts[binIndex]++;
        });

        const labels = [];
        for (let i = 0; i < numBins; i++) {
            // Adjust labels to show ranges
            const start = minRR + i * binWidth;
            const end = minRR + (i + 1) * binWidth;
            labels.push(`${start.toFixed(0)}-${end.toFixed(0)}ms`);
        }

        const maxCount = Math.max(...counts);
        return { labels, counts, maxCount };
    }


    calculateHRVTriangularIndex() {
        if (this.n < 2) return NaN;
        const binWidth = 1000 / 128; // 1/128 seconds in ms (approx 7.8125 ms)
        const histogram = {};
        let maxCount = 0;

        this.rrIntervals.forEach(rr => {
            const binKey = Math.floor(rr / binWidth);
            histogram[binKey] = (histogram[binKey] || 0) + 1;
            if (histogram[binKey] > maxCount) {
                maxCount = histogram[binKey];
            }
        });

        if (maxCount === 0) return NaN;
        return parseFloat((this.n / maxCount).toFixed(2));
    }

    calculateTINN() {
        // TINN is complex, requiring triangular interpolation. This is a simplified estimation.
        if (isNaN(this.sdnn)) return NaN;
        return parseFloat((this.sdnn * 3).toFixed(1)); // Simple heuristic for illustration
    }

    calculateBaevskyStressIndex() {
        if (this.n < 2) return NaN;

        // Mo: Mode (most frequent RR interval), approximated by median for simplicity
        const sortedRR = [...this.rrIntervals].sort((a, b) => a - b);
        const mid = Math.floor(sortedRR.length / 2);
        const Mo = sortedRR.length % 2 === 0 ? (sortedRR[mid - 1] + sortedRR[mid]) / 2 : sortedRR[mid];

        // MxDMn: Variation scope (difference between longest and shortest RR interval values)
        const MxDMn = Math.max(...this.rrIntervals) - Math.min(...this.rrIntervals);

        // AMo: Mode amplitude (height of normalized RR interval histogram with 50msec bin width)
        const binWidth = 50; // 50 msec
        const { counts } = this.calculateRRHistogram(binWidth); // Use the histogram function
        let maxBinCount = 0;
        if (counts.length > 0) {
            maxBinCount = Math.max(...counts);
        }
        const AMo = (maxBinCount / this.n) * 100; // Normalized to percent

        // Stress Index calculation. Note: Does NOT include "smoothness priors method" for trend removal.
        let si = 0;
        if (MxDMn > 0) { // Avoid division by zero
            si = (AMo * Mo) / MxDMn;
        }
        return parseFloat(Math.sqrt(Math.max(0, si)).toFixed(2));
    }


    // --- Poincaré Plot Measures ---
    calculateSD1() {
        if (isNaN(this.rmssd)) return NaN;
        // SD1 = RMSSD / sqrt(2)
        return parseFloat((this.rmssd / Math.sqrt(2)).toFixed(2));
    }

    calculateSD2() {
        if (isNaN(this.sdnn) || isNaN(this.rmssd)) return NaN;
        // SD2 = sqrt(2 * SDNN^2 - SDSD^2) where SDSD is ~RMSSD
        // SD2 = sqrt(2 * SDNN^2 - RMSSD^2)
        const sdnnSq = Math.pow(this.sdnn, 2);
        const rmssdSq = Math.pow(this.rmssd, 2);
        const val = 2 * sdnnSq - rmssdSq;
        return parseFloat(Math.sqrt(Math.max(0, val)).toFixed(2)); // Ensure non-negative under sqrt
    }

    calculateSD2SD1Ratio() {
        if (isNaN(this.sd1) || this.sd1 === 0) return NaN;
        return parseFloat((this.sd2 / this.sd1).toFixed(2));
    }

    // --- Frequency Domain (Illustrative) ---
    calculateIllustrativeFrequencyDomain() {
        // These are illustrative values and do not come from a true FFT calculation.
        // A proper frequency domain analysis requires robust signal processing libraries.
        if (isNaN(this.rmssd) || isNaN(this.sdnn) || this.sdnn === 0) {
            return {
                'VLF Power (ms²)': 0,
                'LF Power (ms²)': 0,
                'HF Power (ms²)': 0,
                'LF/HF Ratio': 0,
                'Peak Frequency (VLF)': 0,
                'Peak Frequency (LF)': 0,
                'Peak Frequency (HF)': 0,
                'Relative Power (VLF)': 0,
                'Relative Power (LF)': 0,
                'Relative Power (HF)': 0,
                'Normalized Power (LF)': 0,
                'Normalized Power (HF)': 0,
                'freqs': [0.01, 0.08, 0.25], // Illustrative frequencies for PSD plot
                'psd': [0, 0, 0] // Illustrative power for PSD plot
            };
        }

        // Simple heuristics relating time-domain to "illustrative" frequency powers
        const hf = Math.max(0, parseFloat((this.rmssd * this.rmssd * 0.8).toFixed(2))); // Strong RMSSD link
        const lf = Math.max(0, parseFloat((this.sdnn * this.sdnn * 0.1 - hf * 0.1).toFixed(2))); // SDNN influence, inversely with HF
        const vlf = Math.max(0, parseFloat((this.sdnn * this.sdnn * 0.05).toFixed(2))); // Longer term

        const totalPower = vlf + lf + hf;
        const lf_hf_ratio = (hf > 0) ? parseFloat((lf / hf).toFixed(2)) : 0;

        const relativeVLF = totalPower > 0 ? parseFloat(((vlf / totalPower) * 100).toFixed(1)) : 0;
        const relativeLF = totalPower > 0 ? parseFloat(((lf / totalPower) * 100).toFixed(1)) : 0;
        const relativeHF = totalPower > 0 ? parseFloat(((hf / totalPower) * 100).toFixed(1)) : 0;

        const nonVLFPower = lf + hf;
        const normalizedLF = nonVLFPower > 0 ? parseFloat(((lf / nonVLFPower) * 100).toFixed(1)) : 0;
        const normalizedHF = nonVLFPower > 0 ? parseFloat(((hf / nonVLFPower) * 100).toFixed(1)) : 0;

        // Illustrative peak frequencies (fixed for demonstration)
        const peakVLF = 0.02;
        const peakLF = 0.1;
        const peakHF = 0.25;

        // Data for illustrative PSD plot
        const freqs = [0.01, 0.02, 0.03, 0.04, 0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4];
        const psd = freqs.map(f => {
            if (f <= 0.04) return vlf / 4; // VLF band spread
            if (f > 0.04 && f <= 0.15) return lf / 8; // LF band spread
            if (f > 0.15 && f <= 0.4) return hf / 8; // HF band spread
            return 0;
        });
        // Add peaks to PSD for visual representation
        if (freqs.includes(peakVLF)) psd[freqs.indexOf(peakVLF)] *= 2;
        if (freqs.includes(peakLF)) psd[freqs.indexOf(peakLF)] *= 2;
        if (freqs.includes(peakHF)) psd[freqs.indexOf(peakHF)] *= 2;


        return {
            'VLF Power (ms²)': vlf,
            'LF Power (ms²)': lf,
            'HF Power (ms²)': hf,
            'LF/HF Ratio': lf_hf_ratio,
            'Peak Frequency (VLF)': peakVLF,
            'Peak Frequency (LF)': peakLF,
            'Peak Frequency (HF)': peakHF,
            'Relative Power (VLF)': relativeVLF,
            'Relative Power (LF)': relativeLF,
            'Relative Power (HF)': relativeHF,
            'Normalized Power (LF)': normalizedLF,
            'Normalized Power (HF)': normalizedHF,
            'freqs': freqs,
            'psd': psd
        };
    }

    // --- Derived Wellness Scores (using existing computed properties) ---
    calculateConditioning() {
        if (isNaN(this.rmssd) || isNaN(this.sdnn)) return NaN;
        // Example heuristic: A higher RMSSD and SDNN generally indicates better conditioning
        // Values scaled to a 0-100% range for presentation
        const base = (this.rmssd + this.sdnn) / 2;
        return parseFloat(Math.min(100, base / 2.5).toFixed(1));
    }

    calculateRecovery() {
        if (isNaN(this.rmssd)) return NaN;
        // Example heuristic: RMSSD is strongly associated with parasympathetic activity and recovery
        return parseFloat(Math.min(100, this.rmssd / 1.5).toFixed(1));
    }

    calculateStrain() { // Assuming Strain is the inverse of Recovery or related to lower HRV
        if (isNaN(this.rmssd)) return NaN;
        return parseFloat(Math.min(100, 100 - (this.rmssd / 1.5)).toFixed(1)); // Inverse of recovery
    }

    calculateEnergy() { // General overall energy level heuristic
        if (isNaN(this.sdnn) || isNaN(this.rmssd)) return NaN;
        return parseFloat(Math.min(100, (this.sdnn / 3) + (this.rmssd / 2)).toFixed(1));
    }

    calculateState() { // Simplified HRV State
        if (isNaN(this.rmssd) || isNaN(this.sdnn)) return 'No Data';
        if (this.rmssd > 50 && this.sdnn > 100) return 'Optimal';
        if (this.rmssd > 30 && this.sdnn > 50) return 'Good';
        if (this.rmssd > 15 && this.sdnn > 25) return 'Moderate';
        return 'Suboptimal';
    }

    calculateBreathingWave() {
        // Simulate breathing wave from RR intervals (inverse heart rate)
        // -60000 / RR_ms converts RR to negative bpm for an inverted wave shape
        return this.rrIntervals.map(rr => {
            if (rr === 0 || isNaN(rr)) return null; // Avoid division by zero
            return parseFloat((-(rr / 60)).toFixed(2));
        });
    }
}


// Store Chart.js instances to destroy them before redrawing
let chartInstances = {};
let currentHRVData = null; // Store the current HRV analysis results

// Function to dynamically display analysis results and charts
function displayAnalysisResults(hrvData) {
    console.log("displayAnalysisResults called with hrvData:", hrvData); // Debugging log
    currentHRVData = hrvData; // Save the analyzed data globally
    const resultsContainer = document.getElementById('analysisResults');
    resultsContainer.innerHTML = ''; // Clear previous results
    console.log("resultsContainer cleared."); // Debugging log

    // Add detailed introductory text
    const introText = document.createElement('div');
    introText.className = 'bg-blue-50 p-6 rounded-lg shadow-inner mb-8 text-gray-700';
    introText.innerHTML = `
        <h2 class="text-2xl font-bold text-blue-800 mb-4 text-center border-b-2 border-blue-200 pb-2">Wat is Hartslagvariabiliteit (HRV)?</h2>
        <p class="mb-4">Hartslagvariabiliteit (HRV) is de variatie in de tijd tussen elke hartslag. Het is een indicator van de activiteit van uw autonome zenuwstelsel (AZS), dat bestaat uit twee hoofdtakken: het sympathische (vecht- of vlucht) en het parasympathische (rust- en verteer) zenuwstelsel. Een hogere HRV duidt over het algemeen op een gezonder en veerkrachtiger AZS, wat vaak geassocieerd wordt met betere stressbeheersing, herstel en algeheel welzijn.</p>
        <p class="mb-4">De <strong>RR-intervallen</strong> zijn de tijdsintervallen tussen opeenvolgende R-toppen in een elektrocardiogram (ECG), wat in feite de tijdsduur tussen hartslagen is. Deze ruwe gegevens vormen de basis voor alle HRV-berekeningen.</p>
        
        <h3 class="text-xl font-semibold text-blue-700 mb-3">De Drie Hoofdcategorieën van HRV-Metingen:</h3>
        
        <p class="mb-2"><strong class="text-blue-600">1. Tijdsdomein Metingen:</strong> Deze metingen analyseren de variatie tussen opeenvolgende RR-intervallen direct in de tijd. Ze geven inzicht in de activiteit van het parasympathische zenuwstelsel en de algehele variabiliteit van de hartslag.</p>
        <ul class="list-disc list-inside ml-4 mb-4">
            <li><strong>SDNN (Standard Deviation of NN intervals):</strong> De standaardafwijking van alle normale RR-intervallen. Een hogere SDNN duidt op een hogere algehele HRV en wordt geassocieerd met een betere gezondheid en aanpassingsvermogen.</li>
            <li><strong>RMSSD (Root Mean Square of Successive Differences):</strong> De wortel van het gemiddelde van de som van de kwadraten van de opeenvolgende verschillen tussen RR-intervallen. Dit is een primaire indicator van parasympathische activiteit (vagale tonus) en herstelvermogen. Hogere waarden zijn gunstig.</li>
            <li><strong>NN50 / pNN50:</strong> Het aantal (NN50) en percentage (pNN50) van opeenvolgende RR-intervallen die meer dan 50 ms verschillen. Ook dit zijn indicatoren van parasympathische activiteit.</li>
        </ul>

        <p class="mb-2"><strong class="text-blue-600">2. Frequentiedomein Metingen:</strong> Deze metingen analyseren de HRV-data door middel van een frequentiespectrum, waarbij de bijdragen van verschillende frequentiecomponenten aan de totale variabiliteit worden beoordeeld. Dit geeft inzicht in de balans tussen het sympathische en parasympathische zenuwstelsel.</p>
        <ul class="list-disc list-inside ml-4 mb-4">
            <li><strong>VLF (Very Low Frequency):</strong> Zeer lage frequentie component (0.0033-0.04 Hz), gerelateerd aan langetermijnregulatie en mogelijk thermoregulatie, hormonen, etc.</li>
            <li><strong>LF (Low Frequency):</strong> Lage frequentie component (0.04-0.15 Hz), beïnvloed door zowel sympathische als parasympathische activiteit, maar wordt vaak geassocieerd met sympathische tonus.</li>
            <li><strong>HF (High Frequency):</strong> Hoge frequentie component (0.15-0.4 Hz), een pure indicator van parasympathische activiteit, direct gekoppeld aan de ademhaling. Hogere HF-waarden duiden op een sterkere parasympathische invloed.</li>
            <li><strong>LF/HF Ratio:</strong> De verhouding tussen de LF- en HF-vermogens, die een indicatie kan geven van de sympatho-vagale balans (balans tussen sympathische en parasympathische activiteit).</li>
        </ul>

        <p class="mb-2"><strong class="text-blue-600">3. Geometrische Metingen:</strong> Deze metingen vereenvoudigen de RR-intervaldata tot geometrische vormen, zoals histogrammen. Ze bieden een visueel en alternatief kwantitatief inzicht in de variabiliteit van de hartslag.</p>
        <ul class="list-disc list-inside ml-4 mb-4">
            <li><strong>HRV Driehoekige Index (HRV Triangular Index):</strong> De totale duur van het histogram van RR-intervallen gedeeld door de maximale hoogte van het histogram. Het geeft een algemene indicator van de totale hartslagvariabiliteit.</li>
            <li><strong>Poincaré Plot (SD1, SD2, SD2/SD1 Ratio):</strong> Een grafiek van elk RR-interval tegen het volgende. SD1 meet de kortetermijnvariabiliteit (parasympathisch), SD2 de langetermijnvariabiliteit (parasympathisch en sympathisch). De SD2/SD1 ratio geeft inzicht in de balans tussen beide systemen.</li>
        </ul>
        <p class="mt-4 text-sm italic text-gray-500">De hier gepresenteerde Frequentiedomein en Slaapmetingen zijn illustratief en gebaseerd op vereenvoudigde heuristieken. Voor klinisch nauwkeurige resultaten zijn gespecialiseerde medische software en apparatuur vereist.</p>
    `;
    resultsContainer.appendChild(introText);


    // Helper to create a metric div
    function createMetricDiv(label, value) {
        const div = document.createElement('div');
        div.className = 'metric';
        div.innerHTML = `<strong>${label}:</strong> <span>${value}</span>`;
        return div;
    }

    // Function to add a collapsible section
    function addCollapsibleSection(title, metricsData, containerElement) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = title;
        details.appendChild(summary);

        const grid = document.createElement('div');
        grid.className = 'metric-grid';

        for (const key in metricsData) {
            if (Object.hasOwnProperty.call(metricsData, key)) {
                let value = metricsData[key];
                // Format numbers, handle NaN, and leave strings as they are
                if (typeof value === 'number') {
                    if (isNaN(value)) {
                        value = '--';
                    } else {
                        value = value.toFixed(2);
                    }
                }
                grid.appendChild(createMetricDiv(key, value));
            }
        }
        details.appendChild(grid);
        containerElement.appendChild(details);
    }

    // Append main analysis sections
    // Time-Domain Metrics
    addCollapsibleSection('Tijdsdomein Metingen', { /* Time-Domain Metrics */
        'Gemiddelde RR (ms)': hrvData.meanRR, /* Mean RR (ms) */
        'Gemiddelde Hartslag (bpm)': hrvData.avgHR, /* Average Heart Rate (bpm) */
        'SDNN (ms)': hrvData.sdnn,
        'RMSSD (ms)': hrvData.rmssd,
        'NN50 (aantal)': hrvData.nn50, /* NN50 (count) */
        'pNN50 (%)': hrvData.pnn50
    }, resultsContainer);

    // Poincaré Plot Analysis
    addCollapsibleSection('Poincaré Plot Analyse', { /* Poincaré Plot Analysis */
        'SD1 (ms)': hrvData.sd1,
        'SD2 (ms)': hrvData.sd2,
        'SD2/SD1 Ratio': hrvData.sd2_sd1_ratio
    }, resultsContainer);

    // Geometric Measures
    addCollapsibleSection('Geometrische Metingen', { /* Geometric Measures */
        'HRV Driehoekige Index': hrvData.hrvTriangularIndex, /* HRV Triangular Index */
        'TINN (ms)': hrvData.tinn,
        'Baevsky\'s Stress Index': hrvData.baevskyStressIndex
    }, resultsContainer);


    // Frequency Domain Metrics (Illustratief)
    addCollapsibleSection('Frequentiedomein Metingen (Illustratief)', { /* Frequency Domain Metrics (Illustrative) */
        'VLF Vermogen (ms²)': hrvData.frequency?.['VLF Power (ms²)'], /* VLF Power (ms²) */
        'LF Vermogen (ms²)': hrvData.frequency?.['LF Power (ms²)'], /* LF Power (ms²) */
        'HF Vermogen (ms²)': hrvData.frequency?.['HF Power (ms²)'], /* HF Power (ms²) */
        'LF/HF Ratio': hrvData.frequency?.['LF/HF Ratio'],
        'Piekfrequentie (VLF Hz)': hrvData.frequency?.['Peak Frequency (VLF)'], /* Peak Frequency (VLF Hz) */
        'Piekfrequentie (LF Hz)': hrvData.frequency?.['Peak Frequency (LF)'], /* Peak Frequency (LF Hz) - Corrected: should be LF Power from hrvData.frequency */
        'Piekfrequentie (HF Hz)': hrvData.frequency?.['Peak Frequency (HF)'], /* Peak Frequency (HF Hz) */
        'Relatief Vermogen (VLF %)': hrvData.frequency?.['Relative Power (VLF)'], /* Relative Power (VLF %) */
        'Relatief Vermogen (LF %)': hrvData.frequency?.['Relative Power (LF)'], /* Relative Power (LF %) */
        'Relatief Vermogen (HF %)': hrvData.frequency?.['Relative Power (HF)'], /* Relative Power (HF %) */
        'Genormaliseerd Vermogen (LF n.u.)': hrvData.frequency?.['Normalized Power (LF)'], /* Normalized Power (LF n.u.) */
        'Genormaliseerd Vermogen (HF n.u.)': hrvData.frequency?.['Normalized Power (HF)'] /* Normalized Power (HF n.u.) */
    }, resultsContainer);

    // Derived Wellness Scores
    addCollapsibleSection('Afgeleide Welzijnsscores', { /* Derived Wellness Scores */
        'Conditioneringsscore (%)': hrvData.conditioning,
        'Herstelscore (%)': hrvData.recovery,
        'Algehele Energie': hrvData.energy, /* Overall Energy */
        'HRV Staat': hrvData.state /* HRV State */
    }, resultsContainer);

    // Advanced/Nonlinear Metrics (Placeholders)
    addCollapsibleSection('Geavanceerde / Niet-lineaire Metingen (Conceptueel - vereist gespecialiseerde bibliotheken)', { /* Advanced / Nonlinear Metrics (Conceptual - requires specialized libraries) */
        'Vertragingscapaciteit (DC)': hrvData.dc, /* Deceleration Capacity (DC) */
        'Acceleratiecapaciteit (AC)': hrvData.ac, /* Acceleration Capacity (AC) */
        'Gemodificeerde DC (DCmod)': hrvData.dcMod, /* Modified DC (DCmod) */
        'Gemodificeerde AC (ACmod)': hrvData.acMod, /* Modified AC (acmod) */
        'Geschatte Entropie (ApEn)': hrvData.apEn, /* Approximate Entropy (ApEn) */
        'Steekproef Entropie (SampEn)': hrvData.sampEn, /* Sample Entropy (SampEn) */
        'DFA Alfa 1 (Korte termijn)': hrvData.dfaAlpha1, /* DFA Alpha 1 (Short-term) */
        'DFA Alfa 2 (Lange termijn)': hrvData.dfaAlpha2, /* DFA Alpha 2 (Long-term) */
        'Correlatie Dimensie (D2)': hrvData.d2, /* Correlation Dimension (D2) */
        'Recurrentie Rate (REC)': hrvData.rec, /* Recurrence Rate (REC) */
        'Gemiddelde Lijnlengte (Lmean)': hrvData.lMean, /* Mean Line Length (Lmean) */
        'Maximale Lijnlengte (Lmax)': hrvData.lMax, /* Maximum Line Length (Lmax) */
        'Determinisme (DET)': hrvData.det, /* Determinism (DET) */
        'Shannon Entropie (ShanEn)': hrvData.shanEn, /* Shannon Entropy (ShanEn) */
        'Multischaal Entropie (MSE)': hrvData.mse /* Multiscale Entropy (MSE) */
    }, resultsContainer);


    // --- Charts Section ---
    const chartArea = document.createElement('div');
    chartArea.id = 'chartsDisplay';
    chartArea.className = 'charts-container';
    resultsContainer.appendChild(chartArea);
    console.log("chartArea created and appended."); // Debugging log

    // Destroy existing chart instances before creating new ones
    for (const chartId in chartInstances) {
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            chartInstances[chartId] = null; // Clear reference
            console.log(`Destroyed previous chart: ${chartId}`); // Debugging log
        }
    }

    // Check if there's enough data to draw charts
    if (hrvData.n < 2) { // Minimal data needed for any meaningful chart
        chartArea.innerHTML = '<p class="alert-message">Niet genoeg geldige RR-intervalgegevens om grafieken te tekenen. Upload een bestand met ten minste 2 geldige RR-intervallen.</p>'; /* Not enough valid RR interval data to draw charts. Please upload a file with at least 2 valid RR intervals. */
        console.log("Not enough data for charts, showing alert."); // Debugging log
        return; // Stop here if no data
    }

    // Create canvas elements dynamically and append them, and set explicit dimensions
    const rrCanvas = document.createElement('canvas');
    rrCanvas.id = 'chart-rr-intervals';
    chartArea.appendChild(rrCanvas);
    rrCanvas.width = rrCanvas.parentElement.clientWidth;
    rrCanvas.height = 350;

    const poincareCanvas = document.createElement('canvas');
    poincareCanvas.id = 'chart-poincare';
    chartArea.appendChild(poincareCanvas);
    poincareCanvas.width = poincareCanvas.parentElement.clientWidth;
    poincareCanvas.height = 350;

    const hrvMetricsCanvas = document.createElement('canvas');
    hrvMetricsCanvas.id = 'chart-hrv-bar';
    chartArea.appendChild(hrvMetricsCanvas);
    hrvMetricsCanvas.width = hrvMetricsCanvas.parentElement.clientWidth;
    hrvMetricsCanvas.height = 350;

    const histogramCanvas = document.createElement('canvas');
    histogramCanvas.id = 'chart-rr-histogram';
    chartArea.appendChild(histogramCanvas);
    histogramCanvas.width = histogramCanvas.parentElement.clientWidth;
    histogramCanvas.height = 350;

    const frequencyCanvas = document.createElement('canvas');
    frequencyCanvas.id = 'chart-frequency-spectrum';
    chartArea.appendChild(frequencyCanvas);
    frequencyCanvas.width = frequencyCanvas.parentElement.clientWidth;
    frequencyCanvas.height = 350;

    const breathingWaveCanvas = document.createElement('canvas');
    breathingWaveCanvas.id = 'chart-breathing-wave';
    chartArea.appendChild(breathingWaveCanvas);
    breathingWaveCanvas.width = breathingWaveCanvas.parentElement.clientWidth;
    breathingWaveCanvas.height = 350;

    console.log("All canvas elements created, appended, and dimensions set."); // Debugging log

    // Delay chart initialization slightly to allow DOM to settle
    setTimeout(() => {
        // Chart 1: RR Intervals over time
        const labels = hrvData.rrIntervals.map((_, i) => i + 1);
        const rrIntervalsDataForChart = hrvData.rrIntervals.map(val => isNaN(val) ? null : val);
        console.log("RR Intervals data for chart:", rrIntervalsDataForChart); // Debugging log
        chartInstances['chart-rr-intervals'] = new Chart(rrCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'RR Intervallen (ms)', /* RR Intervals (ms) */
                    data: rrIntervalsDataForChart,
                    borderColor: '#ef4444', /* Red-500 */
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: false, // Set to false to prevent dynamic resizing issues
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'RR Interval (ms)' }
                    },
                    x: {
                        title: { display: true, text: 'Voorbeeld Index' } /* Sample Index */
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'RR Intervallen Over Tijd', /* RR Intervals Over Time */
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
        console.log("RR Intervals chart initialized."); // Debugging log

        // Chart 2: Poincaré Plot
        const poincareData = hrvData.rrIntervals.slice(0, -1).map((val, i) => ({
            x: isNaN(val) ? null : val,
            y: isNaN(hrvData.rrIntervals[i + 1]) ? null : hrvData.rrIntervals[i + 1]
        }));
        console.log("Poincaré Plot data for chart:", poincareData); // Debugging log
        chartInstances['chart-poincare'] = new Chart(poincareCanvas.getContext('2d'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Poincaré Plot',
                    data: poincareData,
                    backgroundColor: '#3b82f6', /* Blue-500 */
                    pointRadius: 2
                }]
            },
            options: {
                responsive: false, // Set to false to prevent dynamic resizing issues
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: { display: true, text: 'RRn (ms)' }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'RRn+1 (ms)' }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Poincaré Plot (RRn vs RRn+1)',
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: { callbacks: { label: (context) => `(${context.raw.x}, ${context.raw.y})` } }
                }
            }
        });
        console.log("Poincaré Plot chart initialized."); // Debugging log

        // Chart 3: HRV Metrics Bar Chart
        const hrvMetricsLabels = ['SDNN', 'RMSSD', 'NN50', 'pNN50']; /* Mean RR */
        const hrvMetricsValues = [hrvData.sdnn, hrvData.rmssd, hrvData.nn50, hrvData.pnn50]
            .map(val => isNaN(val) ? null : val); // Convert NaN to null
        console.log("HRV Metrics Bar Chart data:", hrvMetricsValues); // Debugging log
        chartInstances['chart-hrv-bar'] = new Chart(hrvMetricsCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: hrvMetricsLabels,
                datasets: [{
                    label: 'Waarde', /* Value */
                    data: hrvMetricsValues,
                    backgroundColor: ['#f59e0b', '#8b5cf6', '#14b8a6', '#22c55e', '#ef4444'], /* Orange, Purple, Teal, Green, Red */
                    borderColor: ['#d97706', '#7c3aed', '#0d9488', '#16a34a', '#dc2626'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: false, // Set to false to prevent dynamic resizing issues
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Waarde' } } /* Value */
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Belangrijkste Tijdsdomein HRV Metingen', /* Key Time-Domain HRV Metrics */
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false }
                }
            }
        });
        console.log("HRV Metrics Bar Chart initialized."); // Debugging log

        // Chart 4: RR Interval Histogram
        const rrHistogramCountsForChart = hrvData.rrHistogram.counts.map(val => isNaN(val) ? null : val);
        console.log("RR Histogram counts for chart:", rrHistogramCountsForChart); // Debugging log
        chartInstances['chart-rr-histogram'] = new Chart(histogramCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: hrvData.rrHistogram.labels,
                datasets: [{
                    label: 'Aantal', /* Count */
                    data: rrHistogramCountsForChart,
                    backgroundColor: 'rgba(3, 169, 244, 0.6)', /* Light Blue */
                    borderColor: 'rgba(3, 169, 244, 0.8)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: false, // Set to false to prevent dynamic resizing issues
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Frequentie (Aantal)' } }, /* Frequency (Count) */
                    x: { title: { display: true, text: 'RR Interval (ms)' } }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'RR Interval Histogram (30 Bins)', /* RR Interval Histogram (30 Bins) */
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false }
                }
            }
        });
        console.log("RR Interval Histogram initialized."); // Debugging log

        // Chart 5: Frequency Domain Power Spectrum (Illustrative)
        const frequencyPsdForChart = hrvData.frequency?.psd?.map(val => isNaN(val) ? null : val) ?? [];
        console.log("Frequency PSD for chart:", frequencyPsdForChart); // Debugging log
        chartInstances['chart-frequency-spectrum'] = new Chart(frequencyCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: hrvData.frequency?.freqs?.map(f => f.toFixed(3) + ' Hz') ?? [],
                datasets: [{
                    label: 'Illustratief Vermogen (ms²)', /* Illustrative Power (ms²) */
                    data: frequencyPsdForChart,
                    backgroundColor: '#60a5fa', /* Blue-400 */
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: false, // Set to false to prevent dynamic resizing issues
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Vermogen (ms²)' } }, /* Power (ms²) */
                    x: { title: { display: true, text: 'Frequentie (Hz)' } }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Illustratief Frequentiedomein Vermogensspectrum', /* Illustrative Frequency Domain Power Spectrum */
                        font: { size: 16, weight: 'bold' }
                    }
                }
            }
        });
        console.log("Frequency Domain Power Spectrum initialized."); // Debugging log

        // Chart 8: Breathing Wave
        const breathingWaveDataForChart = hrvData.breathingWave.map(val => isNaN(val) ? null : val);
        console.log("Breathing Wave data", breathingWaveDataForChart); // Debugging log
        chartInstances['chart-breathing-wave'] = new Chart(breathingWaveCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: hrvData.breathingWave.map((_, i) => i),
                datasets: [{
                    label: 'Ademhalingsgolf ', /* Breathing Wave (simulated bpm) */
                    data: breathingWaveDataForChart,
                    borderColor: 'rgba(0, 150, 136, 0.7)', /* Teal */
                    backgroundColor: 'rgba(0, 150, 136, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: false, // Set to false to prevent dynamic resizing issues
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: ' Ademhaling ' } /* Simulated Breathing (bpm) */
                    },
                    x: {
                        title: { display: true, text: 'Voorbeeld Index' } /* Sample Index */
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: ' Ademhalingsgolf', /* Simulated Breathing Wave from RR Intervals */
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
        console.log("Breathing Wave chart initialized."); // Debugging log
    }, 50); // Small delay for all chart initializations
}



// --- Main execution logic ---
document.addEventListener('DOMContentLoaded', () => {
    const rrFileUpload = document.getElementById('rrFileUpload');
    const analyzeUploadBtn = document.getElementById('analyzeUploadBtn');
    const getHrvInsightBtn = document.getElementById('getHrvInsightBtn');

    analyzeUploadBtn.addEventListener('click', () => {
        clearError(); // Clear previous errors
        document.getElementById('hrvInsightContainer').classList.add('hidden'); // Hide insight container on new analysis
        document.getElementById('insightText').textContent = '';

        if (rrFileUpload.files.length === 0) {
            displayError('Selecteer een .txt-bestand om te uploaden.'); /* Please select a .txt file to upload. */
            return;
        }

        const file = rrFileUpload.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            const text = e.target.result;
            const rrIntervalsRaw = text.split('\n').map(s => s.trim()).filter(s => s !== '');
            // Map to Number first, then filter out NaN and non-positive
            const rrIntervals = rrIntervalsRaw.map(Number).filter(n => !isNaN(n) && n > 0);

            try {
                const hrvAnalyzer = new HRVAnalyzer(rrIntervals);
                displayAnalysisResults(hrvAnalyzer);
            } catch (error) {
                displayError(error.message);
                // Also clear results container if there's an error
                document.getElementById('analysisResults').innerHTML = '';
                // Destroy all chart instances on error to prevent old charts from persisting
                for (const chartId in chartInstances) {
                    if (chartInstances[chartId]) {
                        chartInstances[chartId].destroy();
                        chartInstances[chartId] = null;
                    }
                }
            }
        };

        reader.onerror = () => {
            displayError('Fout bij het lezen van het bestand. Probeer het opnieuw.'); /* Error reading file. Please try again. */
        };

        reader.readAsText(file);
    });

   getHrvInsightBtn.addEventListener('click', () => {
       clearError();
       document.getElementById('hrvInsightContainer').classList.add('hidden');
       
       // Check if the RR file input is empty
       if (!rrFileUpload.value) {
           const requiredFields = [
               { name: 'Name', value: '' },
               { name: 'Age', value: '' },
               { name: 'Length', value: '' },
               { name: 'Weight', value: '' },
               { name: 'Gender', value: '' }
           ];
           
           const shouldProceed = requiredFields.every(field => {
               return confirm(`${field.name}, missing data. Required > input text below?`);
           });
   
           if (!shouldProceed) {
               return; // Exit early if user cancels any confirmation
           }
       }
       
       // Only proceed with redirection if there's data or user chooses to proceed anyway
       window.location.href = `report/report.html?rrfile=${encodeURIComponent(rrFileUpload.value)}`;
   });
   
    
});
  
