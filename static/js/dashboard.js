// static/js/dashboard.js

// Color Configuration for Charts
const chartColors = {
    primary: '#4f46e5',
    secondary: '#64748b',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4',
    primaryGradient: 'rgba(79, 70, 229, 0.2)',
    secondaryGradient: 'rgba(100, 116, 139, 0.2)',
    successGradient: 'rgba(16, 185, 129, 0.2)',
    dangerGradient: 'rgba(239, 68, 68, 0.2)'
};

// Global State
let dashboardData = {};
let chartInstances = {};
let selectedStartDate = '';
let selectedEndDate = '';
let currentCountry = 'All';
const isDark = () => document.body.classList.contains('dark-mode');

document.addEventListener("DOMContentLoaded", () => {
    initLayout();
    initTheme();
    initDateFilter();
    initComparisonTool();
    initExportTools();
    loadDashboardData();
});

// --- LAYOUT & THEME LOGIC ---

function initLayout() {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    const toggleSidebar = () => {
        sidebar.classList.toggle('collapsed');
    };

    collapseBtn.addEventListener('click', toggleSidebar);
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
    });

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 768 && !sidebar.contains(e.target) && !sidebarToggle.contains(e.target) && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
    });
}

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const dark = isDark();
        localStorage.setItem('theme', dark ? 'dark' : 'light');
        themeToggle.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        // Refresh charts for theme change
        Object.values(chartInstances).forEach(chart => {
            chart.options.scales.x.grid.color = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            chart.options.scales.y.grid.color = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            chart.options.plugins.legend.labels.color = dark ? '#94a3b8' : '#1e293b';
            chart.update();
        });
    });
}

// --- DATA FETCHING ---

async function loadDashboardData() {
    const endpoints = [
        { key: 'dailyTrend', url: '/api/daily-trend' },
        { key: 'topCountries', url: '/api/top-countries' },
        { key: 'monthlyTrend', url: '/api/monthly-trend' },
        { key: 'mortalityRanking', url: '/api/mortality-ranking' },
        { key: 'recoveryTrend', url: '/api/recovery-trend' },
        { key: 'continentAnalysis', url: '/api/continent-analysis' },
        { key: 'dailyDeaths', url: '/api/daily-deaths' },
        { key: 'countryDeaths', url: '/api/country-deaths' },
        { key: 'recoveryRate', url: '/api/recovery-rate' },
        { key: 'casesVsDeaths', url: '/api/cases-vs-deaths' },
        { key: 'casesVsDeathsTrend', url: '/api/cases-vs-deaths-trend' },
        { key: 'growthRate', url: '/api/growth-rate' },
        { key: 'allCountries', url: '/api/all-countries-list' }
    ];

    const queryString = getQueryString();

    try {
        const results = await Promise.all(endpoints.map(e => {
            const url = e.key === 'allCountries' ? e.url : `${e.url}${queryString}`;
            return fetch(url).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
                return res.json();
            });
        }));

        results.forEach((data, index) => {
            dashboardData[endpoints[index].key] = data;
        });

        populateCountryFilter();
        renderKPIs();
        renderCharts();
        hideLoaders();

    } catch (error) {
        console.error("Critical error loading dashboard data:", error);
    }
}

function hideLoaders() {
    document.querySelectorAll('.loader-overlay').forEach(loader => loader.classList.add('hidden'));
}

// --- UI COMPONENTS ---

function populateCountryFilter() {
    const filter = document.getElementById('countryFilter');
    const compA = document.getElementById('compareCountryA');
    const compB = document.getElementById('compareCountryB');

    dashboardData.allCountries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        filter.appendChild(option);

        // Populate comparison selectors
        const optA = option.cloneNode(true);
        const optB = option.cloneNode(true);
        compA.appendChild(optA);
        compB.appendChild(optB);
    });

    filter.addEventListener('change', (e) => {
        currentCountry = e.target.value;
        updateDashboard(currentCountry);
    });
}

function initDateFilter() {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    const resetBtn = document.getElementById('resetDates');

    const handleDateChange = () => {
        selectedStartDate = startInput.value;
        selectedEndDate = endInput.value;
        updateDashboard(currentCountry);
    };

    startInput.addEventListener('change', handleDateChange);
    endInput.addEventListener('change', handleDateChange);

    resetBtn.addEventListener('click', () => {
        startInput.value = '';
        endInput.value = '';
        selectedStartDate = '';
        selectedEndDate = '';
        updateDashboard(currentCountry);
    });
}

