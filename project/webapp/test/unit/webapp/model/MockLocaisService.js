/**
 * Teste: test/unit/webapp/model/MockLocaisService.js
 * Origem: webapp/model/MockLocaisService.js
 * Módulo UI5: alan/projetos/projetinho/model/MockLocaisService
 */
/*global QUnit*/

sap.ui.define([
	"alan/projetos/projetinho/model/MockLocaisService"
], function (MockLocaisService) {
	"use strict";

	QUnit.module("webapp/model/MockLocaisService");

	QUnit.test("buscarPorCidade retorna null para busca vazia", function (assert) {
		var done = assert.async();

		MockLocaisService.buscarPorCidade("").then(function (oResultado) {
			assert.strictEqual(oResultado, null);
			done();
		});
	});

	QUnit.test("buscarPorCidade encontra cidade pelo nome", function (assert) {
		var done = assert.async();

		MockLocaisService.buscarPorCidade("Curitiba").then(function (oResultado) {
			assert.ok(oResultado, "Resultado encontrado");
			assert.strictEqual(oResultado.encontrado, true);
			assert.strictEqual(oResultado.localPesquisado, "Curitiba");
			assert.strictEqual(oResultado.estado, "Paraná");
			assert.strictEqual(oResultado.pais, "Brasil");
			done();
		});
	});

	QUnit.test("buscarPorCidade encontra cidade por alias sem acento", function (assert) {
		var done = assert.async();

		MockLocaisService.buscarPorCidade("sampa").then(function (oResultado) {
			assert.ok(oResultado, "Resultado encontrado");
			assert.strictEqual(oResultado.localPesquisado, "São Paulo");
			done();
		});
	});

	QUnit.test("buscarPorCidade ignora maiúsculas e acentos", function (assert) {
		var done = assert.async();

		MockLocaisService.buscarPorCidade("  SÃO PAULO  ").then(function (oResultado) {
			assert.ok(oResultado);
			assert.strictEqual(oResultado.localPesquisado, "São Paulo");
			done();
		});
	});

	QUnit.test("buscarPorCidade retorna null para cidade inexistente", function (assert) {
		var done = assert.async();

		MockLocaisService.buscarPorCidade("CidadeInexistenteXYZ").then(function (oResultado) {
			assert.strictEqual(oResultado, null);
			done();
		});
	});

	QUnit.test("resultado monta tópicos turísticos quando disponíveis", function (assert) {
		var done = assert.async();

		MockLocaisService.buscarPorCidade("Curitiba").then(function (oResultado) {
			assert.ok(Array.isArray(oResultado.topicos));
			assert.strictEqual(oResultado.topicos.length, 5);

			var oMuseu = oResultado.topicos.find(function (oTopico) {
				return oTopico.id === "museu";
			});

			assert.ok(oMuseu);
			assert.strictEqual(oMuseu.disponivel, true);
			assert.ok(oMuseu.texto.indexOf("Museu Oscar Niemeyer") >= 0);
			done();
		});
	});

	QUnit.test("resultadoVazio retorna estrutura padrão", function (assert) {
		var oResultado = MockLocaisService.resultadoVazio("Teste", "Cidade");

		assert.strictEqual(oResultado.encontrado, false);
		assert.strictEqual(oResultado.localPesquisado, "Teste");
		assert.strictEqual(oResultado.tipoLocal, "Cidade");
		assert.strictEqual(oResultado.pais, "—");
		assert.ok(Array.isArray(oResultado.topicos));
		assert.strictEqual(oResultado.topicos.length, 5);
		assert.ok(oResultado.topicos.every(function (oTopico) {
			return oTopico.disponivel === false;
		}));
	});

	QUnit.test("resumo destaca capital do estado", function (assert) {
		var done = assert.async();

		MockLocaisService.buscarPorCidade("Curitiba").then(function (oResultado) {
			assert.ok(oResultado.resumo.indexOf("capital de Paraná") >= 0);
			done();
		});
	});

});
