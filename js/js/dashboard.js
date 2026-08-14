document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const totalCalcsElem = document.getElementById('total-calculations');
    const savedEqsElem = document.getElementById('saved-equations');

    // Retrieve storage history
    const history = JSON.parse(localStorage.getItem('calc_history')) || [];
    const count = history.length;

    // 1. Update basic statistic counter fields (Increment base counts)
    const baseTotalVal = 12482;
    const baseSavedVal = 343;

    if (totalCalcsElem) {
        totalCalcsElem.textContent = (baseTotalVal + count).toLocaleString('en-US');
    }
    if (savedEqsElem) {
        savedEqsElem.textContent = (baseSavedVal + count).toLocaleString('en-US');
    }

    // 2. Dynamic Chart.js update integrations
    let basicCount = 0;
    let financialCount = 0;
    let scientificCount = 0;

    // Monthly frequency tracking setup (Jan=0, Feb=1, ..., Dec=11)
    const monthlyIncrements = Array(12).fill(0);

    // Classify history items
    history.forEach(item => {
        const eq = item.equation || '';

        // Category classification
        if (eq.includes('%') || eq.includes('÷') || eq.includes('/')) {
            financialCount++;
        } else if (/\bsin\b|\bcos\b|\btan\b|\bpow\b|\bsqrt\b|\b[a-zA-Z]+\b/.test(eq) || eq.includes('^')) {
            scientificCount++;
        } else {
            basicCount++;
        }

        // Monthly frequency extraction
        const ts = item.timestamp ? new Date(item.timestamp) : new Date();
        const monthIndex = ts.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
            monthlyIncrements[monthIndex]++;
        }
    });

    // 3. Update Doughnut Chart (myPieChart) dynamic values
    if (window.myPieChart && window.myPieChart.data && window.myPieChart.data.datasets.length > 0) {
        const pieDataset = window.myPieChart.data.datasets[0];

        // Base values: [55, 30, 15] for Basic, Financial, Scientific
        pieDataset.data[0] = 55 + basicCount;
        pieDataset.data[1] = 30 + financialCount;
        pieDataset.data[2] = 15 + scientificCount;

        window.myPieChart.update();
    }

    // 4. Update Line Chart (myLineChart) monthly activities
    if (window.myLineChart && window.myLineChart.data && window.myLineChart.data.datasets.length > 0) {
        const lineDataset = window.myLineChart.data.datasets[0];

        // Apply monthly counts to base counts initialized in chart-area-demo.js
        for (let i = 0; i < 12; i++) {
            if (lineDataset.data[i] !== undefined) {
                lineDataset.data[i] += monthlyIncrements[i];
            }
        }

        window.myLineChart.update();
    }
});
