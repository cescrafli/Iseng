"use strict";

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/monitorHub")
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

    } catch (e) {
        console.error("Error parsing stats:", e);
    }
});

connection.start().then(function () {
    console.log("Connected to SignalR Hub");
}).catch(function (err) {
    return console.error(err.toString());
});
