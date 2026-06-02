/** @odoo-module **/
import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class DoctorPatientPanel extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorPatientPanel";
    static props = {
        panelData: Object,
        onClose: Function,
    };

    setup() {
        this.action = useService("action");
    }

    get procedure() { return this.props.panelData.procedure; }
    get patient() { return this.props.panelData.patient; }
    get prevSession() { return this.props.panelData.previous_session; }

    fmt(hours) {
        if (!hours) return "—";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h${String(m).padStart(2, "0")}`;
    }

    openFullRecord() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "acs.patient.procedure",
            res_id: this.procedure.id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    openPrescription() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hms.prescription",
            views: [[false, "form"]],
            target: "new",
            context: { default_patient_id: this.patient.id },
        });
    }

    openHistory() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: `Historique — ${this.patient.name}`,
            res_model: "acs.patient.procedure",
            views: [[false, "list"], [false, "form"]],
            domain: [
                ["patient_id", "=", this.patient.id],
                ["department_id.department_type", "=", "nephrology"],
            ],
            target: "current",
        });
    }

    scheduleAppointment() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hms.appointment",
            views: [[false, "form"]],
            target: "new",
            context: { default_patient_id: this.patient.id },
        });
    }
}
