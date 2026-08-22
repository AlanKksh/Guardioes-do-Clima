sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "alan/projetos/projetinho/util/PageNavigation"
], function (Controller, PageNavigation) {
    "use strict";

    return Controller.extend("alan.projetos.projetinho.controller.View2", {

        onInit: function () {
            PageNavigation.init(this, "page2");
        },

        onNavigateToPage1: function () {
            PageNavigation.navigateToPage1(this);
        },

        onNavigateToPage2: function () {
            PageNavigation.navigateToPage2(this);
        }
    });
});
