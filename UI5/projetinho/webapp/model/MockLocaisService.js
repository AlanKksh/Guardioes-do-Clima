sap.ui.define([], function () {
    "use strict";

    var oCache = null;

    function _normalizar(sTexto) {
        return String(sTexto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    function _cidadeBate(oCidade, sBusca) {
        var sNome = _normalizar(oCidade.nome);
        if (sNome === sBusca) {
            return true;
        }

        var aAliases = oCidade.aliases || [];
        return aAliases.some(function (sAlias) {
            return _normalizar(sAlias) === sBusca;
        });
    }

    function _montarResultado(oPais, oEstado, oCidade) {
        var oPontos = oCidade.pontos || {};

        function _item(sNome, sTipo) {
            if (!sNome) {
                return [];
            }
            return [{ nome: sNome, tipo: sTipo }];
        }

        return {
            encontrado: true,
            localPesquisado: oCidade.nome,
            tipoLocal: "Cidade",
            pais: oPais.nome,
            estado: oEstado.nome,
            capital: oEstado.capital,
            capitalPais: oPais.capital,
            museums: _item(oPontos.museu, "Museu"),
            stadiums: _item(oPontos.estadio, "Estádio"),
            parks: _item(oPontos.parque, "Parque"),
            attractions: _item(oPontos.atracao, "Ponto turístico"),
            monuments: _item(oPontos.monumento, "Monumento")
        };
    }

    return {
        /**
         * Carrega o JSON mock (como se fosse uma API local).
         */
        carregarDados: function () {
            if (oCache) {
                return Promise.resolve(oCache);
            }

            var sUrl = sap.ui.require.toUrl(
                "alan/projetos/projetinho/model/mockLocais.json"
            );

            return fetch(sUrl)
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error("Falha ao carregar mockLocais.json");
                    }
                    return response.json();
                })
                .then(function (oDados) {
                    oCache = oDados;
                    return oCache;
                });
        },

        /**
         * Busca cidade pelo nome digitado no campo de clima.
         * Retorna país, estado, capital do estado e pontos turísticos.
         */
        buscarPorCidade: function (sCidade) {
            var sBusca = _normalizar(sCidade);

            if (!sBusca) {
                return Promise.resolve(null);
            }

            return this.carregarDados().then(function (oDados) {
                var aPaises = (oDados && oDados.paises) || [];

                for (var i = 0; i < aPaises.length; i++) {
                    var oPais = aPaises[i];
                    var aEstados = oPais.estados || [];

                    for (var j = 0; j < aEstados.length; j++) {
                        var oEstado = aEstados[j];
                        var aCidades = oEstado.cidades || [];

                        for (var k = 0; k < aCidades.length; k++) {
                            var oCidade = aCidades[k];
                            if (_cidadeBate(oCidade, sBusca)) {
                                return _montarResultado(oPais, oEstado, oCidade);
                            }
                        }
                    }
                }

                return null;
            });
        },

        resultadoVazio: function (sLocal, sTipo) {
            return {
                encontrado: false,
                localPesquisado: sLocal || "",
                tipoLocal: sTipo || "Cidade",
                pais: "—",
                estado: "—",
                capital: "—",
                capitalPais: "—",
                museums: [],
                stadiums: [],
                parks: [],
                attractions: [],
                monuments: []
            };
        }
    };
});
