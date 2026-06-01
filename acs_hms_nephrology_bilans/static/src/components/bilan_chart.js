/** @odoo-module **/

import { Component, useState, onWillStart, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

/**
 * BilanChartWidget — affiche l'evolution d'un parametre biologique sur 12 mois
 * Utilise comme widget sur la fiche patient dans l'onglet Bilans
 */
export class BilanChartWidget extends Component {
    static template = "acs_hms_nephrology_bilans.BilanChart";
    static props = {
        patientId: { type: Number },
        parameter: { type: String },    // 'hemoglobin', 'potassium', 'phosphorus', 'albumin', 'pth'
        label: { type: String },
        unit: { type: String },
        targetMin: { type: Number, optional: true },
        targetMax: { type: Number, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.canvasRef = useRef("canvas");
        this.state = useState({ loading: true, data: [], labels: [] });

        onWillStart(async () => {
            await this._loadData();
        });
    }

    async _loadData() {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const bilans = await this.orm.searchRead(
            "acs.nephro.bilan",
            [
                ["patient_id", "=", this.props.patientId],
                ["exam_date", ">=", twelveMonthsAgo.toISOString()],
            ],
            ["exam_date", this.props.parameter],
            { order: "exam_date asc", limit: 24 }
        );

        this.state.labels = bilans.map((b) => {
            const d = new Date(b.exam_date);
            return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        });
        this.state.data = bilans.map((b) => b[this.props.parameter] || null);
        this.state.loading = false;

        // Rendu Chart.js apres le prochain tick
        setTimeout(() => this._renderChart(), 50);
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
        if (this.props.targetMin) {
            datasets.push({
                label: `Cible min (${this.props.targetMin})`,
                data: new Array(this.state.labels.length).fill(this.props.targetMin),
                borderColor: "#2E7D32",
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
            });
        }

        // Ligne cible max (pointillee orange)
        if (this.props.targetMax) {
            datasets.push({
                label: `Cible max (${this.props.targetMax})`,
                data: new Array(this.state.labels.length).fill(this.props.targetMax),
                borderColor: "#E65100",
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
            });
        }

        // Chart.js est disponible dans Odoo via /web/static/lib/Chart/Chart.js
        new Chart(canvas, {
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
