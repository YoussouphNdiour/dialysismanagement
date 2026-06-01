/** @odoo-module **/
import { Component } from "@odoo/owl";

export class NursePatientList extends Component {
    static template = "acs_hms_nephrology_dashboard.NursePatientList";
    static props = {
        procedures: Array,
        schedules: Array,
        scheduleId: { type: Number, optional: true },
        onSelectProcedure: Function,
        onScheduleChange: Function,
        onMarkAbsent: Function,
    };

    get today() {
        return new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
    }

    posteFor(proc) {
        if (!proc.nephrology_schedule_ids || !proc.nephrology_schedule_ids.length) return '—';
        const sid = proc.nephrology_schedule_ids[0];
        const sched = this.props.schedules.find((s) => s.id === sid);
        if (!sched) return '—';
        return sched.station_id ? sched.station_id[1] : sched.name;
    }

    formatTime(datetime) {
        if (!datetime) return '—';
        // datetime format: "YYYY-MM-DD HH:MM:SS"
        return datetime.slice(11, 16);
    }

    stateLabel(state) {
        return { scheduled: 'En attente', running: 'En cours', done: 'Terminé', cancel: 'Absent' }[state] || state;
    }

    stateBadgeClass(state) {
        return {
            scheduled: 'badge bg-secondary',
            running: 'badge bg-success',
            done: 'badge bg-primary',
            cancel: 'badge bg-danger',
        }[state] || 'badge bg-secondary';
    }

    onScheduleChange(ev) {
        const val = parseInt(ev.target.value) || null;
        this.props.onScheduleChange(val);
    }
}
