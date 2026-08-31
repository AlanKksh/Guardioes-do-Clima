/**
 * Teste: test/unit/webapp/controller/View1.controller.js
 * Origem: webapp/controller/View1.controller.js
 * Módulo UI5: alan/projetos/projetinho/controller/View1.controller
 */
/*global QUnit*/

sap.ui.define([
	"alan/projetos/projetinho/controller/View1.controller"
], function (Controller) {
	"use strict";

	QUnit.module("webapp/controller/View1.controller - helpers");

	QUnit.test("getCurrentTime retorna hora no formato HH:MM", function (assert) {
		var oController = new Controller();
		var sTime = oController.getCurrentTime();

		assert.ok(/^\d{2}:\d{2}$/.test(sTime), "Formato HH:MM");
	});

	QUnit.test("getDefaultHourlyChartData retorna 7 pontos do gráfico", function (assert) {
		var oController = new Controller();
		var aPoints = oController.getDefaultHourlyChartData();

		assert.strictEqual(aPoints.length, 7);
		aPoints.forEach(function (oPoint) {
			assert.ok(oPoint.hourLabel);
			assert.strictEqual(oPoint.temperature, 0);
		});
	});

	QUnit.test("_getHumidityStatus classifica faixas de umidade", function (assert) {
		var oController = new Controller();

		assert.strictEqual(oController._getHumidityStatus(null), "--");
		assert.strictEqual(oController._getHumidityStatus(80), "Ambiente úmido");
		assert.strictEqual(oController._getHumidityStatus(50), "Umidade equilibrada");
		assert.strictEqual(oController._getHumidityStatus(30), "Ar seco");
	});

	QUnit.test("_getHeatStatus classifica faixas de temperatura", function (assert) {
		var oController = new Controller();

		assert.strictEqual(oController._getHeatStatus(null), "--");
		assert.strictEqual(oController._getHeatStatus(36), "Clima muito quente");
		assert.strictEqual(oController._getHeatStatus(30), "Dia quente");
		assert.strictEqual(oController._getHeatStatus(23), "Temperatura amena");
		assert.strictEqual(oController._getHeatStatus(17), "Clima fresco");
		assert.strictEqual(oController._getHeatStatus(10), "Frio intenso");
	});

	QUnit.test("_getWindStatus combina temperatura e vento", function (assert) {
		var oController = new Controller();

		assert.strictEqual(oController._getWindStatus(null, null), "--");
		assert.strictEqual(oController._getWindStatus(30, 12), "Quente com vento fresco");
		assert.strictEqual(oController._getWindStatus(20, 20), "Vento frio e forte");
		assert.strictEqual(oController._getWindStatus(20, 12), "Brisa moderada");
		assert.strictEqual(oController._getWindStatus(32, 3), "Calor seco e parado");
		assert.strictEqual(oController._getWindStatus(20, 5), "Ar calmo");
	});

	QUnit.test("buildHourlyChartPoints retorna dados padrão sem previsões", function (assert) {
		var oController = new Controller();
		var aPoints = oController.buildHourlyChartPoints([], 0);

		assert.strictEqual(aPoints.length, 7);
	});

});
