/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarToolbar extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarToolbar";
    static props = {
        mode: String,
        currentDate: { type: Date },
        occupationRate: Number,
        onModeChange: Function,
        onNavigate: Function,
        onToday: Function,
    };

    get dateLabel() {
        const d = this.props.currentDate;
        const locale = "fr-FR";
        if (this.props.mode === "day") {
            return d.toLocaleDateString(locale, {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
        }
        if (this.props.mode === "week") {
            const monday = this._monday(d);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            const fmt = (dt) =>
                dt.toLocaleDateString(locale, { day: "numeric", month: "long" });
            return `Semaine du ${fmt(monday)} au ${fmt(sunday)} ${sunday.getFullYear()}`;
        }
        return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
    }

    get occBadgeClass() {
        const r = this.props.occupationRate;
        if (r >= 80) return "dc-occ-badge dc-occ-green";
        if (r >= 50) return "dc-occ-badge dc-occ-orange";
        return "dc-occ-badge dc-occ-red";
    }

    _monday(d) {
        const m = new Date(d);
        const day = m.getDay(); // 0=Sun
        m.setDate(m.getDate() + (day === 0 ? -6 : 1 - day));
        return m;
    }
}