function initComparisonTool() {
    const compareBtn = document.getElementById('compareBtn');
    compareBtn.addEventListener('click', () => {
        const countryA = document.getElementById('compareCountryA').value;
        const countryB = document.getElementById('compareCountryB').value;

        if (!countryA || !countryB) {
            alert("Please select two countries to compare.");
            return;
        }

        if (countryA === countryB) {
            alert("Please select two different countries.");
            return;
        }

        compareCountries(countryA, countryB);
    });
}

async function compareCountries(countryA, countryB) {
    const loader = document.getElementById('loader-comparison');
    const placeholder = document.getElementById('comparisonPlaceholder');
    const ctx = document.getElementById('comparisonChart').getContext('2d');

    loader.classList.remove('hidden');
    placeholder.classList.add('hidden');

    try {
        const [dataA, dataB] = await Promise.all([
            fetch(`/api/daily-trend?country=${encodeURIComponent(countryA)}`).then(res => res.json()),
            fetch(`/api/daily-trend?country=${encodeURIComponent(countryB)}`).then(res => res.json())
        ]);

        if (chartInstances.comparison) {
            chartInstances.comparison.destroy();
        }

        chartInstances.comparison = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataA.dates, // Assuming both have similar date ranges for visualization
                datasets: [
                    {
                        label: countryA,
                        data: dataA.cases,
                        borderColor: chartColors.primary,
                        backgroundColor: chartColors.primaryGradient,
                        fill: false, tension: 0.4, borderWidth: 3, pointRadius: 2
                    },
                    {
                        label: countryB,
                        data: dataB.cases,
                        borderColor: chartColors.danger,
                        backgroundColor: chartColors.dangerGradient,
                        fill: false, tension: 0.4, borderWidth: 3, pointRadius: 2
                    }
                ]
            },
            options: {
                ...getCommonOptions(`${countryA} vs ${countryB}`),
                plugins: {
                    ...getCommonOptions().plugins,
                    tooltip: {
                        ...getCommonOptions().plugins.tooltip,
                        callbacks: {
                            label: (context) => {
                                const country = context.dataset.label;
                                const cases = context.parsed.y;
                                return `${country}: ${cases.toLocaleString()} cases`;
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Comparison error:", error);
        alert("Failed to fetch comparison data.");
    } finally {
        loader.classList.add('hidden');
    }
}

function getQueryString(country = null) {
    const params = new URLSearchParams();
    const c = country || currentCountry;

    if (c !== 'All') params.append('country', c);
    if (selectedStartDate) params.append('start', selectedStartDate);
    if (selectedEndDate) params.append('end', selectedEndDate);

    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    const duration = 1500;
    const start = 0;
    const range = target - start;
    let startTime = null;

    const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const value = Math.floor(progress * range + start);
        el.textContent = value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            el.textContent = target.toLocaleString();
        }
    };
    window.requestAnimationFrame(step);
}

function renderKPIs() {
    const cases = dashboardData.dailyTrend.cases;
    const recovered = dashboardData.recoveryTrend.recovered;
    const deaths = dashboardData.dailyDeaths.deaths;

    const totalConfirmed = cases[cases.length - 1] || 0;
    const totalRecovered = Math.max(...recovered) || 0;
    const totalDeaths = deaths[deaths.length - 1] || 0;
    const mortalityRate = ((totalDeaths / totalConfirmed) * 100).toFixed(2);

    // Get Top Affected Country
    const countries = dashboardData.topCountries.countries;
    const topCountry = countries[0] || 'N/A';

    animateCounter('kpi-confirmed', totalConfirmed);
    animateCounter('kpi-recovered', totalRecovered);
    animateCounter('kpi-deaths', totalDeaths);
    document.getElementById('kpi-mortality').textContent = mortalityRate + '%';
    document.getElementById('kpi-top-country').textContent = topCountry;
}

// --- CHARTS ENGINE ---

function getCommonOptions(title = '') {
    const dark = isDark();
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: title !== '',
                position: 'bottom',
                labels: { color: dark ? '#94a3b8' : '#1e293b', font: { family: 'Inter', size: 12 }, padding: 20 }
            },
            tooltip: {
                backgroundColor: dark ? '#1e293b' : '#ffffff',
                titleColor: dark ? '#f1f5f9' : '#1e293b',
                bodyColor: dark ? '#94a3b8' : '#64748b',
                borderColor: dark ? '#334155' : '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true
            }
        },
        scales: {
            x: {
                grid: { color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                ticks: { color: dark ? '#94a3b8' : '#64748b' }
            },
            y: {
                grid: { color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                ticks: {
                    color: dark ? '#94a3b8' : '#64748b',
                    callback: v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v.toLocaleString()
                }
            }
        },
        animation: { duration: 2000, easing: 'easeOutQuart' }
    };
}

function renderCharts() {
    // 1. Cases vs Deaths Trend
    renderCasesVsDeaths();

    // 2. Continent Analysis
    renderContinent();

    // 3. Top Affected Countries
    renderTopCountries();

    // 4. Country Deaths
    renderCountryDeaths();

    // 5. Monthly Trend
    renderMonthlyTrend();

    // 6. Recovery Rate
    renderRecoveryRate();

    // 7. Growth Rate
    renderGrowthRate();

    // 8. Mortality Ranking
    renderMortalityRanking();

    // 9. Recovery Trend
    renderRecoveryTrendChart();

    // 10. Cases vs Deaths Correlation
    renderCorrelationChart();
}

function renderCorrelationChart() {
    const ctx = document.getElementById('correlationChart').getContext('2d');
    const data = dashboardData.casesVsDeaths;

    chartInstances.correlation = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Country Correlation',
                data: data.map(d => ({ x: d.cases, y: d.deaths, country: d.country })),
                backgroundColor: chartColors.info,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            ...getCommonOptions('Correlation'),
            plugins: {
                ...getCommonOptions().plugins,
                tooltip: {
                    ...getCommonOptions().plugins.tooltip,
                    callbacks: {
                        label: (ctx) => {
                            const p = ctx.raw;
                            return [`${p.country}`, `Cases: ${p.x.toLocaleString()}`, `Deaths: ${p.y.toLocaleString()}`];
                        }
                    }
                }
            },
            scales: {
                x: {
                    ...getCommonOptions().scales.x,
                    title: { display: true, text: 'Confirmed Cases', color: isDark() ? '#94a3b8' : '#64748b' }
                },
                y: {
                    ...getCommonOptions().scales.y,
                    title: { display: true, text: 'Total Deaths', color: isDark() ? '#94a3b8' : '#64748b' }
                }
            }
        }
    });
}
function renderCasesVsDeaths() {
    const ctx = document.getElementById('casesVsDeathsChart').getContext('2d');
    const data = dashboardData.casesVsDeathsTrend;
    chartInstances.cvd = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Confirmed Cases',
                    data: data.cases,
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primaryGradient,
                    fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0
                },
                {
                    label: 'Total Deaths',
                    data: data.deaths,
                    borderColor: chartColors.danger,
                    backgroundColor: chartColors.dangerGradient,
                    fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0
                }
            ]
        },
        options: getCommonOptions('Trend')
    });
}

