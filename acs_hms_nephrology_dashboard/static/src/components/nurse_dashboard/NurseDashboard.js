/** @odoo-module **/
import { Component, useState, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { NursePatientList } from "./NursePatientList";
import { NurseSessionForm } from "./NurseSessionForm";
import { NurseEndSession } from "./NurseEndSession";

const PROCEDURE_FIELDS = [
    'id', 'name', 'patient_id', 'state', 'date', 'date_stop',
    'department_id', 'nephrology_schedule_ids',
    'arrival_status', 'pre_dialysis_bp', 'arrival_weight', 'dry_weight',
    'interdialysis_increase', 'uf_habituelle',
    'has_active_hypotension', 'vital_sign_ids',
    'departure_weight', 'actual_uf', 'actual_duration',
    'global_tolerance', 'end_notes',
    'urea_pre', 'urea_post',
    'ktv_calculated', 'ktv_status', 'urr_calculated',
    'complication_count',
];

const VITAL_FIELDS = [
    'id', 'measurement_time', 'blood_pressure', 'heart_rate',
    'respiratory_rate', 'spo2', 'temperature', 'glycemia', 'is_hypotension', 'notes',
];

function todayRange() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return [`${d} 00:00:00`, `${d} 23:59:59`];
}

export class NurseDashboard extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseDashboard";
    static components = { NursePatientList, NurseSessionForm, NurseEndSession };

    setup() {
        this.orm = useService("orm");
        this.user = useService("user");
        this.state = useState({
            screen: 'list',
            procedureId: null,
            procedure: null,
            vitals: [],
            scheduleId: null,
            procedures: [],
            schedules: [],
        });
        this.timer = useState({
            secondsLeft: 1800,
            isRinging: false,
        });
        this._loadSchedules();
        this._loadProcedures();

        useEffect(() => {
            if (this.state.screen !== 'session') return;
            const id = setInterval(() => {
                if (this.timer.secondsLeft > 0) {
                    this.timer.secondsLeft -= 1;
                } else {
                    this.timer.isRinging = true;
                }
            }, 1000);
            return () => clearInterval(id);
        }, () => [this.state.screen]);
    }

    async _loadSchedules() {
        const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, …, 6=Sat
        const dayFields = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const dayField = dayFields[jsDay === 0 ? 6 : jsDay - 1];

        this.state.schedules = await this.orm.searchRead(
            'acs.nephrology.schedule',
            [[dayField, '=', true]],
            ['id', 'name', 'station_id', 'nurse_ids'],
        );

        const uid = this.user.userId;
        const mine = this.state.schedules.find((s) => s.nurse_ids.includes(uid));
        if (mine) {
            this.state.scheduleId = mine.id;
            await this._loadProcedures();
        }
    }

    async _loadProcedures() {
        const [start, end] = todayRange();
        const domain = [
            ['department_id.department_type', '=', 'nephrology'],
            ['date', '>=', start],
            ['date', '<=', end],
        ];
        if (this.state.scheduleId) {
            domain.push(['nephrology_schedule_ids', 'in', [this.state.scheduleId]]);
        }
        this.state.procedures = await this.orm.searchRead(
            'acs.patient.procedure',
            domain,
            ['id', 'patient_id', 'state', 'date', 'nephrology_schedule_ids'],
            { order: 'date asc' },
        );
    }

    async _reloadProcedure() {
        if (!this.state.procedureId) return;
        const [rec] = await this.orm.read(
            'acs.patient.procedure',
            [this.state.procedureId],
            PROCEDURE_FIELDS,
        );
        this.state.procedure = rec;
        if (rec.vital_sign_ids && rec.vital_sign_ids.length) {
            const vitals = await this.orm.read(
                'hemodialysis.vital.sign',
                rec.vital_sign_ids,
                VITAL_FIELDS,
            );
            vitals.sort((a, b) => (a.measurement_time > b.measurement_time ? 1 : -1));
            this.state.vitals = vitals;
        } else {
            this.state.vitals = [];
        }
    }

    async onSelectProcedure(id) {
        this.state.procedureId = id;
        await this._reloadProcedure();
        this.state.screen = 'session';
    }

    async onScheduleChange(scheduleId) {
        this.state.scheduleId = scheduleId || null;
        await this._loadProcedures();
    }

    onTimerReset() {
        this.timer.secondsLeft = 1800;
        this.timer.isRinging = false;
    }

    async onSaveVitals(vals) {
        vals.procedure_id = this.state.procedureId;
        await this.orm.create('hemodialysis.vital.sign', [vals]);
        await this._reloadProcedure();
    }

    async onSaveComplication(vals) {
        vals.procedure_id = this.state.procedureId;
        await this.orm.create('acs.dialysis.complication', [vals]);
        await this._reloadProcedure();
    }

    async onValidateSession(vals) {
        await this.orm.write('acs.patient.procedure', [this.state.procedureId], vals);
        await this._reloadProcedure();
        setTimeout(() => {
            this.state.screen = 'list';
            this.state.procedureId = null;
            this.state.procedure = null;
            this.state.vitals = [];
            this.timer.secondsLeft = 1800;
            this.timer.isRinging = false;
            this._loadProcedures();
        }, 2000);
    }

    async onMarkAbsent(procedureId) {
        await this.orm.write('acs.patient.procedure', [procedureId], { state: 'cancel' });
        await this._loadProcedures();
    }

    onGoToEnd() { this.state.screen = 'end'; }
    onBackToList() { this.state.screen = 'list'; }
    onBackToSession() { this.state.screen = 'session'; }
}

registry.category("actions").add("acs_nurse_dashboard", NurseDashboard);
