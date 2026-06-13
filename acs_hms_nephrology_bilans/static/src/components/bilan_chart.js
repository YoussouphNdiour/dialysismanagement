/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, onWillUnmount, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

/**
 * BilanChartWidget — affiche l'evolution d'un parametre biologique sur 12 mois
 * Utilise comme widget sur la fiche patient dans l'onglet Bilans
 */
export class BilanChartWidget extends Component {
    static template = "acs_hms_nephrology_bilans.BilanChart";
    static props = {
        patient_id: { type: Number },
        parameter: { type: String },    // 'hemoglobin', 'potassium', 'phosphorus', 'albumin', 'pth'
        label: { type: String },
        unit: { type: String },
        target_min: { type: Number, optional: true },
        target_max: { type: Number, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.canvasRef = useRef("canvas");
        this.state = useState({ loading: true, data: [], labels: [] });

        onWillStart(async () => {
            await this._loadData();
        });
        onMounted(() => this._renderChart());
        onWillUnmount(() => {
            if (this._chart) this._chart.destroy();
        });
    }

    async _loadData() {
        if (!this.props.parameter) return;

        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const dateStr = twelveMonthsAgo.toISOString().split("T")[0];
        const fields = ["exam_date", this.props.parameter].filter(Boolean);
        const bilans = await this.orm.searchRead(
            "acs.nephro.bilan",
            [
                ["patient_id", "=", this.props.patient_id],
                ["exam_date", ">=", dateStr],
            ],
            fields,
            { order: "exam_date asc", limit: 24 }
        );

        this.state.labels = bilans.map((b) => {
            const d = new Date(b.exam_date);
            return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        });
        this.state.data = bilans.map((b) => {
            const val = b[this.props.parameter];
            return val !== undefined && val !== false ? val : null;
        });
        this.state.loading = false;
    }

    _renderChart() {
        const canvas = this.canvasRef.el;
        if (!canvas || !this.state.data.length) return;

        const datasets = [
            {
                label: `${this.props.label} (${this.props.unit})`,
                data: this.state.data,
                borderColor: "#1565C0",
                backgroundColor: "rgba(21, 101, 192, 0.1)",
                tension: 0.3,
                fill: true,
                pointRadius: 5,
            },
        ];

        // Ligne cible min (pointillee verte)
        if (this.props.target_min) {
            datasets.push({
                label: `Cible min (${this.props.target_min})`,
                data: new Array(this.state.labels.length).fill(this.props.target_min),
                borderColor: "#2E7D32",
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
            });
        }

        // Ligne cible max (pointillee orange)
        if (this.props.target_max) {
            datasets.push({
                label: `Cible max (${this.props.target_max})`,
                data: new Array(this.state.labels.length).fill(this.props.target_max),
                borderColor: "#E65100",
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
            });
        }

        // Chart.js est disponible dans Odoo via /web/static/lib/Chart/Chart.js
        if (this._chart) this._chart.destroy();
        this._chart = new Chart(canvas, {
            type: "line",
            data: { labels: this.state.labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    title: {
                        display: true,
                        text: `Evolution - ${this.props.label} (12 mois)`,
                    },
                },
                scales: {
                    y: { beginAtZero: false },
                },
            },
        });
    }
}

// Enregistrement comme widget de vue de liste/form
registry.category("view_widgets").add("bilan_chart", {
    component: BilanChartWidget,
});
