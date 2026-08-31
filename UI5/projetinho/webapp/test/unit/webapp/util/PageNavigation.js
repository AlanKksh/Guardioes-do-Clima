/**
 * Teste: test/unit/webapp/util/PageNavigation.js
 * Origem: webapp/util/PageNavigation.js
 * Módulo UI5: alan/projetos/projetinho/util/PageNavigation
 */
/*global QUnit, sinon*/

sap.ui.define([
	"alan/projetos/projetinho/util/PageNavigation"
], function (PageNavigation) {
	"use strict";

	function _criarControllerMock(oRouter, oBotoes) {
		return {
			getOwnerComponent: function () {
				return {
					getRouter: function () {
						return oRouter;
					}
				};
			},
			getView: function () {
				return {
					byId: function (sId) {
						return oBotoes[sId] || null;
					}
				};
			}
		};
	}

	QUnit.module("webapp/util/PageNavigation", {
		beforeEach: function () {
			this.oRouter = { navTo: sinon.spy() };
			this.oBtn1 = { toggleStyleClass: sinon.spy() };
			this.oBtn2 = { toggleStyleClass: sinon.spy() };
			this.oController = _criarControllerMock(this.oRouter, {
				btnPagina1: this.oBtn1,
				btnPagina2: this.oBtn2
			});
		}
	});

	QUnit.test("navigateToPage1 chama rota RouteView1", function (assert) {
		PageNavigation.navigateToPage1(this.oController);

		assert.ok(this.oRouter.navTo.calledOnce);
		assert.strictEqual(this.oRouter.navTo.firstCall.args[0], "RouteView1");
	});

	QUnit.test("navigateToPage2 chama rota RouteView2", function (assert) {
		PageNavigation.navigateToPage2(this.oController);

		assert.ok(this.oRouter.navTo.calledOnce);
		assert.strictEqual(this.oRouter.navTo.firstCall.args[0], "RouteView2");
	});

	QUnit.test("init marca aba da página 1 como ativa", function (assert) {
		PageNavigation.init(this.oController, "page1");

		assert.ok(this.oBtn1.toggleStyleClass.calledWith("pageNavTabActive", true));
		assert.ok(this.oBtn2.toggleStyleClass.calledWith("pageNavTabActive", false));
	});

	QUnit.test("init marca aba da página 2 como ativa", function (assert) {
		PageNavigation.init(this.oController, "page2");

		assert.ok(this.oBtn1.toggleStyleClass.calledWith("pageNavTabActive", false));
		assert.ok(this.oBtn2.toggleStyleClass.calledWith("pageNavTabActive", true));
	});

});
