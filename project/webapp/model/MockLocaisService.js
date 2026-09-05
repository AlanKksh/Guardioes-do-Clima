sap.ui.define([], function () {
    "use strict";

    var oCache = null;

    /** Ícones e títulos fixos por tema (apresentação ao público). */
    var TOPICOS_CONFIG = {
        museu: {
            id: "museu",
            titulo: "Cultura e museus",
            icone: "sap-icon://education",
            textoVazio: "Ainda não temos um museu cadastrado para este local.",
            montarTexto: function (sNome) {
                return "Vale a pena conhecer o " + sNome + " — um ótimo programa cultural na cidade.";
            }
        },
        estadio: {
            id: "estadio",
            titulo: "Esporte e estádios",
            icone: "sap-icon://soccer",
            textoVazio: "Ainda não temos um estádio cadastrado para este local.",
            montarTexto: function (sNome) {
                return "Para quem curte esporte, o destaque é o " + sNome + ".";
            }
        },
        parque: {
            id: "parque",
            titulo: "Natureza e parques",
            icone: "sap-icon://tree",
            textoVazio: "Ainda não temos um parque cadastrado para este local.",
            montarTexto: function (sNome) {
                return "Para respirar ar puro e relaxar, visite o " + sNome + ".";
            }
        },
        monumento: {
            id: "monumento",
            titulo: "Monumentos e história",
            icone: "sap-icon://building",
            textoVazio: "Ainda não temos um monumento cadastrado para este local.",
            montarTexto: function (sNome) {
                return "Um marco da cidade que conta história: " + sNome + ".";
            }
        },
        atracao: {
            id: "atracao",
            titulo: "Atrações imperdíveis",
            icone: "sap-icon://map",
            textoVazio: "Ainda não temos uma atração cadastrada para este local.",
            montarTexto: function (sNome) {
                return "Não deixe de conhecer: " + sNome + " — um dos pontos mais queridos pelos visitantes.";
            }
        }
    };

    var ORDEM_TOPICOS = ["museu", "estadio", "parque", "monumento", "atracao"];

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

    function _montarTopico(sChave, sNome) {
        var oConfig = TOPICOS_CONFIG[sChave];
        var bTemNome = !!(sNome && String(sNome).trim());

        return {
            id: oConfig.id,
            titulo: oConfig.titulo,
            icone: oConfig.icone,
            nome: bTemNome ? sNome : "",
            texto: bTemNome ? oConfig.montarTexto(sNome) : oConfig.textoVazio,
            disponivel: bTemNome
        };
    }

    function _montarTopicos(oPontos) {
        oPontos = oPontos || {};
        return ORDEM_TOPICOS.map(function (sChave) {
            return _montarTopico(sChave, oPontos[sChave]);
        });
    }

    function _montarResumo(oPais, oEstado, oCidade) {
        var sCidade = oCidade.nome;
        var sEstado = oEstado.nome;
        var sPais = oPais.nome;

        if (sCidade === oEstado.capital) {
            return (
                "Conheça " + sCidade + ", capital de " + sEstado +
                " — um destino especial no " + sPais + "."
            );
        }

        return (
            "Conheça " + sCidade + ", no " + sEstado +
            " (" + sPais + "). A capital do estado é " + oEstado.capital + "."
        );
    }

    function _montarResultado(oPais, oEstado, oCidade) {
        var oPontos = oCidade.pontos || {};
        var aTopicos = _montarTopicos(oPontos);

        return {
            encontrado: true,
            localPesquisado: oCidade.nome,
            tipoLocal: "Cidade",
            pais: oPais.nome,
            estado: oEstado.nome,
            capital: oEstado.capital,
            capitalPais: oPais.capital,
            resumo: _montarResumo(oPais, oEstado, oCidade),
            localizacao: {
                titulo: "Onde estamos",
                icone: "sap-icon://globe",
                texto:
                    oCidade.nome + " · " + oEstado.nome + " · " + oPais.nome
            },
            topicos: aTopicos,
            // Compatibilidade com bindings antigos
            museums: oPontos.museu
                ? [{ nome: oPontos.museu, tipo: "Museu" }]
                : [],
            stadiums: oPontos.estadio
                ? [{ nome: oPontos.estadio, tipo: "Estádio" }]
                : [],
            parks: oPontos.parque
                ? [{ nome: oPontos.parque, tipo: "Parque" }]
                : [],
            attractions: oPontos.atracao
                ? [{ nome: oPontos.atracao, tipo: "Ponto turístico" }]
                : [],
            monuments: oPontos.monumento
                ? [{ nome: oPontos.monumento, tipo: "Monumento" }]
                : []
        };
    }

    function _resultadoBase(sLocal, sTipo) {
        return {
            encontrado: false,
            localPesquisado: sLocal || "",
            tipoLocal: sTipo || "Cidade",
            pais: "—",
            estado: "—",
            capital: "—",
            capitalPais: "—",
            resumo:
                "Ainda não temos um guia turístico completo para este local. " +
                "Tente buscar outra cidade cadastrada.",
            localizacao: {
                titulo: "Onde estamos",
                icone: "sap-icon://globe",
                texto: (sLocal || "Local") + " · informações indisponíveis"
            },
            topicos: _montarTopicos({}),
            museums: [],
            stadiums: [],
            parks: [],
            attractions: [],
            monuments: []
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
         * Retorna país, estado, capital e tópicos turísticos prontos para a UI.
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
            return _resultadoBase(sLocal, sTipo);
        }
    };
});
