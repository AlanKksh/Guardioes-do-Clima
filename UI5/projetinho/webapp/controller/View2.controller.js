sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/ResizeHandler",
    "alan/projetos/projetinho/util/PageNavigation",
    "alan/projetos/projetinho/util/CesiumGlobe",
    "alan/projetos/projetinho/util/ClimateLayer"
], function (Controller, JSONModel, MessageToast, ResizeHandler, PageNavigation, CesiumGlobe, ClimateLayer) {
    "use strict";

    var MIN_GLOBE_HEIGHT = 120;
    var MAX_LAYOUT_ATTEMPTS = 20;

    return Controller.extend("alan.projetos.projetinho.controller.View2", {

        onInit: function () {
            PageNavigation.init(this, "page2");

            var oGlobeModel = new JSONModel({
                searchQuery: "",
                displayMode: "map",
                globeReady: false,
                climateLoading: false,
                selectedLat: null,
                selectedLon: null,
                selectedLatFormatted: "—",
                selectedLonFormatted: "—",
                selectedTempFormatted: "—",
                selectedLabel: "Clique no globo para selecionar um ponto."
            });
            this.getView().setModel(oGlobeModel, "globeModel");

            this._iLayoutAttempts = 0;
            this._iLastGlobeWidth = 0;
            this._iLastGlobeHeight = 0;
        },

        onAfterRendering: function () {
            this._scheduleGlobeInit();
        },

        onCesiumHostRendered: function () {
            this._scheduleGlobeInit();
        },

        _scheduleGlobeInit: function () {
            if (this._bCesiumInitialized || this._bCesiumInitializing) {
                return;
            }

            window.requestAnimationFrame(function () {
                this._tryInitGlobe();
            }.bind(this));
        },

        _tryInitGlobe: function () {
            if (this._bCesiumInitialized || this._bCesiumInitializing) {
                return;
            }

            var oHost = document.getElementById("cesiumGlobeHost");
            var oSection = this.byId("view2GlobeSection");

            if (!oHost || !oSection) {
                return;
            }

            if (oHost.dataset.cesiumReady === "true") {
                this._bCesiumInitialized = true;
                return;
            }

            var oSectionDom = oSection.getDomRef();
            if (!oSectionDom) {
                return;
            }

            var iWidth = oSectionDom.clientWidth;
            var iHeight = oSectionDom.clientHeight;

            if (iWidth < 100 || iHeight < MIN_GLOBE_HEIGHT) {
                this._iLayoutAttempts += 1;
                if (this._iLayoutAttempts < MAX_LAYOUT_ATTEMPTS) {
                    window.requestAnimationFrame(function () {
                        this._tryInitGlobe();
                    }.bind(this));
                }
                return;
            }

            oHost.classList.add("cesiumGlobeHost--loading");
            oHost.style.width = iWidth + "px";
            oHost.style.height = iHeight + "px";

            this._bCesiumInitializing = true;

            CesiumGlobe.init("cesiumGlobeHost", {
                onPick: this._onGlobePick.bind(this)
            }).then(function (oGlobe) {
                this._oGlobe = oGlobe;
                oHost.dataset.cesiumReady = "true";
                this._bCesiumInitialized = true;
                this._bCesiumInitializing = false;
                this._iLastGlobeWidth = iWidth;
                this._iLastGlobeHeight = iHeight;

                this._syncGlobeSize(true);
                oHost.classList.remove("cesiumGlobeHost--loading");
                oHost.classList.add("cesiumGlobeHost--ready");
                this.getView().getModel("globeModel").setProperty("/globeReady", true);
                this._registerGlobeResize();
                ClimateLayer.preloadCountryClimateData();
            }.bind(this)).catch(function (oError) {
                this._bCesiumInitializing = false;
                oHost.classList.remove("cesiumGlobeHost--loading");
                MessageToast.show("Não foi possível carregar o globo 3D.");
                // eslint-disable-next-line no-console
                console.error(oError);
            });
        },

        _syncGlobeSize: function (bForceResize) {
            var oSectionDom = this.byId("view2GlobeSection").getDomRef();
            var oHost = document.getElementById("cesiumGlobeHost");

            if (!oSectionDom || !oHost || !this._oGlobe) {
                return;
            }

            var iWidth = oSectionDom.clientWidth;
            var iHeight = oSectionDom.clientHeight;

            if (iWidth < 100 || iHeight < MIN_GLOBE_HEIGHT) {
                return;
            }

            oHost.style.width = iWidth + "px";
            oHost.style.height = iHeight + "px";

            if (bForceResize ||
                iWidth !== this._iLastGlobeWidth ||
                iHeight !== this._iLastGlobeHeight) {
                this._iLastGlobeWidth = iWidth;
                this._iLastGlobeHeight = iHeight;
                this._oGlobe.resize();
            }
        },

        _registerGlobeResize: function () {
            var oDomRef = this.byId("view2GlobeSection").getDomRef();
            if (!oDomRef || this._sResizeHandlerId) {
                return;
            }

            this._sResizeHandlerId = ResizeHandler.register(oDomRef, function () {
                this._syncGlobeSize(true);
            }.bind(this));
        },

        _onGlobePick: function (oPoint) {
            var oModel = this.getView().getModel("globeModel");
            var fLat = this._formatCoordinate(oPoint.lat);
            var fLon = this._formatCoordinate(oPoint.lon);

            oModel.setProperty("/selectedLat", oPoint.lat);
            oModel.setProperty("/selectedLon", oPoint.lon);
            oModel.setProperty("/selectedLatFormatted", fLat + "°");
            oModel.setProperty("/selectedLonFormatted", fLon + "°");
            oModel.setProperty("/selectedLabel", "Ponto selecionado no globo");

            if (oPoint.displayMode === "climate") {
                oModel.setProperty("/selectedTempFormatted", "...");
                ClimateLayer.fetchPointTemperature(oPoint.lat, oPoint.lon)
                    .then(function (oData) {
                        oModel.setProperty("/selectedTempFormatted", oData.temp + "°C — " + oData.label);
                        oModel.setProperty("/selectedLabel", "Clima no ponto selecionado");
                    })
                    .catch(function () {
                        oModel.setProperty("/selectedTempFormatted", "—");
                        MessageToast.show("Não foi possível obter a temperatura deste ponto.");
                    });
            } else {
                oModel.setProperty("/selectedTempFormatted", "—");
            }
        },

        _formatCoordinate: function (fValue) {
            return (Math.round(fValue * 10) / 10).toFixed(1);
        },

        onGlobeHome: function () {
            if (this._oGlobe) {
                this._oGlobe.flyHome();
            }
        },

        onToggleClimateMode: function () {
            if (!this._oGlobe) {
                return;
            }

            var oModel = this.getView().getModel("globeModel");
            var sNextMode = oModel.getProperty("/displayMode") === "climate" ? "map" : "climate";

            if (sNextMode === "climate") {
                oModel.setProperty("/climateLoading", true);
                MessageToast.show("Carregando camada climática...");
            }

            this._oGlobe.setDisplayMode(sNextMode)
                .then(function () {
                    oModel.setProperty("/displayMode", sNextMode);
                    oModel.setProperty("/climateLoading", false);
                    oModel.setProperty("/selectedTempFormatted", "—");

                    if (sNextMode === "climate") {
                        MessageToast.show("Modo clima ativado.");
                    } else {
                        MessageToast.show("Modo mapa ativado.");
                    }
                })
                .catch(function (oError) {
                    oModel.setProperty("/climateLoading", false);
                    MessageToast.show("Não foi possível carregar o modo clima.");
                    // eslint-disable-next-line no-console
                    console.error("Erro ao carregar modo clima:", oError);
                });
        },

        onGlobeSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query") || this.byId("globeSearchField").getValue();
            if (!sQuery.trim()) {
                MessageToast.show("Digite um local para buscar.");
                return;
            }

            var sUrl = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q="
                + encodeURIComponent(sQuery.trim());

            fetch(sUrl, {
                headers: {
                    "Accept-Language": "pt-BR"
                }
            })
                .then(function (oResponse) {
                    return oResponse.json();
                })
                .then(function (aResults) {
                    if (!aResults.length) {
                        MessageToast.show("Local não encontrado.");
                        return;
                    }

                    var oPlace = aResults[0];
                    var fLat = parseFloat(oPlace.lat);
                    var fLon = parseFloat(oPlace.lon);
                    var oModel = this.getView().getModel("globeModel");

                    oModel.setProperty("/selectedLat", fLat);
                    oModel.setProperty("/selectedLon", fLon);
                    oModel.setProperty("/selectedLatFormatted", this._formatCoordinate(fLat) + "°");
                    oModel.setProperty("/selectedLonFormatted", this._formatCoordinate(fLon) + "°");
                    oModel.setProperty("/selectedLabel", oPlace.display_name);

                    if (this._oGlobe) {
                        this._oGlobe.flyTo(fLat, fLon, 1800000);
                    }
                }.bind(this))
                .catch(function () {
                    MessageToast.show("Erro ao buscar o local.");
                });
        },

        onNavigateToPage1: function () {
            PageNavigation.navigateToPage1(this);
        },

        onNavigateToPage2: function () {
            PageNavigation.navigateToPage2(this);
        },

        onExit: function () {
            if (this._sResizeHandlerId) {
                ResizeHandler.deregister(this._sResizeHandlerId);
                this._sResizeHandlerId = null;
            }

            if (this._oGlobe) {
                this._oGlobe.destroy();
                this._oGlobe = null;
            }

            this._bCesiumInitialized = false;
            this._bCesiumInitializing = false;
            this._iLayoutAttempts = 0;

            var oModel = this.getView().getModel("globeModel");
            if (oModel) {
                oModel.setProperty("/globeReady", false);
            }
        }
    });
});
