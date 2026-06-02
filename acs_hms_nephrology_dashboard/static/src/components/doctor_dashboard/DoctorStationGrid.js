/** @odoo-module **/
import { Component } from "@odoo/owl";
import { DoctorStationCard } from "./DoctorStationCard";

export class DoctorStationGrid extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorStationGrid";
    static components = { DoctorStationCard };
    static props = {
        stations: Array,
        alertFilter: { optional: true },
        onSelectStation: Function,
    };

    get filteredStations() {
        const { stations, alertFilter } = this.props;
        if (!alertFilter) return stations;
        return stations.filter(
            (s) => s.procedure && s.procedure.alert_level === alertFilter
        );
    }
}
