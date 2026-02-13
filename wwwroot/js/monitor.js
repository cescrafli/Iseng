"use strict";

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/monitorHub")
    .withAutomaticReconnect()
    .build();

// Charts
let cpuChart_ctx = document.getElementById('cpuChart').getContext('2d');
let memChart_ctx = document.getElementById('memChart').getContext('2d');
let netChart_ctx = document.getElementById('netChart').getContext('2d');

// Gradient helper
function createGradient(ctx, colorStart, colorEnd) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
}

const chartConfig = (label, color, bgColor) => ({
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: label,
            data: [],
            borderColor: color,
            backgroundColor: bgColor,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#fff',
            pointBorderColor: color,
            pointBorderWidth: 2,
            fill: true,
            tension: 0.4, // Smooth curve
            cubicInterpolationMode: 'monotone'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 800, // Smooth transition
            easing: 'easeOutQuart'
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#2c3e50',
                bodyColor: '#2c3e50',
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        return context.dataset.label + ': ' + context.parsed.y;
                    }
                }
            }
        },
        scales: {
            x: {
                display: false,
                grid: { display: false }
            },
            y: {
                beginAtZero: true,
                border: { display: false },
                grid: {
                    borderDash: [5, 5],
                    color: 'rgba(0,0,0,0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#95a5a6',
                    font: { size: 10, family: 'Inter' },
                    padding: 10
                }
            }
        }
    }
});

// Create charts with nice gradients
let cpuGradient = createGradient(cpuChart_ctx, 'rgba(52, 152, 219, 0.4)', 'rgba(52, 152, 219, 0.0)');
let memGradient = createGradient(memChart_ctx, 'rgba(46, 204, 113, 0.4)', 'rgba(46, 204, 113, 0.0)');
let netGradient = createGradient(netChart_ctx, 'rgba(26, 188, 156, 0.4)', 'rgba(26, 188, 156, 0.0)');

let cpuChart = new Chart(cpuChart_ctx, chartConfig('CPU Usage (%)', '#3498db', cpuGradient));
let memChart = new Chart(memChart_ctx, chartConfig('Memory Usage (%)', '#2ecc71', memGradient));
let netChart = new Chart(netChart_ctx, chartConfig('Network In (KB/s)', '#1abc9c', netGradient));

const MAX_DATA_POINTS = 30; // 30 seconds history

function updateChart(chart, value) {
    const now = new Date().toLocaleTimeString();
    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > MAX_DATA_POINTS) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update(); // Animation handled by config
}

// Simple CountUp Tween
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Handle float vs int
        let val = progress * (end - start) + start;
        if (Number.isInteger(end)) val = Math.floor(val);
        else val = val.toFixed(1);

        obj.innerHTML = val + (obj.dataset.unit || '');

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Store last values for tweening
let lastCpu = 0;
let lastMem = 0;
let lastNet = 0;

// Toast Notification Queue
const alertQueue = [];
let isShowingAlert = false;

function showAnomalyAlert(anomaly) {
    alertQueue.push(anomaly);
    processAlertQueue();
}

