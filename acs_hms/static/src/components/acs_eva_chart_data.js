/** @odoo-module **/

export class AcsEvaluationGraphData {

    constructor(patientId = null) {
        this.patientId = patientId
    }

    async acsHandleRequest(model, method, args=[], kwargs={}) {
        const response = await fetch("/web/dataset/call_kw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: {
                    model: model,
                    method: method,
                    args: args,
                    kwargs: kwargs,
                },
                id: Math.random(),
            }),
        });
        return response
    }

    async acsHandleResponse(response, errorMessage) {
        if (!response.ok) {
            console.error(errorMessage, response.statusText);
            throw new Error(response.statusText);
        } else {
            const result = await response.json();
            return result.result;
        }
    }

    async getEvolutionGraphData(field, unit, domain = []) {
        const response = await this.acsHandleRequest(
            "hms.patient", 
            "acs_get_evolution_graph_data", 
            [this.patientId, field, unit, domain]);
        const chartData = await this.acsHandleResponse(response, `Failed to fetch '${field}' graph data`);
        return chartData;
    }
}
