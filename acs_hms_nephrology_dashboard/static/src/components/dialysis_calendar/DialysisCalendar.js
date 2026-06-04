/** @odoo-module **/
import { Component, useState, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarMonthView } from "./CalendarMonthView";
import { DoctorPatientPanel } from "../doctor_dashboard/DoctorPatientPanel";

export class DialysisCalendar extends Component {
    static template = "acs_hms_nephrology_dashboard.DialysisCalendar";
    static components = {
        CalendarToolbar, CalendarDayView, CalendarWeekView, CalendarMonthView, DoctorPatientPanel,
    };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            mode: "day",
            currentDate: new Date(),
            stations: [],       // Mode Jour : [{id, name, sessions:[...]}, ...]
            weekData: null,     // Mode Semaine : {week_dates, patients}
            monthData: null,    // Mode Mois : {days, total_stations, month_avg_occupation}
            showPanel: false,
            panelData: null,
            occupationRate: 0,
            loading: false,
        });

        useEffect(() => {
            this._fetchData();
        }, () => [this.state.mode, this._dateStr()]);
    }

    /** Date ISO "YYYY-MM-DD" du jour courant. */
    _dateStr() {
        return this.state.currentDate.toISOString().slice(0, 10);
    }

    async _fetchData() {
        this.state.loading = true;
        try {
            const { mode } = this.state;
            if (mode === "day") {
                const data = await this.orm.call(
                    "acs.dialysis.station", "get_calendar_day_data", [this._dateStr()]
                );
                this.state.stations = data.stations;
                this.state.occupationRate = data.occupation_rate;
            } else if (mode === "week") {
                const data = await this.orm.call(
                    "acs.dialysis.station", "get_calendar_week_data", [this._dateStr()]
                );
                this.state.weekData = data;
                this.state.occupationRate = 0;
            } else {
                const d = this.state.currentDate;
                const data = await this.orm.call(
                    "acs.dialysis.station", "get_calendar_month_data",
                    [d.getFullYear(), d.getMonth() + 1]
                );
                this.state.monthData = data;
                this.state.occupationRate = data.month_avg_occupation;
            }
        } finally {
            this.state.loading = false;
        }
    }

    onModeChange(mode) {
        this.state.mode = mode;
    }

    onNavigate(dir) {
        const d = new Date(this.state.currentDate);
        if (this.state.mode === "day") d.setDate(d.getDate() + dir);
        else if (this.state.mode === "week") d.setDate(d.getDate() + dir * 7);
        else d.setMonth(d.getMonth() + dir);
        this.state.currentDate = d;
    }

    onToday() {
        this.state.currentDate = new Date();
    }

    async onSelectSession(procedureId) {
        const data = await this.orm.call(
            "acs.dialysis.station", "get_patient_panel_data", [procedureId]
        );
        this.state.panelData = data;
        this.state.showPanel = true;
    }

    onClosePanel() {
        this.state.showPanel = false;
        this.state.panelData = null;
    }

    onSelectDay(dateStr) {
        this.state.currentDate = new Date(dateStr + "T00:00:00");
        this.state.mode = "day";
    }
}

registry.category("actions").add("acs_dialysis_calendar", DialysisCalendar);
