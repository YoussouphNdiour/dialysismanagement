/** @odoo-module **/
import { Component, useState } from "@odoo/owl";
import { NurseComplicationPopup } from "./NurseComplicationPopup";

export class NurseSessionForm extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseSessionForm";
    static components = { NurseComplicationPopup };
    static props = {
        procedure: Object,
        vitals: Array,
        timer: Object,
        onTimerReset: Function,
        onSaveVitals: Function,
        onSaveComplication: Function,
        onGoToEnd: Function,
        onBackToList: Function,
    };

    setup() {
        this.vitalsForm = useState({
            blood_pressure: '',
            heart_rate: '',
            respiratory_rate: '',
            spo2: '',
            temperature: '',
            glycemia: '',
        });
        this.popup = useState({ open: false });
        this.saving = useState({ vitals: false });
    }

    get timerDisplay() {
        const s = this.props.timer.secondsLeft;
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    get patientName() {
        const p = this.props.procedure.patient_id;
        return Array.isArray(p) ? p[1] : '—';
    }

    async saveVitals() {
        if (!this.vitalsForm.blood_pressure) return;
        this.saving.vitals = true;
        const vals = {
            blood_pressure: this.vitalsForm.blood_pressure,
            heart_rate: parseInt(this.vitalsForm.heart_rate) || 0,
            respiratory_rate: parseInt(this.vitalsForm.respiratory_rate) || 0,
            spo2: parseFloat(this.vitalsForm.spo2) || 0.0,
            temperature: parseFloat(this.vitalsForm.temperature) || 0.0,
            glycemia: parseFloat(this.vitalsForm.glycemia) || 0.0,
        };
        await this.props.onSaveVitals(vals);
        Object.assign(this.vitalsForm, { blood_pressure: '', heart_rate: '', respiratory_rate: '', spo2: '', temperature: '', glycemia: '' });
        this.saving.vitals = false;
    }

    async onComplicationSave(vals) {
        await this.props.onSaveComplication(vals);
        this.popup.open = false;
    }

    formatDatetime(dt) {
        if (!dt) return '—';
        return dt.slice(11, 16); // HH:MM
    }
}
