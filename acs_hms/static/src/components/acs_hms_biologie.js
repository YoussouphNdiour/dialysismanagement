/** @odoo-module **/

import { registry } from "@web/core/registry";
import { getDefaultConfig } from "@web/views/view";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

import { acsRenderGBChart, acsRenderHBChart, acsRenderPLTChart, acsRenderCRPChart } from "./acs_bio_charts";
import { acsRenderUreeChart, acsRenderCreatChart, acsRenderDFGChart } from "./acs_bio_charts";
import { acsRenderSodiumChart, acsRenderPotassiumChart } from "./acs_bio_charts";
import { acsRenderHDLChart, acsRenderLDLChart } from "./acs_bio_charts";
import { acsRenderALATChart, acsRenderASATChart } from "./acs_bio_charts";
import { acsRenderCalciumChart, acsRenderPTHiChart } from "./acs_bio_charts";

import { AcsBiologieGraphData } from './acs_bio_chart_data.js';

const { Component, useSubEnv, useState, onWillStart, onMounted, useRef } = owl;

export class AcsHmsBiologie extends Component {
    setup() {
        this.actionService = useService("action");
        this.orm = useService("orm");

        // Chart containers
        this.acsGBChartContainer = useRef("acsGBChartContainer");
        this.acsHBChartContainer = useRef("acsHBChartContainer");
        this.acsPLTChartContainer = useRef("acsPLTChartContainer");
        this.acsCRPChartContainer = useRef("acsCRPChartContainer");
        this.acsUreeChartContainer = useRef("acsUreeChartContainer");
        this.acsCreatChartContainer = useRef("acsCreatChartContainer");
        this.acsDFGChartContainer = useRef("acsDFGChartContainer");
        this.acsSodiumChartContainer = useRef("acsSodiumChartContainer");
        this.acsPotassiumChartContainer = useRef("acsPotassiumChartContainer");
        this.acsHDLChartContainer = useRef("acsHDLChartContainer");
        this.acsLDLChartContainer = useRef("acsLDLChartContainer");
        this.acsALATChartContainer = useRef("acsALATChartContainer");
        this.acsASATChartContainer = useRef("acsASATChartContainer");
        this.acsCalciumChartContainer = useRef("acsCalciumChartContainer");
        this.acsPTHiChartContainer = useRef("acsPTHiChartContainer");

        this.state = useState({
            period: "Week",
            date_domain: [],
            biologieChartColor: '#2196F3',
        });

        useSubEnv({
            config: {
                ...getDefaultConfig(),
                ...this.env.config,
            },
        });

        onWillStart(async () => {
            const patientId = await this.acsGetPatientId();
            this.chartBackendData = new AcsBiologieGraphData(patientId);
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
            startDate = `2000-01-01 00:00:00`;
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }
        this.state.date_domain = [['date', '>=', startDate], ['date', '<=', endDate]];

        this.acsRenderAllCharts();
    }

    async acsGetPatientId() {
        const patientId = this.props?.action?.params?.active_id;
        return patientId;
    }

    async acsRenderAllCharts() {
        try {
            await acsRenderGBChart(this.acsGBChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderHBChart(this.acsHBChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderPLTChart(this.acsPLTChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderCRPChart(this.acsCRPChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderUreeChart(this.acsUreeChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderCreatChart(this.acsCreatChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderDFGChart(this.acsDFGChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderSodiumChart(this.acsSodiumChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderPotassiumChart(this.acsPotassiumChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderHDLChart(this.acsHDLChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderLDLChart(this.acsLDLChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderALATChart(this.acsALATChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderASATChart(this.acsASATChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderCalciumChart(this.acsCalciumChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
            await acsRenderPTHiChart(this.acsPTHiChartContainer.el, this.state.date_domain, this.chartBackendData, this.state.biologieChartColor);
        } catch (err) {
            console.error("Error rendering charts:", err);
        }
    }
}

AcsHmsBiologie.template = "acs_hms.AcsHmsBiologieChart";
registry.category("actions").add("AlmightyHmsBiologie", AcsHmsBiologie);
