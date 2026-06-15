/** @odoo-module **/
import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

/**
 * §4.5 — Widget résumé du jour (secrétaire)
 *
 * Affiche en temps réel :
 *   - Nb patients matin / après-midi
 *   - Nb postes occupés
 *   - Répartition : confirmés / non confirmés / absents / reportés
 *
 * Enregistré comme action client "secretary_day_widget"
 * et affiché via l'action ir.actions.client.
 */
export class SecretaryDayWidget extends Component {
    static template = "acs_hms_nephrology_dashboard.SecretaryDayWidget";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            loading: true,
            data: null,
            error: null,
            lastRefresh: null,
        });
        onMounted(() => this._load());
    }

    async _load() {
        this.state.loading = true;
        this.state.error = null;
        try {
            const data = await this.orm.call(
                "acs.dialysis.station",
                "get_secretary_day_summary",
                [],
            );
            this.state.data = data;
            this.state.lastRefresh = new Date().toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch (e) {
            console.error("[SecretaryDayWidget] load error", e);
            this.state.error = "Impossible de charger le résumé du jour.";
        } finally {
            this.state.loading = false;
        }
    }

    async onRefresh() {
        await this._load();
    }

    /** Retourne la classe CSS badge selon le nombre et le seuil d'alerte */
    badgeClass(value, warnThreshold = 0) {
        if (!value) return "sw-badge sw-badge-ok";
        return value > warnThreshold ? "sw-badge sw-badge-warn" : "sw-badge sw-badge-ok";
    }

    get occupancyPercent() {
        const d = this.state.data;
        if (!d || !d.total_stations) return 0;
        return Math.round((d.stations_occupied / d.total_stations) * 100);
    }
}

registry.category("actions").add("secretary_day_widget", SecretaryDayWidget);