function processAlertQueue() {
    if (isShowingAlert || alertQueue.length === 0) return;

    const anomaly = alertQueue.shift();
    isShowingAlert = true;

    // Create Toast
    const container = document.getElementById('sentinelAlerts');
    const toast = document.createElement('div');
    toast.className = `sentinel-toast toast-${anomaly.severity.toLowerCase()}`;

    // Icon based on severity
    const icon = anomaly.severity === 'CRITICAL' ? '⚠️' : '⚡';

    toast.innerHTML = `
        <div class="toast-icon" style="font-size: 1.5rem; margin-right: 15px;">${icon}</div>
        <div class="toast-content">
            <h4>${anomaly.type} ${anomaly.severity}</h4>
            <p>${anomaly.message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Update Status Indicator based on severity (CRITICAL takes precedence)
    updateSystemStatus(anomaly.severity);

    // Add to History Log
    addToHistoryLog(anomaly);

    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            toast.remove();
            isShowingAlert = false;
            processAlertQueue(); // Show next

            // Revert status if queue empty (simplified logic: reset to normal after alert clears)
            // In a real app, you'd check active state. For now, we blink back to normal if no new alerts.
            if (alertQueue.length === 0) {
                updateSystemStatus('NORMAL');
            }
        }, 300);
    }, 5000);
}

function addToHistoryLog(anomaly) {
    const list = document.getElementById('alertHistoryList');
    if (list.children[0] && list.children[0].classList.contains('text-muted')) {
        list.innerHTML = "";
    }

    const item = document.createElement('li');
    const time = new Date().toLocaleTimeString();
    const color = anomaly.severity === 'CRITICAL' ? 'text-danger' : 'text-warning';

    item.innerHTML = `<span class="text-muted">[${time}]</span> <span class="${color} fw-bold">${anomaly.type}:</span> ${anomaly.message}`;
    list.prepend(item); // Newest first
}

function updateSystemStatus(status) {
    const indicator = document.getElementById('systemStatusIndicator');
    const text = document.getElementById('systemStatusText');

    indicator.className = 'status-indicator'; // reset

    if (status === 'CRITICAL') {
        indicator.classList.add('status-critical');
        text.innerText = 'Critical';
        text.style.color = 'var(--danger-color)';
    } else if (status === 'WARNING') {
        indicator.classList.add('status-warning');
        text.innerText = 'Warning';
        text.style.color = 'var(--warning-color)';
    } else {
        indicator.classList.add('status-normal');
        text.innerText = 'Normal';
        text.style.color = 'var(--text-secondary)';
    }
}

connection.on("ReceiveStats", function (message) {
    try {
        const stats = JSON.parse(message);

        // Update Values with Tweening
        const cpuEl = document.getElementById('cpuValue');
        const memEl = document.getElementById('memValue');
        const netEl = document.getElementById('netInValue');

        cpuEl.dataset.unit = '%';
        memEl.dataset.unit = '%';
        netEl.dataset.unit = ' KB/s';

        animateValue(cpuEl, lastCpu, stats.cpu, 800);
        animateValue(memEl, lastMem, stats.memory, 800);
        animateValue(netEl, lastNet, stats.network_in, 800);

        lastCpu = stats.cpu;
        lastMem = stats.memory;
        lastNet = stats.network_in;

        // Update Charts
        updateChart(cpuChart, stats.cpu);
        updateChart(memChart, stats.memory);
        updateChart(netChart, stats.network_in);

        // Process Anomalies
        if (stats.anomalies && stats.anomalies.length > 0) {
            stats.anomalies.forEach(anomaly => {
                showAnomalyAlert(anomaly);
            });
        }

    } catch (e) {
        console.error("Error parsing stats:", e);
    }
});

connection.on("ReceiveProcesses", function (message) {
    try {
        const procs = JSON.parse(message);
        const tbody = document.querySelector("#processTable tbody");
        tbody.innerHTML = ""; // Clear existing

        if (procs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No process data available or Access Denied</td></tr>';
            return;
        }

        procs.forEach(p => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${p.pid}</td>
                <td>${p.name}</td>
                <td>${p.username || '-'}</td>
                <td class="text-end">${p.cpu_percent.toFixed(1)}%</td>
                <td class="text-end">${p.memory_percent.toFixed(1)}%</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-danger btn-kill" data-pid="${p.pid}" onclick="killProcess(${p.pid})">Kill</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        console.error("Error parsing processes:", e);
    }
});

connection.on("ReceiveDiskInfo", function (message) {
    try {
        const disks = JSON.parse(message);
        const container = document.getElementById("diskContainer");
        container.innerHTML = "";

        if (disks.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No disk info available</div>';
            return;
        }

        disks.forEach(d => {
            const item = document.createElement("div");
            item.className = "mb-3";

            // Color based on usage
            let colorClass = "bg-success";
            if (d.percent > 90) colorClass = "bg-danger";
            else if (d.percent > 75) colorClass = "bg-warning";

            item.innerHTML = `
                <div class="d-flex justify-content-between mb-1">
                    <span class="fw-bold">${d.device} <small class="text-muted">(${d.mountpoint})</small></span>
                    <span class="small">${d.percent}% Used</span>
                </div>
                <div class="progress" style="height: 10px;">
                    <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${d.percent}%"></div>
                </div>
                <div class="d-flex justify-content-end">
                    <small class="text-muted">${(d.free / 1024 / 1024 / 1024).toFixed(1)} GB Free / ${(d.total / 1024 / 1024 / 1024).toFixed(1)} GB Total</small>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        console.error("Error parsing disk info:", e);
    }
});

// killProcess function (Phase 3)
window.killProcess = function (pid) {
    if (!confirm(`Are you sure you want to KILL process ${pid}?`)) return;

    connection.invoke("KillProcess", pid).catch(function (err) {
        return console.error(err.toString());
    });
};

connection.on("ProcessKilled", function (pid, success, message) {
    if (success) {
        showAnomalyAlert({ type: "SYSTEM", severity: "WARNING", message: message });
    } else {
        showAnomalyAlert({ type: "ERROR", severity: "CRITICAL", message: message });
    }
});

connection.start().then(function () {
    console.log("Connected to SignalR Hub");
}).catch(function (err) {
    return console.error(err.toString());
});
