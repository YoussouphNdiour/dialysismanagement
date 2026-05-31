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
    let intensity = Math.min(maxValue / threshold, 1);
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

    chartContainer.innerHTML = "";

    const result = await dataMethod();

    if (!result || !result.labels?.length) {
        const messageEl = document.createElement("div");
        messageEl.className = "no-data-message";
        messageEl.style.textAlign = "center";
        messageEl.style.padding = "20px";
        messageEl.style.color = "#888";
        messageEl.style.fontStyle = "italic";
        messageEl.textContent = `Aucune donnée disponible pour ${options.label || "ce graphique"}`;
        chartContainer.appendChild(messageEl);
        return;
    }

    const { labels, data, tooltiptext = [], full_dates = [], units = [], field_label = "", field_name = "" } = result;

    const canvasEl = document.createElement("canvas");
    chartContainer.appendChild(canvasEl);
    const ctx = canvasEl.getContext("2d");

    let baseColor = options.color || "#2196F3";
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
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
                x: {
                    ticks: {
                        maxRotation: rotateLabels ? 45 : 0,
                        minRotation: rotateLabels ? 45 : 0,
                    },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: options.beginAtZero !== false,
                    grid: { color: "rgba(0,0,0,0.05)" },
                },
            },
            plugins: {
                legend: { display: true, position: "top" },
                tooltip: {
                    callbacks: {
                        title: (ctx) => full_dates[ctx[0].dataIndex] || labels[ctx[0].dataIndex],
                        label: (ctx) => {
                            const value = ctx.parsed.y;
                            const unit = units[ctx.dataIndex] || "";
                            const tooltip = tooltiptext[ctx.dataIndex] || field_label;
                            return `${tooltip}: ${value} ${unit}`;
                        },
                    },
                },
            },
        },
    };

    const chart = new Chart(ctx, config);
    chartRegistry[chartContainer.id] = chart;
}

// Hematology Charts
export async function acsRenderGBChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("gb", null, domain), {
        label: "GB (Globules Blancs)",
        color: color || "#FF6384",
        threshold: 20,
    });
}

export async function acsRenderHBChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("hb", null, domain), {
        label: "HB (Hémoglobine)",
        color: color || "#36A2EB",
        threshold: 20,
    });
}

export async function acsRenderPLTChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("plt", null, domain), {
        label: "PLT (Plaquettes)",
        color: color || "#FFCE56",
        threshold: 500,
    });
}

export async function acsRenderCRPChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("crp", null, domain), {
        label: "CRP",
        color: color || "#4BC0C0",
        threshold: 100,
    });
}

// Kidney Function Charts
export async function acsRenderUreeChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("uree", null, domain), {
        label: "Urée",
        color: color || "#9966FF",
        threshold: 10,
    });
}

export async function acsRenderCreatChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("creat", null, domain), {
        label: "Créatinine",
        color: color || "#FF9F40",
        threshold: 200,
    });
}

export async function acsRenderDFGChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("dfg_mdrd", null, domain), {
        label: "DFG (MDRD)",
        color: color || "#FF6384",
        threshold: 120,
    });
}

// Electrolytes Charts
export async function acsRenderSodiumChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("sodium", null, domain), {
        label: "Sodium",
        color: color || "#36A2EB",
        threshold: 200,
    });
}

export async function acsRenderPotassiumChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("potassium", null, domain), {
        label: "Potassium",
        color: color || "#FFCE56",
        threshold: 10,
    });
}

// Lipid Profile Charts
export async function acsRenderHDLChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("hdl", null, domain), {
        label: "HDL",
        color: color || "#4BC0C0",
        threshold: 3,
    });
}

export async function acsRenderLDLChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("ldl", null, domain), {
        label: "LDL",
        color: color || "#9966FF",
        threshold: 5,
    });
}

// Liver Function Charts
export async function acsRenderALATChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("alat", null, domain), {
        label: "ALAT",
        color: color || "#FF9F40",
        threshold: 100,
    });
}

export async function acsRenderASATChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("asat", null, domain), {
        label: "ASAT",
        color: color || "#FF6384",
        threshold: 100,
    });
}

// Minerals and Vitamins Charts
export async function acsRenderCalciumChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("calcium", null, domain), {
        label: "Calcium",
        color: color || "#36A2EB",
        threshold: 3,
    });
}

export async function acsRenderPTHiChart(container, domain, backendData, color) {
    await acsLineChartValue(container, () => backendData.getBiologieGraphData("pthi", null, domain), {
        label: "PTHi",
        color: color || "#FFCE56",
        threshold: 1000,
    });
}
