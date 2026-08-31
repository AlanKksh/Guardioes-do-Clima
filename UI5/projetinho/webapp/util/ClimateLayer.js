sap.ui.define([], function () {
    "use strict";

    var COUNTRIES_GEOJSON_URL = sap.ui.require.toUrl("alan/projetos/projetinho/assets/countries-110m.geojson");
    var CACHE_DURATION_MS = 30 * 60 * 1000;
    var BULK_CHUNK_SIZE = 100;
    var STORAGE_KEY = "alan.projetos.projetinho.climateCache.v2";

    var oCache = {
        timestamp: 0,
        geojson: null,
        prepared: null,
        countries: null
    };

    var oPreloadPromise = null;
    var oFetchPromise = null;

    var TEMPERATURE_LEGEND = [
        { max: 0, color: "#6366f1", label: "Frio intenso" },
        { max: 10, color: "#3b82f6", label: "Frio" },
        { max: 20, color: "#22c55e", label: "Agradável" },
        { max: 25, color: "#eab308", label: "Quente" },
        { max: 30, color: "#f97316", label: "Muito quente" },
        { max: 35, color: "#ef4444", label: "Calor" },
        { max: Infinity, color: "#a855f7", label: "Extremo" }
    ];

    function getColorForTemp(fTemp) {
        if (typeof fTemp !== "number") {
            return "#94a3b8";
        }
        if (fTemp < 0) {
            return TEMPERATURE_LEGEND[0].color;
        }
        if (fTemp < 10) {
            return TEMPERATURE_LEGEND[1].color;
        }
        if (fTemp < 20) {
            return TEMPERATURE_LEGEND[2].color;
        }
        if (fTemp < 25) {
            return TEMPERATURE_LEGEND[3].color;
        }
        if (fTemp < 30) {
            return TEMPERATURE_LEGEND[4].color;
        }
        if (fTemp <= 35) {
            return TEMPERATURE_LEGEND[5].color;
        }
        return TEMPERATURE_LEGEND[6].color;
    }

    function getLabelForTemp(fTemp) {
        if (typeof fTemp !== "number") {
            return "Sem dados";
        }
        if (fTemp < 0) {
            return TEMPERATURE_LEGEND[0].label;
        }
        if (fTemp < 10) {
            return TEMPERATURE_LEGEND[1].label;
        }
        if (fTemp < 20) {
            return TEMPERATURE_LEGEND[2].label;
        }
        if (fTemp < 25) {
            return TEMPERATURE_LEGEND[3].label;
        }
        if (fTemp < 30) {
            return TEMPERATURE_LEGEND[4].label;
        }
        if (fTemp <= 35) {
            return TEMPERATURE_LEGEND[5].label;
        }
        return TEMPERATURE_LEGEND[6].label;
    }

    function _collectRingCoords(aRing, aCoords) {
        aRing.forEach(function (aPoint) {
            aCoords.push(aPoint);
        });
    }

    function getFeatureCentroid(oGeometry) {
        var aCoords = [];

        if (oGeometry.type === "Polygon") {
            _collectRingCoords(oGeometry.coordinates[0], aCoords);
        } else if (oGeometry.type === "MultiPolygon") {
            oGeometry.coordinates.forEach(function (aPolygon) {
                _collectRingCoords(aPolygon[0], aCoords);
            });
        }

        if (!aCoords.length) {
            return { lat: 0, lon: 0 };
        }

        var fLonSum = 0;
        var fLatSum = 0;

        aCoords.forEach(function (aPoint) {
            fLonSum += aPoint[0];
            fLatSum += aPoint[1];
        });

        return {
            lat: fLatSum / aCoords.length,
            lon: fLonSum / aCoords.length
        };
    }

    function _applyClimateToCountry(oCountry, fTemp) {
        if (typeof fTemp !== "number") {
            return Object.assign({}, oCountry, {
                temp: null,
                color: "#94a3b8",
                label: "Sem dados"
            });
        }

        return Object.assign({}, oCountry, {
            temp: Math.round(fTemp * 10) / 10,
            color: getColorForTemp(fTemp),
            label: getLabelForTemp(fTemp)
        });
    }

    function _refreshCountryColors(aCountries) {
        return aCountries.map(function (oCountry) {
            if (oCountry.temp === null) {
                return Object.assign({}, oCountry, {
                    color: "#94a3b8",
                    label: "Sem dados"
                });
            }

            return Object.assign({}, oCountry, {
                color: getColorForTemp(oCountry.temp),
                label: getLabelForTemp(oCountry.temp)
            });
        });
    }

    function _loadFromStorage() {
        try {
            var sRaw = window.sessionStorage.getItem(STORAGE_KEY);
            if (!sRaw) {
                return null;
            }

            var oStored = JSON.parse(sRaw);
            if (!oStored || !oStored.items || !oStored.timestamp) {
                return null;
            }

            if ((Date.now() - oStored.timestamp) >= CACHE_DURATION_MS) {
                window.sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return oStored.items;
        } catch (oError) {
            return null;
        }
    }

    function _saveToStorage(aCountries) {
        try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                timestamp: Date.now(),
                items: aCountries.map(function (oCountry) {
                    return {
                        id: oCountry.id,
                        temp: oCountry.temp,
                        color: oCountry.color,
                        label: oCountry.label
                    };
                })
            }));
        } catch (oError) {
            // Ignora limite de storage.
        }
    }

    function _mergeStoredClimate(aPrepared, aStoredItems) {
        var oMap = {};

        aStoredItems.forEach(function (oItem) {
            oMap[oItem.id] = oItem;
        });

        return aPrepared.map(function (oCountry) {
            var oStored = oMap[oCountry.id];
            if (!oStored || oStored.temp === null) {
                return Object.assign({}, oCountry, {
                    temp: null,
                    color: "#94a3b8",
                    label: "Sem dados"
                });
            }

            return Object.assign({}, oCountry, {
                temp: oStored.temp,
                color: getColorForTemp(oStored.temp),
                label: getLabelForTemp(oStored.temp)
            });
        });
    }

    function loadCountriesGeoJson() {
        if (oCache.geojson) {
            return Promise.resolve(oCache.geojson);
        }

        return fetch(COUNTRIES_GEOJSON_URL)
            .then(function (oResponse) {
                if (!oResponse.ok) {
                    throw new Error("GeoJSON indisponível (" + oResponse.status + ")");
                }
                return oResponse.json();
            })
            .then(function (oGeoJson) {
                if (!oGeoJson || !oGeoJson.features || !oGeoJson.features.length) {
                    throw new Error("GeoJSON de países inválido");
                }

                oCache.geojson = oGeoJson;
                return oGeoJson;
            });
    }

    function _prepareCountries(oGeoJson) {
        if (oCache.prepared) {
            return oCache.prepared;
        }

        oCache.prepared = oGeoJson.features
            .filter(function (oFeature) {
                return oFeature.geometry && oFeature.properties;
            })
            .map(function (oFeature, iIndex) {
                var oCentroid = getFeatureCentroid(oFeature.geometry);
                var sName = oFeature.properties.NAME
                    || oFeature.properties.ADMIN
                    || oFeature.properties.BRK_NAME
                    || ("País " + iIndex);

                return {
                    id: String(iIndex),
                    name: sName,
                    feature: oFeature,
                    centerLat: oCentroid.lat,
                    centerLon: oCentroid.lon
                };
            });

        return oCache.prepared;
    }

    function _fetchPointClimate(fLat, fLon) {
        var sUrl = "https://api.open-meteo.com/v1/forecast?latitude="
            + fLat.toFixed(4) + "&longitude=" + fLon.toFixed(4)
            + "&current=temperature_2m&timezone=auto";

        return fetch(sUrl)
            .then(function (oResponse) {
                if (!oResponse.ok) {
                    throw new Error("Open-Meteo " + oResponse.status);
                }
                return oResponse.json();
            })
            .then(function (oData) {
                var fTemp = oData && oData.current && oData.current.temperature_2m;
                return _applyClimateToCountry({
                    centerLat: fLat,
                    centerLon: fLon
                }, fTemp);
            });
    }

    function _fetchBulkClimateBatch(aCountries) {
        var sLats = aCountries.map(function (oCountry) {
            return oCountry.centerLat.toFixed(4);
        }).join(",");
        var sLons = aCountries.map(function (oCountry) {
            return oCountry.centerLon.toFixed(4);
        }).join(",");
        var sUrl = "https://api.open-meteo.com/v1/forecast?latitude="
            + sLats + "&longitude=" + sLons
            + "&current=temperature_2m&timezone=auto";

        return fetch(sUrl)
            .then(function (oResponse) {
                if (!oResponse.ok) {
                    throw new Error("Open-Meteo " + oResponse.status);
                }
                return oResponse.json();
            })
            .then(function (aResults) {
                if (!Array.isArray(aResults)) {
                    aResults = [aResults];
                }

                return aCountries.map(function (oCountry, iIndex) {
                    var oData = aResults[iIndex];
                    var fTemp = oData && oData.current && oData.current.temperature_2m;
                    return _applyClimateToCountry(oCountry, fTemp);
                });
            });
    }

    function _fetchAllClimate(aCountries, fnOnProgress) {
        var aChunks = [];
        var i;

        for (i = 0; i < aCountries.length; i += BULK_CHUNK_SIZE) {
            aChunks.push(aCountries.slice(i, i + BULK_CHUNK_SIZE));
        }

        return Promise.all(aChunks.map(function (aChunk) {
            return _fetchBulkClimateBatch(aChunk).then(function (aChunkResults) {
                if (typeof fnOnProgress === "function") {
                    fnOnProgress(aChunkResults);
                }
                return aChunkResults;
            });
        })).then(function (aAllChunks) {
            return [].concat.apply([], aAllChunks);
        });
    }

    function _validateCountries(aCountries) {
        var aValidCountries = aCountries.filter(function (oCountry) {
            return oCountry.temp !== null;
        });

        if (!aValidCountries.length) {
            throw new Error("Nenhuma temperatura foi carregada");
        }

        return aCountries;
    }

    function _fetchCountryClimateData(oOptions) {
        oOptions = oOptions || {};
        var iNow = Date.now();

        if (oCache.countries && (iNow - oCache.timestamp) < CACHE_DURATION_MS) {
            var aCached = _refreshCountryColors(oCache.countries);
            if (typeof oOptions.onProgress === "function") {
                oOptions.onProgress(aCached.slice());
            }
            return Promise.resolve(aCached.slice());
        }

        return loadCountriesGeoJson().then(function (oGeoJson) {
            var aPrepared = _prepareCountries(oGeoJson);
            var aStoredItems = _loadFromStorage();

            if (aStoredItems) {
                var aMerged = _mergeStoredClimate(aPrepared, aStoredItems);
                oCache.timestamp = Date.now();
                oCache.countries = aMerged;

                if (typeof oOptions.onProgress === "function") {
                    oOptions.onProgress(aMerged.slice());
                }

                return aMerged.slice();
            }

            return _fetchAllClimate(aPrepared, oOptions.onProgress).then(function (aCountries) {
                _validateCountries(aCountries);
                oCache.timestamp = Date.now();
                oCache.countries = aCountries;
                _saveToStorage(aCountries);
                return aCountries.slice();
            });
        });
    }

    function fetchCountryClimateData(oOptions) {
        oOptions = oOptions || {};
        var iNow = Date.now();

        if (oCache.countries && (iNow - oCache.timestamp) < CACHE_DURATION_MS) {
            var aCached = _refreshCountryColors(oCache.countries);
            if (typeof oOptions.onProgress === "function") {
                oOptions.onProgress(aCached.slice());
            }
            return Promise.resolve(aCached.slice());
        }

        if (oFetchPromise) {
            return oFetchPromise.then(function (aCountries) {
                if (typeof oOptions.onProgress === "function") {
                    oOptions.onProgress(aCountries.slice());
                }
                return aCountries.slice();
            });
        }

        oFetchPromise = _fetchCountryClimateData(oOptions)
            .finally(function () {
                oFetchPromise = null;
            });

        return oFetchPromise;
    }

    function preloadCountryClimateData() {
        var iNow = Date.now();

        if (oCache.countries && (iNow - oCache.timestamp) < CACHE_DURATION_MS) {
            return Promise.resolve(oCache.countries.slice());
        }

        if (oPreloadPromise) {
            return oPreloadPromise;
        }

        oPreloadPromise = fetchCountryClimateData()
            .catch(function () {
                return null;
            })
            .finally(function () {
                oPreloadPromise = null;
            });

        return oPreloadPromise;
    }

    function fetchPointTemperature(fLat, fLon) {
        return _fetchPointClimate(fLat, fLon);
    }

    function getGeometryBbox(oGeometry) {
        var fWest = Infinity;
        var fEast = -Infinity;
        var fSouth = Infinity;
        var fNorth = -Infinity;

        function visitCoord(aPoint) {
            fWest = Math.min(fWest, aPoint[0]);
            fEast = Math.max(fEast, aPoint[0]);
            fSouth = Math.min(fSouth, aPoint[1]);
            fNorth = Math.max(fNorth, aPoint[1]);
        }

        function visitRing(aRing) {
            aRing.forEach(visitCoord);
        }

        function visitPolygon(aPolygon) {
            aPolygon.forEach(visitRing);
        }

        if (oGeometry.type === "Polygon") {
            visitPolygon(oGeometry.coordinates);
        } else if (oGeometry.type === "MultiPolygon") {
            oGeometry.coordinates.forEach(visitPolygon);
        }

        return { west: fWest, east: fEast, south: fSouth, north: fNorth };
    }

    function _bboxIntersectsRectangle(oBbox, oRectangle) {
        return !(oBbox.east < oRectangle.west ||
            oBbox.west > oRectangle.east ||
            oBbox.north < oRectangle.south ||
            oBbox.south > oRectangle.north);
    }

    function createClimateImageryProvider(Cesium, aCountries) {
        var OCEAN_COLOR = "#aadaff";
        var BORDER_COLOR = "rgba(15, 23, 42, 0.65)";
        var BORDER_WIDTH = 1;
        var aEntries = aCountries
            .filter(function (oCountry) {
                return oCountry.temp !== null &&
                    oCountry.feature &&
                    oCountry.feature.geometry;
            })
            .map(function (oCountry) {
                return {
                    color: getColorForTemp(oCountry.temp),
                    geometry: oCountry.feature.geometry,
                    bbox: getGeometryBbox(oCountry.feature.geometry)
                };
            });

        if (!aEntries.length) {
            throw new Error("Dados climáticos sem geometria de países");
        }

        function ClimateImageryProvider() {
            this._tilingScheme = new Cesium.WebMercatorTilingScheme();
            this.tileWidth = 256;
            this.tileHeight = 256;
            this.minimumLevel = 0;
            this.maximumLevel = 6;
            this.tilingScheme = this._tilingScheme;
            this.rectangle = this._tilingScheme.rectangle;
            this.ready = true;
            this.readyPromise = Promise.resolve(true);
            this.errorEvent = new Cesium.Event();
            this.credit = undefined;
            this.hasAlphaChannel = false;
        }

        function _rectangleToDegrees(oRectangle) {
            return {
                west: Cesium.Math.toDegrees(oRectangle.west),
                east: Cesium.Math.toDegrees(oRectangle.east),
                south: Cesium.Math.toDegrees(oRectangle.south),
                north: Cesium.Math.toDegrees(oRectangle.north)
            };
        }

        function _mercatorY(fLatDeg) {
            var fLatRad = fLatDeg * Math.PI / 180;
            return Math.log(Math.tan(Math.PI / 4 + fLatRad / 2));
        }

        function _coordToPixel(fLon, fLat, oRectDegrees, iSize) {
            var fNorthMerc = _mercatorY(oRectDegrees.north);
            var fSouthMerc = _mercatorY(oRectDegrees.south);
            var fLatMerc = _mercatorY(fLat);

            return {
                x: ((fLon - oRectDegrees.west) / (oRectDegrees.east - oRectDegrees.west)) * iSize,
                y: ((fNorthMerc - fLatMerc) / (fNorthMerc - fSouthMerc)) * iSize
            };
        }

        function _fillGeometry(oContext, oGeometry, oRectDegrees, iSize, sColor) {
            var fnFillRings = function (aRings) {
                oContext.beginPath();
                aRings.forEach(function (aRing) {
                    aRing.forEach(function (aCoord, iIndex) {
                        var oPixel = _coordToPixel(aCoord[0], aCoord[1], oRectDegrees, iSize);
                        if (iIndex === 0) {
                            oContext.moveTo(oPixel.x, oPixel.y);
                        } else {
                            oContext.lineTo(oPixel.x, oPixel.y);
                        }
                    });
                    oContext.closePath();
                });
                oContext.fillStyle = sColor;
                oContext.fill("evenodd");
            };

            if (oGeometry.type === "Polygon") {
                fnFillRings(oGeometry.coordinates);
            } else if (oGeometry.type === "MultiPolygon") {
                oGeometry.coordinates.forEach(function (aPolygon) {
                    fnFillRings(aPolygon);
                });
            }
        }

        function _strokeGeometry(oContext, oGeometry, oRectDegrees, iSize) {
            oContext.strokeStyle = BORDER_COLOR;
            oContext.lineWidth = BORDER_WIDTH;

            if (oGeometry.type === "Polygon") {
                oGeometry.coordinates.forEach(function (aRing) {
                    oContext.beginPath();
                    aRing.forEach(function (aCoord, iIndex) {
                        var oPixel = _coordToPixel(aCoord[0], aCoord[1], oRectDegrees, iSize);
                        if (iIndex === 0) {
                            oContext.moveTo(oPixel.x, oPixel.y);
                        } else {
                            oContext.lineTo(oPixel.x, oPixel.y);
                        }
                    });
                    oContext.closePath();
                    oContext.stroke();
                });
            } else if (oGeometry.type === "MultiPolygon") {
                oGeometry.coordinates.forEach(function (aPolygon) {
                    aPolygon.forEach(function (aRing) {
                        oContext.beginPath();
                        aRing.forEach(function (aCoord, iIndex) {
                            var oPixel = _coordToPixel(aCoord[0], aCoord[1], oRectDegrees, iSize);
                            if (iIndex === 0) {
                                oContext.moveTo(oPixel.x, oPixel.y);
                            } else {
                                oContext.lineTo(oPixel.x, oPixel.y);
                            }
                        });
                        oContext.closePath();
                        oContext.stroke();
                    });
                });
            }
        }

        ClimateImageryProvider.prototype.requestImage = function (iX, iY, iLevel) {
            var oRectangle = this._tilingScheme.tileXYToRectangle(iX, iY, iLevel);
            var oRectDegrees = _rectangleToDegrees(oRectangle);
            var oCanvas = document.createElement("canvas");
            var oContext = oCanvas.getContext("2d");
            var i;

            oCanvas.width = 256;
            oCanvas.height = 256;
            oContext.fillStyle = OCEAN_COLOR;
            oContext.fillRect(0, 0, 256, 256);

            for (i = 0; i < aEntries.length; i++) {
                if (_bboxIntersectsRectangle(aEntries[i].bbox, oRectDegrees)) {
                    _fillGeometry(oContext, aEntries[i].geometry, oRectDegrees, 256, aEntries[i].color);
                }
            }

            for (i = 0; i < aEntries.length; i++) {
                if (_bboxIntersectsRectangle(aEntries[i].bbox, oRectDegrees)) {
                    _strokeGeometry(oContext, aEntries[i].geometry, oRectDegrees, 256);
                }
            }

            return Promise.resolve(oCanvas);
        };

        return new ClimateImageryProvider();
    }

    return {
        getColorForTemp: getColorForTemp,
        getLabelForTemp: getLabelForTemp,
        fetchCountryClimateData: fetchCountryClimateData,
        preloadCountryClimateData: preloadCountryClimateData,
        fetchPointTemperature: fetchPointTemperature,
        createClimateImageryProvider: createClimateImageryProvider
    };
});
