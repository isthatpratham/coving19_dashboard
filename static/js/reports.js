// static/js/reports.js

document.addEventListener("DOMContentLoaded", () => {
    initLayout();
    initTheme();
    fetchAnalyticalSummary();
    initActions();
});

const isDark = () => document.body.classList.contains('dark-mode');

function initLayout() {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseSidebar');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
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
        });
    }
}

async function fetchAnalyticalSummary() {
    try {
        const response = await fetch('/api/analytics-summary');
        const data = await response.json();
        renderSummary(data);
    } catch (error) {
        console.error("Failed to fetch summary:", error);
        document.getElementById('reportContent').innerHTML = '<p class="text-danger p-4">Error loading analytical summary.</p>';
    }
}

function renderSummary(data) {
    const container = document.getElementById('reportContent');
    document.getElementById('reportTimestamp').textContent = `Last dataset update: ${data.last_update}`;

    const topCountriesStr = Object.entries(data.top_countries)
        .map(([c, v]) => `<li><strong>${c}</strong>: ${v.toLocaleString()} cases</li>`)
        .join('');

    container.innerHTML = `
        <div class="summary-report">
            <h5 class="mb-4">Global Pandemic Status Overview</h5>
            <div class="row g-3 mb-4">
                <div class="col-sm-4">
                    <div class="p-3 bg-light rounded text-center">
                        <div class="text-muted small uppercase mb-1">Total Confirmed</div>
                        <div class="h4 mb-0 fw-bold">${data.totals.cases.toLocaleString()}</div>
                    </div>
                </div>
                <div class="col-sm-4">
                    <div class="p-3 bg-light rounded text-center">
                        <div class="text-muted small uppercase mb-1">Global Deaths</div>
                        <div class="h4 mb-0 fw-bold text-danger">${data.totals.deaths.toLocaleString()}</div>
                    </div>
                </div>
                <div class="col-sm-4">
                    <div class="p-3 bg-light rounded text-center">
                        <div class="text-muted small uppercase mb-1">Global Recoveries</div>
                        <div class="h4 mb-0 fw-bold text-success">${data.totals.recovered.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <p>Significant milestone: On <strong>${data.peak.date}</strong>, the world recorded its highest daily increase in cases, with <strong>${data.peak.value.toLocaleString()}</strong> new infections reported within 24 hours.</p>
            
            <h6 class="mt-4 fw-bold">Top 3 Most Affected Nations:</h6>
            <ul>${topCountriesStr}</ul>

            <div class="alert alert-warning mt-4 py-2 small border-0">
                <i class="fas fa-info-circle me-2"></i> This report is automatically generated based on the latest available surveillance data.
            </div>
        </div>
    `;
}

function initActions() {
    document.getElementById('generatePDF').addEventListener('click', () => {
        window.print();
    });

    document.getElementById('copySummary').addEventListener('click', async () => {
        const reportText = document.getElementById('reportContent').innerText;
        try {
            await navigator.clipboard.writeText(reportText);
            const btn = document.getElementById('copySummary');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check me-2"></i> Copied!';
            btn.classList.replace('btn-success', 'btn-outline-success');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.replace('btn-outline-success', 'btn-success');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    });
}
