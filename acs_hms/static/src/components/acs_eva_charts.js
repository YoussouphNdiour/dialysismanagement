/** @odoo-module **/

import { loadJS } from "@web/core/assets";

let chartJsReady = null;
const chartRegistry = {};

async function acsEnsureChartJs() {
    if (!chartJsReady) {
        chartJsReady = loadJS("/web/static/lib/Chart/Chart.js");
    }
    await chartJsReady;
}

function acsHexToRgb(hex) {
    hex = hex.replace("#", "");
    let bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return `${r},${g},${b}`;
}

function acsMakeDynamicGradient(ctx, data, baseColor, threshold = 50) {
    const maxValue = Math.max(...data);
    let intensity = Math.min(maxValue / threshold, 1); // scale 0 -> 1
    const rgb = acsHexToRgb(baseColor);

    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, `rgba(${rgb},${0.2 + 0.6 * intensity})`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);

    return gradient;
}

async function acsLineChartValue(chartContainer, dataMethod, options = {}) {
    await acsEnsureChartJs();

    if (typeof chartContainer === "string") {
        chartContainer = document.getElementById(chartContainer);
    }
    if (!chartContainer) {
        console.warn("Chart container not found.");
        return;
    }

    if (chartRegistry[chartContainer.id]) {
        chartRegistry[chartContainer.id].destroy();
        delete chartRegistry[chartContainer.id];
    }

    // Clear old canvas/message
    chartContainer.innerHTML = "";

    const result = await dataMethod();

    if (!result || !result.labels?.length) {
        //MKA: Remove existing message if already present
        const existing = chartContainer.querySelector(".no-data-message");
        if (existing) existing.remove();

        //MKA: Show message if no data
        const messageEl = document.createElement("div");
        messageEl.className = "no-data-message";
        messageEl.style.textAlign = "center";
        messageEl.style.padding = "20px";
        messageEl.style.color = "#888";
        messageEl.style.fontStyle = "italic";
        messageEl.textContent = `No data available for ${options.label || "this chart"}`;
        chartContainer.appendChild(messageEl);

        console.warn(`No data returned for chart in '${chartContainer.id}'`);
        return;
    }

    const { labels, data, tooltiptext = [], full_dates = [], units = [], field_label = "", field_name = "" } = result;

    const canvasEl = document.createElement("canvas");
    chartContainer.appendChild(canvasEl);
    const ctx = canvasEl.getContext("2d");

    let baseColor = options.color || "#985184";
    let gradient = acsMakeDynamicGradient(ctx, data, baseColor, options.threshold || 50);
    const rotateLabels = labels.length >= 10;
    
    const config = {
        type: options.type || "line",
        data: {
            labels,
            datasets: [{
                label: field_label || options.label || "Chart",
                data,
                borderColor: baseColor,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointBackgroundColor: "#fff",
                pointBorderColor: baseColor,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    intersect: false,
                    mode: "index",
                    callbacks: {
                        title: function (context) {
                            const idx = context[0].dataIndex;
                            return full_dates[idx] || context[0].label;
                        },
                        label: function (context) {
                            const idx = context.dataIndex;
                            const val = context.parsed.y;
                            const unit = units[idx] || "";

                            let displayVal = val;
                            if (field_label == "Body Mass Index" && typeof val === "number") {
                                displayVal = val.toFixed(2);
                            }
                            return `${tooltiptext[idx] || field_label}: ${displayVal} ${unit}`;
                        },
                    },
                },
            },
            scales: {
                y: { beginAtZero: true },
                x: {
                    ticks: {
                        autoSkip: true,
                        maxRotation: rotateLabels ? 90 : 0,
                        minRotation: rotateLabels ? 90 : 0,
                    }
                }
            }
        }
    };
    chartRegistry[chartContainer.id] = new Chart(ctx, config);
}

export async function acsRenderWeightChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("weight", "acs_weight_name", domain),
        { label: "Weight", color: evaluationChartColor || "#985184", threshold: 100 }
    );
}

export async function acsRenderHeightChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("height", "acs_height_name", domain),
        { label: "Height", color: evaluationChartColor || "#985184", threshold: 250 }
    );
}

export async function acsRenderTempChart(container, domain, chartBackendData, evaluationChartColor) {
    return acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("temp", "acs_temp_name", domain),
        { label: "Temperature", color: evaluationChartColor || "#985184", threshold: 50 }
    );
}

export async function acsRenderHeartRateChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("hr", "bpm", domain),
        { label: "Heart Rate", color: evaluationChartColor || "#985184", threshold: 180 }
    );
}

export async function acsRenderRespirationRateChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("rr", "breaths/min", domain),
        { label: "Respiration Rate", color: evaluationChartColor || "#985184", threshold: 40 }
    );
}

export async function acsRenderBmiChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("bmi", "bmi_state", domain),
        { label: "BMI", color: evaluationChartColor || "#985184", threshold: 100 }
    );
}

export async function acsRenderSystolicBPChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("systolic_bp", "mmHg", domain),
        { label: "Systolic BP", color: evaluationChartColor || "#985184", threshold: 200 }
    );
}

export async function acsRenderDiastolicBPChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("diastolic_bp", "mmHg", domain),
        { label: "Diastolic BP", color: evaluationChartColor || "#985184", threshold: 120 }
    );
}

export async function acsRenderSpO2Chart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("spo2", "acs_spo2_name", domain),
        { label: "SpO2", color: evaluationChartColor || "#985184", threshold: 100 }
    );
}

export async function acsRenderRBSChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("rbs", "acs_rbs_name", domain),
        { label: "Blood Sugar", color: evaluationChartColor || "#985184", threshold: 200 }
    );
}

export async function acsRenderHeadChart(container, domain, chartBackendData, evaluationChartColor) {
    await acsLineChartValue(
        container,
        () => chartBackendData.getEvolutionGraphData("head_circum", "acs_head_circum_name", domain),
        { label: "Head Circumference", color: evaluationChartColor || "#985184", threshold: 200 }
    );
}