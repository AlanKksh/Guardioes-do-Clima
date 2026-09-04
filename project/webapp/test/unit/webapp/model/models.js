/**
 * Teste: test/unit/webapp/model/models.js
 * Origem: webapp/model/models.js
 * Módulo UI5: alan/projetos/projetinho/model/models
 */
/*global QUnit*/

sap.ui.define([
	"alan/projetos/projetinho/model/models",
	"sap/ui/model/json/JSONModel"
], function (models, JSONModel) {
	"use strict";

	QUnit.module("webapp/model/models");

	QUnit.test("createDeviceModel retorna JSONModel com binding OneWay", function (assert) {
		var oModel = models.createDeviceModel();

		assert.ok(oModel instanceof JSONModel, "Retorna instância de JSONModel");
		assert.strictEqual(oModel.getDefaultBindingMode(), "OneWay");
		assert.ok(typeof oModel.getData() === "object", "Contém dados do dispositivo");
	});

});
