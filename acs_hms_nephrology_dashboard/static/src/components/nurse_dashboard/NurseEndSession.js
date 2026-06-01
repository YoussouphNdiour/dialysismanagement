/** @odoo-module **/
import { Component, useState } from "@odoo/owl";

export class NurseEndSession extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseEndSession";
    static props = {
        procedure: Object,
        vitals: Array,
        onValidateSession: Function,
        onBackToSession: Function,
    };

    setup() {
        this.form = useState({
            departure_weight: this.props.procedure.departure_weight || '',
            actual_duration: this.props.procedure.actual_duration || '',
            global_tolerance: this.props.procedure.global_tolerance || '',
            end_notes: this.props.procedure.end_notes || '',
        });
        this.validated = useState({ done: false });
        this.saving = useState({ pending: false });
    }

    get patientName() {
        const p = this.props.procedure.patient_id;
        return Array.isArray(p) ? p[1] : '—';
    }

    get actualUfPreview() {
        const dw = parseFloat(this.form.departure_weight);
        const aw = this.props.procedure.arrival_weight || 0;
        if (dw && aw && aw > dw) {
            return Math.round((aw - dw) * 1000);
        }
        return null;
    }

    get ktvBadgeClass() {
        const status = this.props.procedure.ktv_status;
        if (status === 'adequate') return 'badge bg-success fs-6';
        if (status === 'insufficient') return 'badge bg-danger fs-6';
        return 'badge bg-secondary fs-6';
    }

    get ktvLabel() {
        const status = this.props.procedure.ktv_status;
        if (status === 'adequate') return 'Adéquat ≥ 1.2';
        if (status === 'insufficient') return 'Insuffisant < 1.2';
        return '—';
    }

    async onValidate() {
        if (!this.form.departure_weight || !this.form.global_tolerance) return;
        this.saving.pending = true;
        const vals = {
            departure_weight: parseFloat(this.form.departure_weight),
            global_tolerance: this.form.global_tolerance,
            end_notes: this.form.end_notes || false,
            state: 'done',
        };
        if (this.form.actual_duration) {
            vals.actual_duration = parseFloat(this.form.actual_duration);
        }
        await this.props.onValidateSession(vals);
        this.validated.done = true;
        this.saving.pending = false;
    }
}