function renderContinent() {
    const ctx = document.getElementById('continentChart').getContext('2d');
    const data = dashboardData.continentAnalysis;
    chartInstances.continent = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.continent,
            datasets: [{
                data: data.confirmed_cases,
                backgroundColor: [chartColors.primary, chartColors.success, chartColors.warning, chartColors.danger, chartColors.info, chartColors.secondary],
                borderWidth: 0
            }]
        },
        options: {
            ...getCommonOptions(),
            cutout: '70%',
            plugins: { ...getCommonOptions().plugins, legend: { position: 'bottom' } }
        }
    });
}

function renderTopCountries() {
    const ctx = document.getElementById('topCountriesChart').getContext('2d');
    const data = dashboardData.topCountries;
    chartInstances.top = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.countries,
            datasets: [{
                label: 'Cases',
                data: data.cases,
                backgroundColor: chartColors.danger,
                borderRadius: 8
            }]
        },
        options: getCommonOptions()
    });
}

function renderCountryDeaths() {
    const ctx = document.getElementById('countryDeathsChart').getContext('2d');
    const data = dashboardData.countryDeaths;
    chartInstances.deaths = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.countries,
            datasets: [{
                label: 'Deaths',
                data: data.deaths,
                backgroundColor: chartColors.secondary,
                borderRadius: 8
            }]
        },
        options: { ...getCommonOptions(), indexAxis: 'y' }
    });
}

function renderMonthlyTrend() {
    const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
    const data = dashboardData.monthlyTrend;
    chartInstances.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.months,
            datasets: [{
                label: 'Monthly Growth',
                data: data.cases,
                borderColor: chartColors.warning,
                tension: 0.4, pointRadius: 4, borderWidth: 3
            }]
        },
        options: getCommonOptions()
    });
}

