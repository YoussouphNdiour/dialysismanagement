/** @odoo-module **/

import { registry } from "@web/core/registry";
import { getDefaultConfig } from "@web/views/view";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";

import { acsRenderWeightChart, acsRenderHeightChart, acsRenderRBSChart } from "./acs_eva_charts";
import { acsRenderRespirationRateChart, acsRenderSystolicBPChart, acsRenderDiastolicBPChart } from "./acs_eva_charts";
import { acsRenderHeadChart, acsRenderTempChart, acsRenderHeartRateChart } from "./acs_eva_charts"; 
import { acsRenderSpO2Chart, acsRenderBmiChart} from "./acs_eva_charts"; 

import { AcsEvaluationGraphData } from './acs_eva_chart_data.js';

const { Component, useSubEnv, useState, onWillStart, onMounted, useRef } = owl;

export function AcsDashChartColor(orm) {
    return class AcsChartColor {
        constructor() {
            this.orm = orm;
        }
        async acsGetChartColor() {
            try {
                const evaluationColorData = await this.orm.call('hms.patient', 'acs_get_evaluation_color', []);
                return evaluationColorData?.acs_evaluation_color || '#985184';
            } catch (error) {
                console.error(_t("Error fetching evaluation chart color:"), error);
                return '#985184';
            }
        }
    }
}

export class AcsHmsEvaluation extends Component {
    setup() {
        this.rpc = rpc;
        this.actionService = useService("action");
        this.orm = useService("orm");

        this.acsWeightChartContainer = useRef("acsWeightChartContainer");
        this.acsHeightChartContainer = useRef("acsHeightChartContainer");
        this.acsTempChartContainer = useRef("acsTempChartContainer");
        this.acsHeartRateChartContainer = useRef("acsHeartRateChartContainer");
        this.acsRespirationRateChartContainer = useRef("acsRespirationRateChartContainer");
        this.acsBmiChartContainer = useRef("acsBmiChartContainer");
        this.acsSystolicBpChartContainer = useRef("acsSystolicBpChartContainer");
        this.acsDiastolicBpChartContainer = useRef("acsDiastolicBpChartContainer");
        this.acsSpo2ChartContainer = useRef("acsSpo2ChartContainer");
        this.acsRbsChartContainer = useRef("acsRbsChartContainer");
        this.acsHeadChartContainer = useRef("acsHeadChartContainer");

        this.state = useState({
            period: "Week", //MKA: Default filter
            date_domain: [],
            evaluationChartColor: '#985184',
        });

        useSubEnv({
            config: {
                ...getDefaultConfig(),
                ...this.env.config,
            },
        });

        onWillStart(async () => {
            const patientId = await this.acsGetPatientId();
            this.chartBackendData = new AcsEvaluationGraphData(patientId);

            const AcsChartColor = AcsDashChartColor(this.orm);
            const dashChart = new AcsChartColor();
            this.state.evaluationChartColor = await dashChart.acsGetChartColor();
        });

        onMounted(() => {
            this.acsOnChangePeriod();
        });
    }

    async acsOnChangePeriod(period = null) {
        if (period) {
            this.state.period = period;
        }
        const now = new Date();
        let startDate, endDate;

        if (this.state.period == 'Today') {
            startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 00:00:00`;
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 23:59:59`;
        } else if (this.state.period == 'Week') {
            const sixDaysAgo = new Date(now);
            sixDaysAgo.setDate(now.getDate() - 6);
            startDate = `${sixDaysAgo.getFullYear()}-${String(sixDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sixDaysAgo.getDate()).padStart(2, '0')} 00:00:00`;
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 23:59:59`;
        } else if (this.state.period == 'Month') {
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(now.getMonth() - 1);
            startDate = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')} 00:00:00`;
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 23:59:59`;
        } else if (this.state.period == 'Year') {
            const oneYearAgo = new Date(now);
            oneYearAgo.setFullYear(now.getFullYear() - 1);
            startDate = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-${String(oneYearAgo.getDate()).padStart(2, '0')} 00:00:00`;
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 23:59:59`;
        } else if (this.state.period == 'Till_Now') {
            startDate = `2000-01-01 00:00:00`; // earliest
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }
        this.state.date_domain = [['date', '>=', startDate], ['date', '<=', endDate]];
        console.log("\n this.state.date_domain -----", this.state.date_domain)

        this.acsRenderAllCharts();
    }

    async acsGetPatientId() {
        const patientId = this.props?.action?.context?.active_id
        console.log("\n patientId -----", patientId)
        return patientId;
    }

    async acsRenderAllCharts() {
        try {
            await acsRenderWeightChart(
                this.acsWeightChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderHeightChart(
                this.acsHeightChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderTempChart(
                this.acsTempChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderHeartRateChart(
                this.acsHeartRateChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderRespirationRateChart(
                this.acsRespirationRateChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderBmiChart(
                this.acsBmiChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderSystolicBPChart(
                this.acsSystolicBpChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderDiastolicBPChart(
                this.acsDiastolicBpChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderSpO2Chart(
                this.acsSpo2ChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderRBSChart(
                this.acsRbsChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
            );

            await acsRenderHeadChart(
                this.acsHeadChartContainer.el, 
                this.state.date_domain, 
                this.chartBackendData, 
                this.state.evaluationChartColor
        );
        } catch (err) {
            console.error("Error rendering charts:", err);
        }
    }
}

AcsHmsEvaluation.template = "acs_hms.AcsHmsEvaluationChart";
registry.category("actions").add("AlmightyHmsEvaluation", AcsHmsEvaluation);
