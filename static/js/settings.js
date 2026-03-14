// static/js/settings.js

document.addEventListener("DOMContentLoaded", () => {
    initLayout();
    loadSettings();
    initSettingsListeners();
});

const isDark = () => document.body.classList.contains('dark-mode');

function initLayout() {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseSidebar');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
}

function loadSettings() {
    // Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeSwitch').checked = true;
    }

    // Auto Refresh
    const autoRefresh = localStorage.getItem('auto_refresh') === 'true';
    document.getElementById('autoRefreshSwitch').checked = autoRefresh;

    // Chart Animations
    const animations = localStorage.getItem('chart_animations') !== 'false'; // Default true
    document.getElementById('chartAnimationSwitch').checked = animations;

    // Default Date Range
    const savedRange = localStorage.getItem('default_date_range') || 'all_time';
    document.getElementById('defaultDateRange').value = savedRange;
}

function initSettingsListeners() {
    // Theme Toggle
    document.getElementById('darkModeSwitch').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    });

    // Auto Refresh
    document.getElementById('autoRefreshSwitch').addEventListener('change', (e) => {
        localStorage.setItem('auto_refresh', e.target.checked);
    });

    // Chart Animations
    document.getElementById('chartAnimationSwitch').addEventListener('change', (e) => {
        localStorage.setItem('chart_animations', e.target.checked);
    });

    // Date Range
    document.getElementById('defaultDateRange').addEventListener('change', (e) => {
        localStorage.setItem('default_date_range', e.target.value);
    });

    // Reset Settings
    document.getElementById('resetSettings').addEventListener('click', () => {
        if (confirm("Are you sure you want to reset all dashboard settings to default?")) {
            localStorage.clear();
            location.reload();
        }
    });

    // Top navbar sync (if existing)
    const topThemeBtn = document.getElementById('themeToggle');
    if (topThemeBtn) {
        topThemeBtn.addEventListener('click', () => {
            const dark = isDark();
            document.getElementById('darkModeSwitch').checked = !dark;
            // The global listener in other pages handles the toggle, 
            // but we need to ensure the switch on THIS page stays in sync if manually clicked
            setTimeout(() => {
                document.getElementById('darkModeSwitch').checked = isDark();
            }, 10);
        });
    }
}