function renderRecoveryRate() {
    const ctx = document.getElementById('recoveryRateChart').getContext('2d');
    const data = dashboardData.recoveryRate;
    chartInstances.recoveryRate = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.countries,
            datasets: [{
                label: 'Recovery %',
                data: data.recovery_rates,
                backgroundColor: chartColors.success,
                borderRadius: 6
            }]
        },
        options: {
            ...getCommonOptions(),
            scales: { ...getCommonOptions().scales, y: { ...getCommonOptions().scales.y, ticks: { callback: v => v + '%' } } }
        }
    });
}

function renderGrowthRate() {
    const ctx = document.getElementById('growthRateChart').getContext('2d');
    const data = dashboardData.growthRate;
    chartInstances.growth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'Daily New Cases',
                data: data.growth,
                borderColor: chartColors.info,
                borderWidth: 2, pointRadius: 0, fill: false
            }]
        },
        options: getCommonOptions()
    });
}

function renderMortalityRanking() {
    const ctx = document.getElementById('mortalityRankingChart').getContext('2d');
    const data = dashboardData.mortalityRanking;
    chartInstances.mortalityRank = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.countries,
            datasets: [{
                label: 'Fatality %',
                data: data.mortality_rates,
                backgroundColor: '#334155',
                borderRadius: 6
            }]
        },
        options: getCommonOptions()
    });
}

function renderRecoveryTrendChart() {
    const ctx = document.getElementById('recoveryTrendChart').getContext('2d');
    const data = dashboardData.recoveryTrend;
    chartInstances.recoveryTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'Recoveries',
                data: data.recovered,
                borderColor: chartColors.success,
                backgroundColor: chartColors.successGradient,
                fill: true, tension: 0.4, pointRadius: 0
            }]
        },
        options: getCommonOptions()
    });
}

// --- GLOBAL FILTER LOGIC ---
async function updateDashboard(country = 'All') {
    document.querySelectorAll('.loader-overlay').forEach(l => l.classList.remove('hidden'));

    const query = getQueryString(country);

    const endpoints = [
        { key: 'dailyTrend', url: `/api/daily-trend${query}` },
        { key: 'topCountries', url: `/api/top-countries${query}` },
        { key: 'monthlyTrend', url: `/api/monthly-trend${query}` },
        { key: 'mortalityRanking', url: `/api/mortality-ranking${query}` },
        { key: 'recoveryTrend', url: `/api/recovery-trend${query}` },
        { key: 'continentAnalysis', url: `/api/continent-analysis${query}` },
        { key: 'dailyDeaths', url: `/api/daily-deaths${query}` },
        { key: 'countryDeaths', url: `/api/country-deaths${query}` },
        { key: 'recoveryRate', url: `/api/recovery-rate${query}` },
        { key: 'casesVsDeaths', url: `/api/cases-vs-deaths${query}` },
        { key: 'casesVsDeathsTrend', url: `/api/cases-vs-deaths-trend${query}` },
        { key: 'growthRate', url: `/api/growth-rate${query}` }
    ];

    try {
        const results = await Promise.all(endpoints.map(e => fetch(e.url).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} on ${e.url}`);
            return res.json();
        })));

        results.forEach((data, index) => {
            dashboardData[endpoints[index].key] = data;
        });

        renderKPIs();

        // Destroy and re-render charts for fresh animation
        Object.values(chartInstances).forEach(c => c.destroy());
        chartInstances = {}; // Reset chart instances
        renderCharts();
        hideLoaders();

    } catch (e) {
        console.error("Dashboard update error:", e);
        hideLoaders();
    }
}

// --- REPORT EXPORT ---

function initExportTools() {
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
}

function showGlobalLoader() {
    document.getElementById('globalLoader').classList.remove('hidden');
}

function hideGlobalLoader() {
    document.getElementById('globalLoader').classList.add('hidden');
}

function exportToCSV() {
    showGlobalLoader();

    try {
        const trendData = dashboardData.casesVsDeathsTrend;
        if (!trendData || !trendData.dates) {
            throw new Error("No trend data available for CSV export.");
        }

        const recoveryData = dashboardData.recoveryTrend;

        let csvContent = "";
        csvContent += "Country,Date,Confirmed Cases,Deaths,Recovered\n";

        trendData.dates.forEach((date, index) => {
            const country = currentCountry === 'All' ? 'Global' : currentCountry;
            const cases = trendData.cases[index] || 0;
            const deaths = trendData.deaths[index] || 0;
            const recovered = (recoveryData && recoveryData.recovered[index]) ? recoveryData.recovered[index] : 0;

            csvContent += `${country},${date},${cases},${deaths},${recovered}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `COVID19_Data_${currentCountry}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error("CSV Export failed:", e);
        alert("Failed to export CSV. Please try again.");
    } finally {
        setTimeout(hideGlobalLoader, 500);
    }
}
