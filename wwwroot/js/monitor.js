"use strict";

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/monitorHub")
    .build();

// Charts
let cpuChart_ctx = document.getElementById('cpuChart').getContext('2d');
let memChart_ctx = document.getElementById('memChart').getContext('2d');
let netChart_ctx = document.getElementById('netChart').getContext('2d');

const chartConfig = (label, color, bgColor) => ({
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: label,
            data: [],
            borderColor: color,
            backgroundColor: bgColor,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true
            }
        },
        scales: {
            x: {
                display: false,
                grid: { display: false }
            },
            y: {
                beginAtZero: true,
                grid: {
                    borderDash: [2, 4],
                    color: '#e9ecef'
                },
                ticks: {
                    color: '#6c757d',
                    font: { size: 11 }
                }
            }
        }
    }
});

let cpuChart = new Chart(cpuChart_ctx, chartConfig('CPU Usage (%)', '#007bff', 'rgba(0, 123, 255, 0.1)'));
let memChart = new Chart(memChart_ctx, chartConfig('Memory Usage (%)', '#28a745', 'rgba(40, 167, 69, 0.1)'));
let netChart = new Chart(netChart_ctx, chartConfig('Network In (KB/s)', '#17a2b8', 'rgba(23, 162, 184, 0.1)'));

const MAX_DATA_POINTS = 60; // 1 minute history

function updateChart(chart, value) {
    const now = new Date().toLocaleTimeString();
    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > MAX_DATA_POINTS) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}

connection.on("ReceiveStats", function (message) {
    try {
        const stats = JSON.parse(message);

        // Update Values
        document.getElementById('cpuValue').innerText = stats.cpu.toFixed(1) + '%';
        document.getElementById('memValue').innerText = stats.memory.toFixed(1) + '%';
        document.getElementById('netInValue').innerText = stats.network_in.toFixed(1) + ' KB/s';

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
