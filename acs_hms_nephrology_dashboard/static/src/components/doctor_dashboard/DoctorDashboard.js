/** @odoo-module **/
import { Component, useState, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { DoctorAlertsSidebar } from "./DoctorAlertsSidebar";
import { DoctorStationGrid } from "./DoctorStationGrid";
import { DoctorPatientPanel } from "./DoctorPatientPanel";
import { DoctorStatsChart } from "./DoctorStatsChart";

export class DoctorDashboard extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorDashboard";
    static components = { DoctorAlertsSidebar, DoctorStationGrid, DoctorPatientPanel, DoctorStatsChart };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            tab: "grid",
            stations: [],
            kpis: {
                total_sessions: 0, running_sessions: 0, done_sessions: 0,
                occupation_rate: 0, avg_ktv: 0, complication_count: 0,
                critical_alerts: 0, warning_alerts: 0,
            },
            alerts: [],
            showPanel: false,
            panelData: null,
            alertFilter: null,
        });

        this._loadDashboard();

        useEffect(() => {
            const id = setInterval(() => this._loadDashboard(), 30000);
            return () => clearInterval(id);
        }, () => []);
    }

    async _loadDashboard() {
        const data = await this.orm.call("acs.dialysis.station", "get_dashboard_data", []);
        this.state.stations = data.stations;
        this.state.kpis = data.kpis;
        this.state.alerts = data.alerts;
    }

    async onSelectStation(procedureId) {
        const data = await this.orm.call("acs.dialysis.station", "get_patient_panel_data", [procedureId]);
        this.state.panelData = data;
        this.state.showPanel = true;
    }

    onClosePanel() {
        this.state.showPanel = false;
        this.state.panelData = null;
    }

    onAlertFilter(level) {
        this.state.alertFilter = level;
        this.state.tab = "grid";
    }

    setTab(tab) {
        this.state.tab = tab;
        this.state.alertFilter = null;
    }

    fmtDur(hours) {
        if (!hours) return "—";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h${String(m).padStart(2, "0")}`;
    }
}

registry.category("actions").add("acs_doctor_dashboard", DoctorDashboard);
