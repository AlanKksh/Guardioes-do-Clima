/**
 * Teste: test/unit/webapp/util/ClimateLayer.js
 * Origem: webapp/util/ClimateLayer.js
 * Módulo UI5: alan/projetos/projetinho/util/ClimateLayer
 */
/*global QUnit*/

sap.ui.define([
	"alan/projetos/projetinho/util/ClimateLayer"
], function (ClimateLayer) {
	"use strict";

	QUnit.module("webapp/util/ClimateLayer");

	QUnit.test("getColorForTemp retorna cinza para valor inválido", function (assert) {
		assert.strictEqual(ClimateLayer.getColorForTemp(null), "#94a3b8");
		assert.strictEqual(ClimateLayer.getColorForTemp(undefined), "#94a3b8");
		assert.strictEqual(ClimateLayer.getColorForTemp("25"), "#94a3b8");
	});

	QUnit.test("getColorForTemp mapeia faixas de temperatura", function (assert) {
		assert.strictEqual(ClimateLayer.getColorForTemp(-5), "#1e40af", "Frio intenso");
		assert.strictEqual(ClimateLayer.getColorForTemp(5), "#60a5fa", "Frio");
		assert.strictEqual(ClimateLayer.getColorForTemp(15), "#22c55e", "Agradável");
		assert.strictEqual(ClimateLayer.getColorForTemp(22), "#facc15", "Quente");
		assert.strictEqual(ClimateLayer.getColorForTemp(28), "#d97706", "Muito quente");
		assert.strictEqual(ClimateLayer.getColorForTemp(33), "#f97316", "Calor");
		assert.strictEqual(ClimateLayer.getColorForTemp(40), "#dc2626", "Extremo");
	});

	QUnit.test("getLabelForTemp retorna 'Sem dados' para valor inválido", function (assert) {
		assert.strictEqual(ClimateLayer.getLabelForTemp(null), "Sem dados");
		assert.strictEqual(ClimateLayer.getLabelForTemp(undefined), "Sem dados");
	});

	QUnit.test("getLabelForTemp mapeia faixas de temperatura", function (assert) {
		assert.strictEqual(ClimateLayer.getLabelForTemp(-5), "Frio intenso");
		assert.strictEqual(ClimateLayer.getLabelForTemp(5), "Frio");
		assert.strictEqual(ClimateLayer.getLabelForTemp(15), "Agradável");
		assert.strictEqual(ClimateLayer.getLabelForTemp(22), "Quente");
		assert.strictEqual(ClimateLayer.getLabelForTemp(28), "Muito quente");
		assert.strictEqual(ClimateLayer.getLabelForTemp(33), "Calor");
		assert.strictEqual(ClimateLayer.getLabelForTemp(40), "Extremo");
	});

});
