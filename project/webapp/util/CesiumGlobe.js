sap.ui.define([
    "alan/projetos/projetinho/util/ClimateLayer"
], function (ClimateLayer) {
    "use strict";

    var CESIUM_VERSION = "1.119";
    var CESIUM_BASE_URL = "https://cesium.com/downloads/cesiumjs/releases/" + CESIUM_VERSION + "/Build/Cesium/";
    var GLOBE_SSE_IDLE = 2;
    var GLOBE_SSE_MOVING = 4;
    var CLIMATE_LAYER_ALPHA = 0.94;
    var MAP_ALPHA_CLIMATE = 0.38;

    function _loadStylesheet(sHref) {
        return new Promise(function (resolve, reject) {
            var oExisting = document.querySelector('link[href="' + sHref + '"]');
            if (oExisting) {
                resolve();
                return;
            }

            var oLink = document.createElement("link");
            oLink.rel = "stylesheet";
            oLink.href = sHref;
            oLink.onload = function () { resolve(); };
            oLink.onerror = reject;
            document.head.appendChild(oLink);
        });
    }

    function _loadScript(sSrc) {
        return new Promise(function (resolve, reject) {
            if (window.Cesium) {
                resolve(window.Cesium);
                return;
            }

            var oExisting = document.querySelector('script[src="' + sSrc + '"]');
            if (oExisting) {
                oExisting.addEventListener("load", function () { resolve(window.Cesium); });
                oExisting.addEventListener("error", reject);
                return;
            }

            window.CESIUM_BASE_URL = CESIUM_BASE_URL;

            var oScript = document.createElement("script");
            oScript.src = sSrc;
            oScript.async = true;
            oScript.onload = function () { resolve(window.Cesium); };
            oScript.onerror = reject;
            document.head.appendChild(oScript);
        });
    }

    function _createImageryProvider(Cesium) {
        return new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            credit: "© OpenStreetMap contributors",
            minimumLevel: 0,
            maximumLevel: 16
        });
    }

    function _configureCamera(oViewer) {
        var oController = oViewer.scene.screenSpaceCameraController;

        oController.enableRotate = true;
        oController.enableTranslate = true;
        oController.enableZoom = true;
        oController.enableTilt = true;
        oController.enableLook = true;
        oController.minimumZoomDistance = 80;
        oController.maximumZoomDistance = 50000000;
        oController.inertiaSpin = 0.75;
        oController.inertiaZoom = 0.65;
    }

    function _configureScene(oViewer, Cesium) {
        var oScene = oViewer.scene;
        var oGlobe = oScene.globe;

        oScene.backgroundColor = Cesium.Color.fromCssColorString("#070b12");
        oScene.skyAtmosphere.show = true;
        oScene.fog.enabled = false;
        oScene.highDynamicRange = false;

        if (oScene.postProcessStages && oScene.postProcessStages.fxaa) {
            oScene.postProcessStages.fxaa.enabled = false;
        }

        oGlobe.enableLighting = false;
        oGlobe.showGroundAtmosphere = true;
        oGlobe.depthTestAgainstTerrain = false;
        oGlobe.maximumScreenSpaceError = GLOBE_SSE_IDLE;
        oGlobe.tileCacheSize = 600;
        oGlobe.loadingDescendantLimit = 16;
        oGlobe.preloadAncestors = true;
        oGlobe.preloadSiblings = true;

        oViewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);

        oViewer.camera.moveStart.addEventListener(function () {
            oGlobe.maximumScreenSpaceError = GLOBE_SSE_MOVING;
        });

        oViewer.camera.moveEnd.addEventListener(function () {
            oGlobe.maximumScreenSpaceError = GLOBE_SSE_IDLE;
        });
    }

    function _setHomeView(oViewer, Cesium) {
        oViewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(0, 15, 24000000),
            orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-90),
                roll: 0
            }
        });
    }

    return {
        loadLibrary: function () {
            return _loadStylesheet(CESIUM_BASE_URL + "Widgets/widgets.css")
                .then(function () {
                    return _loadScript(CESIUM_BASE_URL + "Cesium.js");
                });
        },

        init: function (sContainerId, oOptions) {
            oOptions = oOptions || {};

            return this.loadLibrary().then(function (Cesium) {
                var oContainer = document.getElementById(sContainerId);
                if (!oContainer) {
                    throw new Error("Container do Cesium não encontrado: " + sContainerId);
                }

                var oViewer = new Cesium.Viewer(sContainerId, {
                    animation: false,
                    timeline: false,
                    baseLayerPicker: false,
                    geocoder: false,
                    homeButton: false,
                    sceneModePicker: false,
                    navigationHelpButton: false,
                    fullscreenButton: false,
                    infoBox: false,
                    selectionIndicator: false,
                    creditContainer: document.createElement("div"),
                    baseLayer: false,
                    contextOptions: {
                        webgl: {
                            antialias: false,
                            powerPreference: "high-performance"
                        }
                    }
                });

                var oMapLayer = oViewer.imageryLayers.addImageryProvider(_createImageryProvider(Cesium));
                var oClimateImageryLayer = null;
                var oClimateLoadPromise = null;

                oViewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                _configureCamera(oViewer);
                _configureScene(oViewer, Cesium);
                _setHomeView(oViewer, Cesium);
                oViewer.resize();

                var oHandler = new Cesium.ScreenSpaceEventHandler(oViewer.scene.canvas);
                var sDisplayMode = "map";

                if (typeof oOptions.onPick === "function") {
                    oHandler.setInputAction(function (oEvent) {
                        var oCartesian = oViewer.scene.pickPosition(oEvent.position);

                        if (!oCartesian || !Cesium.defined(oCartesian)) {
                            oCartesian = oViewer.camera.pickEllipsoid(
                                oEvent.position,
                                oViewer.scene.globe.ellipsoid
                            );
                        }

                        if (!oCartesian) {
                            return;
                        }

                        var oCartographic = Cesium.Cartographic.fromCartesian(oCartesian);
                        oOptions.onPick({
                            lat: Cesium.Math.toDegrees(oCartographic.latitude),
                            lon: Cesium.Math.toDegrees(oCartographic.longitude),
                            displayMode: sDisplayMode
                        });
                    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
                }

                function _showMapMode() {
                    oMapLayer.show = true;
                    oMapLayer.alpha = 1;

                    if (oClimateImageryLayer) {
                        oClimateImageryLayer.show = false;
                    }
                }

                function _showClimateMode() {
                    if (oClimateImageryLayer) {
                        oMapLayer.show = true;
                        oMapLayer.alpha = MAP_ALPHA_CLIMATE;
                        oClimateImageryLayer.show = true;
                        oClimateImageryLayer.alpha = CLIMATE_LAYER_ALPHA;
                        return Promise.resolve();
                    }

                    if (oClimateLoadPromise) {
                        return oClimateLoadPromise.then(function () {
                            oMapLayer.show = true;
                            oMapLayer.alpha = MAP_ALPHA_CLIMATE;
                            if (oClimateImageryLayer) {
                                oClimateImageryLayer.show = true;
                                oClimateImageryLayer.alpha = CLIMATE_LAYER_ALPHA;
                            }
                        });
                    }

                    oClimateLoadPromise = ClimateLayer.fetchCountryClimateData()
                        .then(function (aCountries) {
                            var aValidCountries = aCountries.filter(function (oCountry) {
                                return oCountry.temp !== null;
                            });

                            if (!aValidCountries.length) {
                                throw new Error("Nenhum país pôde ser desenhado no globo");
                            }

                            var oProvider = ClimateLayer.createClimateImageryProvider(Cesium, aValidCountries);
                            oClimateImageryLayer = oViewer.imageryLayers.addImageryProvider(oProvider, 0);
                            oClimateImageryLayer.show = true;
                            oClimateImageryLayer.alpha = CLIMATE_LAYER_ALPHA;
                            oMapLayer.show = true;
                            oMapLayer.alpha = MAP_ALPHA_CLIMATE;
                        })
                        .catch(function (oError) {
                            // eslint-disable-next-line no-console
                            console.error("Falha ao montar camada climática:", oError);
                            throw oError;
                        })
                        .finally(function () {
                            oClimateLoadPromise = null;
                        });

                    return oClimateLoadPromise;
                }

                return {
                    viewer: oViewer,
                    handler: oHandler,
                    getDisplayMode: function () {
                        return sDisplayMode;
                    },
                    setDisplayMode: function (sMode) {
                        if (sMode === sDisplayMode) {
                            return Promise.resolve(sDisplayMode);
                        }

                        if (sMode === "climate") {
                            return _showClimateMode().then(function () {
                                sDisplayMode = "climate";
                                return sDisplayMode;
                            });
                        }

                        _showMapMode();
                        sDisplayMode = "map";
                        return Promise.resolve(sDisplayMode);
                    },
                    resize: function () {
                        oViewer.resize();
                    },
                    flyHome: function () {
                        oViewer.camera.flyTo({
                            destination: Cesium.Cartesian3.fromDegrees(0, 15, 24000000),
                            orientation: {
                                heading: 0,
                                pitch: Cesium.Math.toRadians(-90),
                                roll: 0
                            },
                            duration: 1.5
                        });
                    },
                    flyTo: function (fLat, fLon, iHeight) {
                        oViewer.camera.flyTo({
                            destination: Cesium.Cartesian3.fromDegrees(
                                fLon,
                                fLat,
                                iHeight || 1200000
                            ),
                            duration: 1.5
                        });
                    },
                    destroy: function () {
                        if (oHandler && !oHandler.isDestroyed()) {
                            oHandler.destroy();
                        }
                        if (oViewer && !oViewer.isDestroyed()) {
                            oViewer.destroy();
                        }
                    }
                };
            });
        }
    };
});
