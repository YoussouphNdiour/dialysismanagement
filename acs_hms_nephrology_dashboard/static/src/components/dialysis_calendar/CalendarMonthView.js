/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarMonthView extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarMonthView";
    static props = {
        monthData: Object,
        currentDate: { type: Date },
        onSelectDay: Function,
    };

    /**
     * Retourne un tableau de 42 cellules (6 semaines × 7 jours) pour la grille du mois.
     * Chaque cellule : { date: "YYYY-MM-DD", otherMonth: Boolean }
     */
    get calendarGrid() {
        const d = this.props.currentDate;
        const year = d.getFullYear();
        const month = d.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        // Lundi=0 ... Dimanche=6
        const firstDow = (firstDay.getDay() + 6) % 7;

        const cells = [];
        for (let i = 0; i < firstDow; i++) {
            const prev = new Date(firstDay);
            prev.setDate(prev.getDate() - (firstDow - i));
            cells.push({ date: prev.toISOString().slice(0, 10), otherMonth: true });
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dt = new Date(year, month, i);
            cells.push({ date: dt.toISOString().slice(0, 10), otherMonth: false });
        }
        const remaining = 42 - cells.length;
        for (let i = 1; i <= remaining; i++) {
            const next = new Date(lastDay);
            next.setDate(next.getDate() + i);
            cells.push({ date: next.toISOString().slice(0, 10), otherMonth: true });
        }
        return cells;
    }

    /** Retourne les stats du jour depuis monthData.days, ou des zéros si absent. */
    dayStats(dateStr) {
        const days = this.props.monthData?.days || [];
        return days.find(d => d.date === dateStr) || {
            session_count: 0, occupation_rate: 0, critical_count: 0, warning_count: 0,
        };
    }

    isToday(dateStr) {
        return dateStr === new Date().toISOString().slice(0, 10);
    }

    barClass(rate) {
        if (rate >= 80) return "dc-bar-green";
        if (rate >= 50) return "dc-bar-orange";
        return "dc-bar-red";
    }

    dayNum(dateStr) {
        return parseInt(dateStr.split("-")[2], 10);
    }
}
