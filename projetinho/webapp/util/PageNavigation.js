sap.ui.define([], function () {
    "use strict";

    function _setActiveTab(oController, sActivePage) {
        var oView = oController.getView();
        var oBtn1 = oView.byId("btnPagina1");
        var oBtn2 = oView.byId("btnPagina2");

        if (oBtn1) {
            oBtn1.toggleStyleClass("pageNavTabActive", sActivePage === "page1");
        }
        if (oBtn2) {
            oBtn2.toggleStyleClass("pageNavTabActive", sActivePage === "page2");
        }
    }

    return {
        init: function (oController, sActivePage) {
            _setActiveTab(oController, sActivePage);
        },

        navigateToPage1: function (oController) {
            oController.getOwnerComponent().getRouter().navTo("RouteView1");
        },

        navigateToPage2: function (oController) {
            oController.getOwnerComponent().getRouter().navTo("RouteView2");
        }
    };
});
