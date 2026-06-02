/** @odoo-module **/
import { Component, useRef, onMounted, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class DoctorStatsChart extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorStatsChart";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.canvasRef = useRef("ktv_canvas");
        this.state = useState({ loading: true, adequateRate: 0, avgKtv: 0, totalSessions: 0 });
        onMounted(() => this._load());
    }

    async _load() {
        const data = await this.orm.call("acs.dialysis.station", "get_ktv_chart_data", []);
        this.state.loading = false;

        const vals = data.values || [];
        this.state.totalSessions = vals.length;
        this.state.avgKtv = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        this.state.adequateRate = vals.length
            ? Math.round((vals.filter((v) => v >= 1.2).length / vals.length) * 100)
            : 0;

        this._renderChart(data.labels || [], vals);
    }

    _renderChart(labels, values) {
        const canvas = this.canvasRef.el;
        if (!canvas || !window.Chart) return;

        new window.Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "KT/V moyen",
                        data: values,
                        borderColor: "#4e9af1",
                        backgroundColor: "rgba(78,154,241,0.08)",
                        tension: 0.3,
                        fill: true,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                    },
                    {
                        label: "Seuil 1.2",
                        data: labels.map(() => 1.2),
                        borderColor: "#f59e0b",
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        min: 0,
                        max: 2.5,
                        grid: { color: "#1f2937" },
                        ticks: { color: "#6b7280" },
                    },
                    x: {
                        grid: { color: "#1f293755" },
                        ticks: { color: "#6b7280", maxTicksLimit: 10 },
                    },
                },
                plugins: {
                    legend: { labels: { color: "#9ca3af", boxWidth: 12 } },
                    tooltip: { backgroundColor: "#1f2937", titleColor: "#e5e7eb", bodyColor: "#9ca3af" },
                },
            },
        });
    }
}
