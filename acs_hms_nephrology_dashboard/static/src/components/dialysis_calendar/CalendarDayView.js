/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarDayView extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarDayView";
    static props = {
        stations: Array,
        onSelectSession: Function,
    };

    /** Heures affichées sur l'axe temps : 6h → 19h. */
    get timeSlots() {
        const slots = [];
        for (let h = 6; h <= 19; h++) slots.push(h);
        return slots;
    }

    /** Style CSS positionné pour une carte séance (top + height en px). */
    cardStyle(session) {
        const SLOT_PX = 48;
        const startH = this._startHour(session);
        const durH = this._durationHours(session);
        const top = Math.max(0, (startH - 6) * SLOT_PX);
        const height = Math.max(durH * SLOT_PX - 6, 24);
        return `top:${top}px;height:${height}px;`;
    }

    /** Classe CSS de couleur pour une carte séance. */
    cardClass(session) {
        const map = {
            blue: "dc-card-blue", green: "dc-card-green",
            orange: "dc-card-orange", red: "dc-card-red", gray: "dc-card-gray",
        };
        return "dc-session-card " + (map[session.color] || "dc-card-blue");
    }

    /** Label du badge d'état/alerte affiché sur la carte. */
    badgeLabel(session) {
        if (session.alert_label) return session.alert_label;
        const map = { scheduled: "Planifiée", running: "En cours", done: "✓ Terminée" };
        return map[session.state] || session.state;
    }

    /** Formate "YYYY-MM-DD HH:MM:SS" en "HHhMM". */
    fmtTime(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr.replace(" ", "T") + "Z");
        return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
    }

    _startHour(session) {
        if (!session.date) return 6;
        const d = new Date(session.date.replace(" ", "T") + "Z");
        return d.getHours() + d.getMinutes() / 60;
    }

    _durationHours(session) {
        if (!session.date || !session.date_stop) return 4;
        const start = new Date(session.date.replace(" ", "T") + "Z");
        const stop = new Date(session.date_stop.replace(" ", "T") + "Z");
        return Math.max(0.5, (stop - start) / 3600000);
    }
}
