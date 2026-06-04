/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarWeekView extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarWeekView";
    static props = {
        patients: Array,
        weekDates: Array,
        onSelectSession: Function,
    };

    /** Formate "2026-06-02" → "Lun 2". */
    dayHeader(dateStr) {
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
    }

    /** Classe CSS du chip selon la couleur de la session. */
    chipClass(session) {
        const map = {
            blue: "dc-chip-blue", green: "dc-chip-green",
            orange: "dc-chip-orange", red: "dc-chip-red", gray: "dc-chip-gray",
        };
        return "dc-week-chip " + (map[session.color] || "dc-chip-blue");
    }

    /** Texte affiché dans le chip. */
    chipLabel(session) {
        if (session.alert_label) return `${session.station_name} \u00b7 ${session.alert_label}`;
        if (session.state === "done") return `${session.station_name} \u00b7 \u2713`;
        if (session.state === "running") return `${session.station_name} \u00b7 En cours`;
        // scheduled: affiche heure
        const h = this._fmtTime(session.date);
        return `${session.station_name} \u00b7 ${h}`;
    }

    _fmtTime(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr.replace(" ", "T") + "Z");
        return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
    }
}
