sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
], function(Controller, MessageToast,) {
    "use strict";

    return Controller.extend("alan.projetos.projetinho.controller.View1", {

        onInit() {
            var oViewModel = new sap.ui.model.json.JSONModel({
                lat: -23.5505,
                long: -46.6333,
                cidadeNome: "São Paulo"
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Configurar GeoMap com OpenStreetMap
            var oGeoMap = this.byId("geoMap");
            
            var url = `https://tile.openstreetmap.org/{LOD}/{X}/{Y}.png`;
            var oMapConfig = {
                "MapProvider": [{
                    "name": "OPENSTREETMAP",
                    "type": "",
                    "description": "OpenStreetMap",
                    "tileX": "256",
                    "tileY": "256",
                    "maxLOD": "20",
                    "copyright": "© OpenStreetMap contributors",
                    "Source": [{
                        "id": "s1",
                        "url": url
                    }]
                }],
                "MapLayerStacks": [{
                    "name": "DEFAULT",
                    "MapLayer": {
                        "name": "layer1",
                        "refMapProvider": "OPENSTREETMAP",
                        "opacity": "1.0",
                        "colBkgnd": "RGB(255,255,255)",
                    }
                }]
            };

            oGeoMap.setMapConfiguration(oMapConfig);
            oGeoMap.setRefMapLayerStack("DEFAULT");
            
            // Inicializar modelo para a hora atual
            var oTimeModel = new sap.ui.model.json.JSONModel({
                currentTime: this.getCurrentTime()
            });
            this.getView().setModel(oTimeModel);
            
            // Atualizar a hora a cada segundo
            this._timeInterval = setInterval(() => {
                this.getView().getModel().setProperty("/currentTime", this.getCurrentTime());
            }, 1000);
        },

        onExit: function() {
            // Limpar o intervalo quando o controller for destruído
            if (this._timeInterval) {
                clearInterval(this._timeInterval);
            }
        },

        getCurrentTime: function() {
            var now = new Date();
            var hours = now.getHours();
            var minutes = now.getMinutes();
            
            // Formatar com zero à esquerda se necessário
            hours = hours < 10 ? '0' + hours : hours;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            
            return hours + ':' + minutes;
        },


        onButtonPress: function () {
            this.onSearchLocation();
            this.onBuscarClima();
        },


        onSearchLocation: function () {
            var sQuery = this.byId("cityInput").getValue();
            if (!sQuery) return;

            var that = this;
            
            fetch("https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(sQuery))
                .then(response => response.json())
                .then(data => {
                    if (data.length === 0) {
                        MessageToast.show("Local não encontrado.");
                        return;
                    } 

                    var oGeoMap = that.byId("geoMap");
                    var lat = parseFloat(data[0].lat);
                    var lon = parseFloat(data[0].lon);

                    oGeoMap.setCenterPosition(lon + ";" + lat);
                    oGeoMap.setZoomlevel(11);

                    that.getView().getModel("viewModel").setData({
                        lat: lat,
                        long: lon,
                        cidadeNome: sQuery
                    });
                })
                .catch(err => {
                    console.error(err);
                    MessageToast.show("Erro ao buscar localização.");
                });
        },


        onBuscarClima: function () {
            var sCidade = this.byId("cityInput").getValue();
            if (!sCidade) {
                MessageToast.show("Digite uma cidade.");
                return;
            }

            var sChaveAPI = "d6da45bb98ec8fca6ff1ea2cfa6b8674";
            var sUrlWeather = "https://api.openweathermap.org/data/2.5/weather?q=" +
                encodeURIComponent(sCidade) + "&appid=" + sChaveAPI + "&units=metric";

            fetch(sUrlWeather)
                .then(res => res.json())
                .then(dados => {
                    console.log("Resposta da API /weather:", dados);

                    if (!dados.coord) {
                        throw new Error("Coordenadas não encontradas para esta cidade.");
                    }

                    // Salvar dados atuais no weatherModel
                    var oWeatherModel = new sap.ui.model.json.JSONModel(dados);
                    this.getView().setModel(oWeatherModel, "weatherModel");

                    // Atualizar recomendação baseada no clima
                    this.updateRecommendation(dados);

                    var lat = dados.coord.lat;
                    var lon = dados.coord.lon;

                    console.log("Latitude:", lat, "Longitude:", lon);

                    var sUrlForecast = "https://api.openweathermap.org/data/2.5/forecast?" +
                        "lat=" + lat + "&lon=" + lon + "&appid=" + sChaveAPI + "&units=metric";

                    return fetch(sUrlForecast);
                })
                .then(res => res.json())
                .then(data => {
                    const forecasts = data.list;
                    const dailyForecasts = [];

                    const hoje = new Date();
                    const diasSemana = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
                    
                    // Mapeamento de descrições do clima em inglês para português
                    const weatherDescriptions = {
                        'clear sky': 'céu limpo',
                        'few clouds': 'poucas nuvens',
                        'scattered clouds': 'nuvens dispersas',
                        'broken clouds': 'nuvens quebradas',
                        'overcast clouds': 'nublado',
                        'light rain': 'chuva leve',
                        'moderate rain': 'chuva moderada',
                        'heavy rain': 'chuva forte',
                        'thunderstorm': 'tempestade',
                        'snow': 'neve',
                        'mist': 'névoa',
                        'fog': 'névoa',
                        'haze': 'névoa',
                        'smoke': 'fumaça',
                        'dust': 'poeira',
                        'sand': 'areia',
                        'ash': 'cinzas',
                        'squall': 'rajada',
                        'tornado': 'tornado',
                        'drizzle': 'chuvisco',
                        'heavy intensity rain': 'chuva forte',
                    };
                    
                    const dailyData = {};
                    
                    forecasts.forEach(forecast => {
                        const date = new Date(forecast.dt * 1000);
                        const dayKey = date.toISOString().split("T")[0];
                        const hour = date.getHours();
                        
                        // Se não existe entrada para este dia ou se esta previsão é mais próxima do meio-dia
                        if (!dailyData[dayKey] || Math.abs(hour - 12) < Math.abs(dailyData[dayKey].hour - 12)) {
                            dailyData[dayKey] = {
                                date: dayKey,
                                hour: hour,
                                forecast: forecast
                            };
                        }
                    });
                    
                    // Obter previsões disponíveis (primeiros 5 dias)
                    const availableForecasts = Object.values(dailyData)
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .slice(0, 5);
                    
                    // Processar previsões disponíveis
                    availableForecasts.forEach(dayData => {
                        const date = new Date(dayData.forecast.dt * 1000);
                        const diaSemana = diasSemana[date.getDay()];
                        const weatherDesc = dayData.forecast.weather[0].description.toLowerCase();
                        const descricaoPT = weatherDescriptions[weatherDesc] || weatherDesc;
                        
                            const tempMax = Math.round(dayData.forecast.main.temp_max);
                            dailyForecasts.push({
                                date: dayData.date,
                                dia: diaSemana,
                                temperature: Math.round(dayData.forecast.main.temp),
                                tempMax: tempMax,
                                weather: descricaoPT,
                                description: descricaoPT,
                                icon: this.getWeatherIcon(dayData.forecast.weather[0].main),
                                tempColor: this.getTemperatureColor(tempMax)
                            });
                    });
                    
                    // Calcular média para os dias 6 e 7 baseado nos dias 4 e 5
                    if (availableForecasts.length >= 4) {
                        const dia4 = availableForecasts[3];
                        const dia5 = availableForecasts[4];
                        
                        const tempMedia6 = Math.round((dia4.forecast.main.temp + dia5.forecast.main.temp) / 2);
                        const tempMaxMedia6 = Math.round((dia4.forecast.main.temp_max + dia5.forecast.main.temp_max) / 2);
                        const tempMedia7 = Math.round((dia4.forecast.main.temp + dia5.forecast.main.temp) / 2);
                        const tempMaxMedia7 = Math.round((dia4.forecast.main.temp_max + dia5.forecast.main.temp_max) / 2);
                        
                        // Determinar clima baseado na média do dia 4 e 5 
                        const weatherMain6 = dia4.forecast.weather[0].main;
                        const weatherDesc6 = dia4.forecast.weather[0].description.toLowerCase();
                        const descricaoPT6 = weatherDescriptions[weatherDesc6] || weatherDesc6;
                        
                        const weatherMain7 = dia5.forecast.weather[0].main;
                        const weatherDesc7 = dia5.forecast.weather[0].description.toLowerCase();
                        const descricaoPT7 = weatherDescriptions[weatherDesc7] || weatherDesc7;
                        
                        //Serve para calcular sabado e domingo
                        const dataSabado = new Date(dia5.date);
                        dataSabado.setDate(dataSabado.getDate() + 1);
                        const dataDomingo = new Date(dia5.date);
                        dataDomingo.setDate(dataDomingo.getDate() + 2);
                        
                        dailyForecasts.push({
                            date: dataSabado.toISOString().split("T")[0],
                            dia: 'sáb.',
                            temperature: tempMedia6,
                            tempMax: tempMaxMedia6,
                            weather: descricaoPT6,
                            description: descricaoPT6,
                            icon: this.getWeatherIcon(weatherMain6),
                            tempColor: this.getTemperatureColor(tempMaxMedia6)
                        });
                        
                        dailyForecasts.push({
                            date: dataDomingo.toISOString().split("T")[0],
                            dia: 'dom.',
                            temperature: tempMedia7,
                            tempMax: tempMaxMedia7,
                            weather: descricaoPT7,
                            description: descricaoPT7,
                            icon: this.getWeatherIcon(weatherMain7),
                            tempColor: this.getTemperatureColor(tempMaxMedia7)
                        });
                    }
                    
                    const organizedForecasts = this.organizeForecastsByWeek(dailyForecasts);

                    var oForecastModel = new sap.ui.model.json.JSONModel(organizedForecasts);
                    console.log("Previsão semanal organizada:", organizedForecasts); 
                    this.getView().setModel(oForecastModel, "forecastModel");
                })
                .catch(err => {
                    MessageToast.show("Erro ao buscar clima: " + err.message);
                });
        },

        getWeatherIcon: function(weatherMain) {
            const iconMap = {
                'Clear': 'sap-icon://light-mode',
                'Clouds': 'sap-icon://cloud',
                'Rain': 'sap-icon://umbrella',
                'Snow': 'sap-icon://weather-snow',
                'Thunderstorm': 'sap-icon://weather-lightning',
                'Drizzle': 'sap-icon://umbrella',
                'Mist': 'sap-icon://weather-cloud',
                'Smoke': 'sap-icon://weather-cloud',
                'Haze': 'sap-icon://weather-cloud',
                'Dust': 'sap-icon://weather-cloud',
                'Fog': 'sap-icon://weather-cloud',
                'Sand': 'sap-icon://weather-cloud',
                'Ash': 'sap-icon://weather-cloud',
                'Squall': 'sap-icon://weather-lightning',
                'Tornado': 'sap-icon://weather-lightning'
            };
            return iconMap[weatherMain] || 'sap-icon://weather-cloud';
        },

        getTemperatureColor: function(temperature) {
            if (temperature >= 30) {
                return 'Error';
            } else if (temperature >= 20 && temperature < 30) {
                return 'Critical';
            } else if (temperature >= 10 && temperature < 20) {
                return 'Good'; 
            } else {
                return 'Neutral';
            }
        },

        formatTemperatureState: function(temperature) {
            if (!temperature && temperature !== 0) return 'None';
            
            if (temperature >= 30) {
                return 'Error';
            } else if (temperature >= 20) {
                return 'Warning'; 
            } else if (temperature >= 10) {
                return 'Success';
            } else {
                return 'Information';  
            }
        },

        formatTemperature: function(temperature) {
            if (!temperature && temperature !== 0) return '';
            return Math.round(temperature) + '°C';
        },

        organizeForecastsByWeek: function(forecasts) {
            const dayOrder = {
                'seg.': 1,
                'ter.': 2,
                'qua.': 3,
                'qui.': 4,
                'sex.': 5,
                'sáb.': 6,
                'dom.': 7
            };
            
            return forecasts.sort((a, b) => {
                const dayA = dayOrder[a.dia] || 0;
                const dayB = dayOrder[b.dia] || 0;
                return dayA - dayB;
            });
        },

        navigateToCity: function(cityName, lat, lon) {
            var oGeoMap = this.byId("geoMap");
            
            oGeoMap.setCenterPosition(lon + ";" + lat + ";0");
            oGeoMap.setZoomlevel(11);

            this.getView().getModel("viewModel").setData({
                lat: lat,
                long: lon,
                cidadeNome: cityName
            });
        },

        // São Paulo
        onNavigateToSaoPaulo: function() {
            this.navigateToCity("São Paulo", -23.5505, -46.6333);
        },

        // Rio Grande Do Sul
        onNavigateToRioGrandeDoSul: function() {
            this.navigateToCity("Rio Grande Do Sul", -29.9972, -51.1761);
        },

        // Rio de Janeiro
        onNavigateToRio: function() {
            this.navigateToCity("Rio de Janeiro", -22.9068, -43.1729);
        },

        // Brasília
        onNavigateToBrasilia: function() {
            this.navigateToCity("Brasília", -15.8267, -47.9218);
        },

        // Salvador
        onNavigateToSalvador: function() {
            this.navigateToCity("Salvador", -12.9714, -38.5014);
        }

    });
});