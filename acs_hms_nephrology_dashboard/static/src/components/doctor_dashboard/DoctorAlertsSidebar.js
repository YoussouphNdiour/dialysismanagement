/** @odoo-module **/
import { Component } from "@odoo/owl";

export class DoctorAlertsSidebar extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorAlertsSidebar";
    static props = {
        kpis: Object,
        alerts: Array,
        alertFilter: { optional: true },
        onAlertFilter: Function,
        onSelectStation: Function,
    };

    get ktvClass() {
        return (this.props.kpis.avg_ktv || 0) >= 1.2 ? "kpi-ok" : "kpi-warn";
    }

    onFilterCritical() {
        this.props.onAlertFilter(this.props.alertFilter === "critical" ? null : "critical");
    }

    onFilterWarning() {
        this.props.onAlertFilter(this.props.alertFilter === "warning" ? null : "warning");
    }
}
