/** @odoo-module **/
import { Component } from "@odoo/owl";

export class DoctorStationCard extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorStationCard";
    static props = {
        station: Object,
        onSelect: Function,
    };

    get cardClass() {
        const proc = this.props.station.procedure;
        if (!proc) return "dsc-libre";
        if (proc.alert_level === "critical") return "dsc-critical";
        if (proc.alert_level === "warning") return "dsc-warning";
        const map = { running: "dsc-running", done: "dsc-done", cancel: "dsc-absent", scheduled: "dsc-scheduled" };
        return map[proc.state] || "";
    }

    get badgeClass() {
        const proc = this.props.station.procedure;
        if (!proc) return "dsc-badge-libre";
        if (proc.alert_level === "critical") return "dsc-badge-critical";
        if (proc.alert_level === "warning") return "dsc-badge-warning";
        const map = { running: "dsc-badge-running", done: "dsc-badge-done", cancel: "dsc-badge-absent", scheduled: "dsc-badge-scheduled" };
        return map[proc.state] || "";
    }

    get badgeLabel() {
        const proc = this.props.station.procedure;
        if (!proc) return "Libre";
        if (proc.alert_level === "critical") return "🔴 ALERTE";
        if (proc.alert_level === "warning") return "⚠ ATTENTION";
        const labels = { running: "En cours", done: "Terminé", scheduled: "Prévu", cancel: "Absent" };
        return labels[proc.state] || proc.state;
    }

    /** Durée écoulée en heures (temps réel pour running, actual_duration pour done). */
    get elapsedHours() {
        const proc = this.props.station.procedure;
        if (!proc) return 0;
        if (proc.state === "done") return proc.actual_duration || 0;
        if (proc.state === "running" && proc.date) {
            // proc.date est UTC "YYYY-MM-DD HH:MM:SS"
            const start = new Date(proc.date.replace(" ", "T") + "Z");
            return Math.max(0, (Date.now() - start.getTime()) / 3600000);
        }
        return 0;
    }

    get progressStyle() {
        const proc = this.props.station.procedure;
        if (!proc || !proc.expected_duration) return "width: 0%";
        const pct = Math.min(100, Math.round((this.elapsedHours / proc.expected_duration) * 100));
        return `width: ${pct}%`;
    }

    get elapsedFormatted() { return this._fmt(this.elapsedHours); }
    get expectedFormatted() {
        const proc = this.props.station.procedure;
        return proc ? this._fmt(proc.expected_duration) : "—";
    }

    get ktvClass() {
        const s = this.props.station.procedure?.ktv_status;
        return s === "adequate" ? "ktv-ok" : s === "insufficient" ? "ktv-low" : "";
    }

    _fmt(hours) {
        if (!hours) return "—";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h${String(m).padStart(2, "0")}`;
    }

    onClick() {
        const proc = this.props.station.procedure;
        if (proc) this.props.onSelect(proc.id);
    }
}
