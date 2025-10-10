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
                cidadeNome: "São Paulo",
                weatherImage: "https://images.pexels.com/photos/259620/pexels-photo-259620.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1&t=" + new Date().getTime() // imagem de sol padrão
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
            
            // Carregar dados do clima inicial para São Paulo
            this.fetchWeatherForCity("São Paulo");
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
            console.log("🔘 BOTÃO BUSCAR PRESSIONADO!");
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

                    var oViewModel = that.getView().getModel("viewModel");
                    oViewModel.setProperty("/lat", lat);
                    oViewModel.setProperty("/long", lon);
                    oViewModel.setProperty("/cidadeNome", sQuery);
                })
                .catch(err => {
                    console.error(err);
                    MessageToast.show("Erro ao buscar localização.");
                });
        },


        onBuscarClima: function () {
            var sCidade = this.byId("cityInput").getValue();
            console.log("🔍 onBuscarClima chamado para cidade:", sCidade);
            
            if (!sCidade) {
                MessageToast.show("Digite uma cidade.");
                return;
            }

            var sChaveAPI = "d6da45bb98ec8fca6ff1ea2cfa6b8674";
            var sUrlWeather = "https://api.openweathermap.org/data/2.5/weather?q=" +
                encodeURIComponent(sCidade) + "&appid=" + sChaveAPI + "&units=metric";

            console.log("📡 Fazendo requisição para:", sUrlWeather);

            fetch(sUrlWeather)
                .then(res => res.json())
                .then(dados => {
                    console.log("✅ Resposta da API /weather:", dados);

                    if (!dados.coord) {
                        throw new Error("Coordenadas não encontradas para esta cidade.");
                    }

                    // Salvar dados atuais no weatherModel
                    var oWeatherModel = new sap.ui.model.json.JSONModel(dados);
                    this.getView().setModel(oWeatherModel, "weatherModel");

                    // Atualizar recomendação baseada no clima
                    console.log("⏩ Prestes a chamar updateRecommendation...");
                    this.updateRecommendation(dados);
                    console.log("✔️ updateRecommendation chamado com sucesso!");

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

        getWeatherImage: function(weatherMain, weatherDescription) {
            // Cache buster para forçar o refresh da imagem
            var timestamp = new Date().getTime();
            
            console.log("getWeatherImage chamado com:", weatherMain, "-", weatherDescription);
            
            // Converter descrição para minúscula para facilitar comparação
            var desc = weatherDescription ? weatherDescription.toLowerCase() : '';
            
            // Imagem de chuva para qualquer tipo de precipitação
            var isRainy = weatherMain === 'Rain' || 
                         weatherMain === 'Drizzle' || 
                         weatherMain === 'Thunderstorm' ||
                         desc.includes('rain') || 
                         desc.includes('drizzle') || 
                         desc.includes('shower') ||
                         desc.includes('thunderstorm');
            
            if (isRainy) {
                console.log("-> Retornando imagem de CHUVA");
                return 'https://images.pexels.com/photos/1463530/pexels-photo-1463530.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1&t=' + timestamp;
            }
            
            // Imagem de sol para todos os outros casos (Clear, Clouds, etc)
            console.log("-> Retornando imagem de SOL");
            return 'https://images.pexels.com/photos/259620/pexels-photo-259620.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1&t=' + timestamp;
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

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/lat", lat);
            oViewModel.setProperty("/long", lon);
            oViewModel.setProperty("/cidadeNome", cityName);
            
            // Buscar dados do clima para a cidade
            this.fetchWeatherForCity(cityName);
        },
        
        fetchWeatherForCity: function(cityName) {
            console.log("🌍 Buscando clima para:", cityName);
            var sChaveAPI = "d6da45bb98ec8fca6ff1ea2cfa6b8674";
            var sUrlWeather = "https://api.openweathermap.org/data/2.5/weather?q=" +
                encodeURIComponent(cityName) + "&appid=" + sChaveAPI + "&units=metric";

            fetch(sUrlWeather)
                .then(res => res.json())
                .then(dados => {
                    console.log("📡 Resposta da API recebida para", cityName);
                    
                    if (!dados.coord) {
                        throw new Error("Coordenadas não encontradas para esta cidade.");
                    }

                    // Salvar dados atuais no weatherModel
                    var oWeatherModel = new sap.ui.model.json.JSONModel(dados);
                    this.getView().setModel(oWeatherModel, "weatherModel");

                    // Atualizar recomendação baseada no clima
                    console.log("🔄 Chamando updateRecommendation...");
                    this.updateRecommendation(dados);
                })
                .catch(err => {
                    console.error("❌ Erro ao buscar clima:", err);
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
        },

        // Método para atualizar recomendações baseadas no clima
        updateRecommendation: function(weatherData) {
            console.log("▶▶▶ updateRecommendation CHAMADO ◀◀◀");
            console.log("weatherData completo:", weatherData);
            console.log("weather array:", weatherData.weather);
            
            var suggestions = [];
            var temp = weatherData.main.temp;
            var weather = weatherData.weather[0].main.toLowerCase();
            var weatherMain = weatherData.weather[0].main;
            var weatherDesc = weatherData.weather[0].description;
            var humidity = weatherData.main.humidity;
            var windSpeed = weatherData.wind.speed;
            var pressure = weatherData.main.pressure;
            var visibility = weatherData.visibility;
            var feelsLike = weatherData.main.feels_like;
            var tempMin = weatherData.main.temp_min;
            var tempMax = weatherData.main.temp_max;

            // Atualizar a imagem do clima baseada nas condições atuais
            console.log("=== ATUALIZANDO IMAGEM ===");
            console.log("Condição climática da API:", weatherMain, "-", weatherDesc);
            var weatherImageUrl = this.getWeatherImage(weatherMain, weatherDesc);
            console.log("URL da imagem selecionada:", weatherImageUrl);
            
            var oViewModel = this.getView().getModel("viewModel");
            console.log("Modelo antes:", oViewModel.getProperty("/weatherImage"));
            oViewModel.setProperty("/weatherImage", weatherImageUrl);
            console.log("Modelo depois:", oViewModel.getProperty("/weatherImage"));
            console.log("=========================");

            // 1. SUGESTÃO BASEADA NA TEMPERATURA ATUAL
            if (temp >= 30) {
                suggestions.push({
                    icon: "sap-icon://sunny",
                    text: "Dia perfeito para uma piscina ou praia ",
                    type: "Success"
                });
            } else if (temp >= 25 && temp < 30) {
                suggestions.push({
                    icon: "sap-icon://sunny",
                    text: "Que tal um piquenique no parque hoje ",
                    type: "Success"
                });
            } else if (temp >= 15 && temp < 25) {
                suggestions.push({
                    icon: "sap-icon://walking",
                    text: "Temperatura ideal para uma caminhada ao ar livre ",
                    type: "Success"
                });
            } else if (temp >= 5 && temp < 15) {
                suggestions.push({
                    icon: "sap-icon://warm-jacket",
                    text: "Dia perfeito para uma xícara de café quente ",
                    type: "Information"
                });
            } else {
                suggestions.push({
                    icon: "sap-icon://home",
                    text: "Que tal um dia aconchegante em casa com um bom filme ",
                    type: "Information"
                });
            }

            // 2. SUGESTÃO BASEADA NA CONDIÇÃO CLIMÁTICA
            if (weather.includes("rain") || weather.includes("drizzle")) {
                suggestions.push({
                    icon: "sap-icon://umbrella",
                    text: "Dia ideal para ler um bom livro em casa ",
                    type: "Information"
                });
            } else if (weather.includes("thunderstorm")) {
                suggestions.push({
                    icon: "sap-icon://home",
                    text: "Que tal organizar aquele cômodo que você sempre adia ",
                    type: "Information"
                });
            } else if (weather.includes("snow")) {
                suggestions.push({
                    icon: "sap-icon://snow",
                    text: "Dia perfeito para fazer um boneco de neve ",
                    type: "Success"
                });
            } else if (weather.includes("clear")) {
                suggestions.push({
                    icon: "sap-icon://sunny",
                    text: "Céu azul convida para uma aventura ao ar livre ",
                    type: "Success"
                });
            } else if (weather.includes("clouds")) {
                suggestions.push({
                    icon: "sap-icon://cloud",
                    text: "Clima perfeito para uma caminhada sem muito sol ",
                    type: "Information"
                });
            } else if (weather.includes("fog") || weather.includes("mist")) {
                suggestions.push({
                    icon: "sap-icon://fog",
                    text: "Ambiente misterioso para uma tarde de reflexão ",
                    type: "Information"
                });
            }

            // 3. SUGESTÃO BASEADA NA UMIDADE
            if (humidity > 80) {
                suggestions.push({
                    icon: "sap-icon://drop",
                    text: "Dia perfeito para hidratação extra e skincare ",
                    type: "Information"
                });
            } else if (humidity < 30) {
                suggestions.push({
                    icon: "sap-icon://hydration",
                    text: "Que tal experimentar uma bebida refrescante nova ",
                    type: "Information"
                });
            } else {
                suggestions.push({
                    icon: "sap-icon://drop",
                    text: "Condições ideais para aproveitar o dia com conforto ",
                    type: "Success"
                });
            }

            // 4. SUGESTÃO BASEADA NO VENTO
            if (windSpeed > 15) {
                suggestions.push({
                    icon: "sap-icon://flight",
                    text: "Dia perfeito para soltar pipas",
                    type: "Success"
                });
            } else if (windSpeed > 8) {
                suggestions.push({
                    icon: "sap-icon://wind",
                    text: "Brisa agradável para uma caminhada revigorante ",
                    type: "Information"
                });
            } else {
                suggestions.push({
                    icon: "sap-icon://wind",
                    text: "Ar parado convida para um momento de paz interior ",
                    type: "Information"
                });
            }

            // 5. SUGESTÃO BASEADA NA SENSATION TÉRMICA
            var tempDiff = Math.abs(feelsLike - temp);
            if (tempDiff > 3) {
                if (feelsLike > temp) {
                    suggestions.push({
                        icon: "sap-icon://thermometer",
                        text: "Que tal uma bebida gelada refrescante ",
                        type: "Information"
                    });
                } else {
                    suggestions.push({
                        icon: "sap-icon://thermometer",
                        text: "Momento ideal para um abraço quentinho ",
                        type: "Information"
                    });
                }
            } else {
                suggestions.push({
                    icon: "sap-icon://thermometer",
                    text: "Temperatura perfeita para se sentir confortável ",
                    type: "Success"
                });
            }

            // 6. SUGESTÃO BASEADA NA VISIBILIDADE
            if (visibility < 1000) {
                suggestions.push({
                    icon: "sap-icon://fog",
                    text: "Ambiente misterioso perfeito para uma sessão de meditação ",
                    type: "Information"
                });
            } else if (visibility < 5000) {
                suggestions.push({
                    icon: "sap-icon://weather-cloud",
                    text: "Clima aconchegante para uma tarde de jogos em família ",
                    type: "Information"
                });
            } else {
                suggestions.push({
                    icon: "sap-icon://eye",
                    text: "Dia claro convida para explorar novos lugares ",
                    type: "Success"
                });
            }

            // 7. SUGESTÃO BASEADA NA PRESSÃO E VARIAÇÃO TÉRMICA
            var tempVariation = tempMax - tempMin;
            if (pressure < 1000) {
                suggestions.push({
                    icon: "sap-icon://weather-cloud",
                    text: "Dia de mudanças - perfeito para ser espontâneo ",
                    type: "Information"
                });
            } else if (pressure > 1020) {
                suggestions.push({
                    icon: "sap-icon://sunny",
                    text: "Clima estável convida para planejar o futuro ",
                    type: "Success"
                });
            } else if (tempVariation > 10) {
                suggestions.push({
                    icon: "sap-icon://thermometer",
                    text: "Dia de contrastes - experimente algo diferente ",
                    type: "Information"
                });
            } else {
                suggestions.push({
                    icon: "sap-icon://weather-cloud",
                    text: "Dia equilibrado para encontrar harmonia interior ",
                    type: "Information"
                });
            }

            // Atualizar o modelo com as sugestões
            var oSuggestionsModel = new sap.ui.model.json.JSONModel({
                suggestions: suggestions
            });
            this.getView().setModel(oSuggestionsModel, "suggestionsModel");
        }

    });
});