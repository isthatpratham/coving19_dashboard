// static/js/global_overview.js

const globalColors = {
    primary: '#4f46e5',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    secondary: '#64748b',
    primaryGradient: 'rgba(79, 70, 229, 0.2)',
    dangerGradient: 'rgba(239, 68, 68, 0.2)',
    successGradient: 'rgba(16, 185, 129, 0.2)'
};

let chartInstances = {};

const isDark = () => document.body.classList.contains('dark-mode');

document.addEventListener("DOMContentLoaded", () => {
    initLayout();
    initTheme();
    loadGlobalData();
});

function initLayout() {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseSidebar');
    const toggleSidebar = () => sidebar.classList.toggle('collapsed');
    if (collapseBtn) collapseBtn.addEventListener('click', toggleSidebar);
}

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const dark = isDark();
            localStorage.setItem('theme', dark ? 'dark' : 'light');
            themeToggle.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            refreshCharts();
        });
    }
}

function refreshCharts() {
    const dark = isDark();
    Object.values(chartInstances).forEach(chart => {
        if (chart.options.scales) {
            if (chart.options.scales.x) chart.options.scales.x.grid.color = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
            if (chart.options.scales.y) chart.options.scales.y.grid.color = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        }
        chart.update();
    });
}

function getCommonOptions() {
    const dark = isDark();
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
                labels: { color: dark ? '#94a3b8' : '#1e293b', font: { family: 'Inter', size: 12 } }
            },
            tooltip: {
                backgroundColor: dark ? '#1e293b' : '#ffffff',
                titleColor: dark ? '#f1f5f9' : '#1e293b',
                bodyColor: dark ? '#94a3b8' : '#64748b',
                borderColor: dark ? '#334155' : '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8
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
        animation: { duration: 1500, easing: 'easeOutQuart' }
    };
}

async function loadGlobalData() {
    try {
        const [stats, casesTrend, deathsTrend, recoveryTrend, topCases, topDeaths] = await Promise.all([
            fetch('/api/global-stats').then(res => res.json()),
            fetch('/api/global-cases-trend').then(res => res.json()),
            fetch('/api/global-deaths-trend').then(res => res.json()),
            fetch('/api/global-recovery-trend').then(res => res.json()),
            fetch('/api/top-countries?country=All').then(res => res.json()),
            fetch('/api/country-deaths?country=All').then(res => res.json())
        ]);

        renderKPIs(stats);
        renderCharts(casesTrend, deathsTrend, recoveryTrend, topCases, topDeaths);
        hideLoaders();

    } catch (error) {
        console.error("Error loading global overview data:", error);
    }
}

function renderKPIs(stats) {
    animateCounter('global-confirmed', stats.total_cases);
    animateCounter('global-deaths', stats.total_deaths);
    document.getElementById('global-recovery-rate').textContent = stats.recovery_rate + '%';
    document.getElementById('global-mortality-rate').textContent = stats.mortality_rate + '%';
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const duration = 1500;
    const startTime = performance.now();
    const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.floor(progress * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString();
    };
    requestAnimationFrame(step);
}

function renderCharts(cases, deaths, recovery, topCases, topDeaths) {
    // Cases Chart
    chartInstances.cases = new Chart(document.getElementById('globalCasesChart'), {
        type: 'line',
        data: {
            labels: cases.dates,
            datasets: [{
                label: 'Global Cases',
                data: cases.cases,
                borderColor: globalColors.primary,
                backgroundColor: globalColors.primaryGradient,
                fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0
            }]
        },
        options: getCommonOptions()
    });

    // Deaths Chart
    chartInstances.deaths = new Chart(document.getElementById('globalDeathsChart'), {
        type: 'line',
        data: {
            labels: deaths.dates,
            datasets: [{
                label: 'Global Deaths',
                data: deaths.deaths,
                borderColor: globalColors.danger,
                backgroundColor: globalColors.dangerGradient,
                fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0
            }]
        },
        options: getCommonOptions()
    });

    // Recovery Chart
    chartInstances.recovery = new Chart(document.getElementById('globalRecoveryChart'), {
        type: 'line',
        data: {
            labels: recovery.dates,
            datasets: [{
                label: 'Global Recoveries',
                data: recovery.recovered,
                borderColor: globalColors.success,
                backgroundColor: globalColors.successGradient,
                fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0
            }]
        },
        options: getCommonOptions()
    });

    // Top Countries Cases
    chartInstances.topCases = new Chart(document.getElementById('topCountriesCasesChart'), {
        type: 'bar',
        data: {
            labels: topCases.countries,
            datasets: [{
                label: 'Confirmed Cases',
                data: topCases.cases,
                backgroundColor: globalColors.warning,
                borderRadius: 8
            }]
        },
        options: getCommonOptions()
    });

    // Top Countries Deaths
    chartInstances.topDeaths = new Chart(document.getElementById('topCountriesDeathsChart'), {
        type: 'bar',
        data: {
            labels: topDeaths.countries,
            datasets: [{
                label: 'Total Deaths',
                data: topDeaths.deaths,
                backgroundColor: globalColors.secondary,
                borderRadius: 8
            }]
        },
        options: { ...getCommonOptions(), indexAxis: 'y' }
    });
}

function hideLoaders() {
    document.querySelectorAll('.loader-overlay').forEach(l => l.classList.add('hidden'));
}
