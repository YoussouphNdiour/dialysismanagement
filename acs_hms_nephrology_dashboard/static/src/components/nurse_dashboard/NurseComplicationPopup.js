/** @odoo-module **/
import { Component, useState } from "@odoo/owl";

const COMPLICATION_TYPES = [
    { value: 'hypotension',  label: 'Hypotension' },
    { value: 'cramps',       label: 'Crampes' },
    { value: 'nausea',       label: 'Nausées / Vomissements' },
    { value: 'chest_pain',   label: 'Douleur thoracique' },
    { value: 'fever',        label: 'Fièvre' },
    { value: 'pruritus',     label: 'Prurit' },
    { value: 'early_stop',   label: 'Arrêt prématuré' },
    { value: 'other',        label: 'Autre' },
];

export class NurseComplicationPopup extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseComplicationPopup";
    static props = {
        onSave: Function,
        onCancel: Function,
    };

    setup() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const defaultTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                            `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
        this.form = useState({
            complication_type: '',
            occurrence_time: defaultTime,
            bp_at_occurrence: '',
            action_taken: '',
            resolution: '',
            early_stop_duration: 0,
        });
        this.types = COMPLICATION_TYPES;
        this.saving = useState({ pending: false });
    }

    get isValid() {
        return this.form.complication_type && this.form.action_taken && this.form.resolution;
    }

    get showEarlyStop() {
        return this.form.complication_type === 'early_stop';
    }

    selectType(value) {
        this.form.complication_type = value;
    }

    async onSave() {
        if (!this.isValid) return;
        this.saving.pending = true;
        const vals = {
            complication_type: this.form.complication_type,
            occurrence_time: this.form.occurrence_time,
            bp_at_occurrence: this.form.bp_at_occurrence || false,
            action_taken: this.form.action_taken,
            resolution: this.form.resolution,
        };
        if (this.showEarlyStop && this.form.early_stop_duration) {
            vals.early_stop_duration = parseInt(this.form.early_stop_duration) || 0;
        }
        await this.props.onSave(vals);
        this.saving.pending = false;
    }
}
