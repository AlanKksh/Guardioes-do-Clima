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

	QUnit.test("_getTodayForecastsWithLocalDate usa o primeiro dia quando hoje não tem slots", function (assert) {
		var oController = new Controller();
		var timezoneOffset = -10800;
		var locationNow = oController._getLocationCurrentDate(timezoneOffset);
		var tomorrow = new Date(locationNow.getTime());
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(9, 0, 0, 0);

		var utcTime = tomorrow.getTime() - timezoneOffset * 1000;
		var dt = Math.floor((utcTime - new Date(utcTime).getTimezoneOffset() * 60000) / 1000);
		var forecasts = [{
			dt: dt,
			main: { temp: 24 }
		}];

		var aNormalized = oController._getTodayForecastsWithLocalDate(forecasts, timezoneOffset);

		assert.strictEqual(aNormalized.length, 1);
		assert.strictEqual(aNormalized[0].forecast.main.temp, 24);
	});

	QUnit.test("buildHourlyChartPoints preenche temperaturas com previsões do dia disponível", function (assert) {
		var oController = new Controller();
		var timezoneOffset = -10800;
		var locationNow = oController._getLocationCurrentDate(timezoneOffset);
		var tomorrow = new Date(locationNow.getTime());
		tomorrow.setDate(tomorrow.getDate() + 1);

		var targetHours = [7, 9, 12, 15, 17, 20, 0];
		var forecasts = targetHours.map(function (hour) {
			var localDate = new Date(tomorrow.getTime());
			localDate.setHours(hour, 0, 0, 0);
			var utcTime = localDate.getTime() - timezoneOffset * 1000;
			var dt = Math.floor((utcTime - new Date(utcTime).getTimezoneOffset() * 60000) / 1000);
			return {
				dt: dt,
				main: { temp: 20 + hour / 10 }
			};
		});

		var aPoints = oController.buildHourlyChartPoints(forecasts, timezoneOffset);

		assert.strictEqual(aPoints.length, 7);
		assert.ok(aPoints.every(function (point) {
			return point.temperature > 0;
		}));
	});

});
