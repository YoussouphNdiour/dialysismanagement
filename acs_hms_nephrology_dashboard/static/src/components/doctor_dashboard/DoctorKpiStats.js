/** @odoo-module **/
import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class DoctorKpiStats extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorKpiStats";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.state = useState({ loading: true, data: null });
        onMounted(() => this._load());
    }

    async _load() {
        try {
            const data = await this.orm.call(
                "acs.dialysis.station", "get_kpi_stats_data", []
            );
            this.state.data = data;
        } catch (e) {
            console.error("KPI load error", e);
        } finally {
            this.state.loading = false;
        }
    }

    get deltaLabel() {
        const d = this.state.data && this.state.data.sessions_delta;
        if (!d) return "";
        return d > 0 ? `▲ +${d} vs mois précédent` : `▼ ${d} vs mois précédent`;
    }

    get deltaClass() {
        const d = this.state.data && this.state.data.sessions_delta;
        if (!d) return "";
        return d > 0 ? "dd-kpi-delta-up" : "dd-kpi-delta-down";
    }
}
