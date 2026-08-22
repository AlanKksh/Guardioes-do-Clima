sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "alan/projetos/projetinho/model/MockLocaisService",
    "alan/projetos/projetinho/util/PageNavigation"
], function(Controller, MessageToast, MockLocaisService, PageNavigation) {
    "use strict";

    return Controller.extend("alan.projetos.projetinho.controller.View1", {

        onInit() {
            var oViewModel = new sap.ui.model.json.JSONModel({
                lat: -23.5505,
                long: -46.6333,
                cidadeNome: "São Paulo",
                weatherImage: "../assets/logo-marca.jpeg"
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
            
            // Definir dados padrão de São Paulo
            var iDefaultTemp = Math.round(25);
            var iDefaultHumidity = 60;
            var iDefaultWind = 5;

            var oWeatherModel = new sap.ui.model.json.JSONModel({
                main: {
                    temp: iDefaultTemp,
                    feels_like: iDefaultTemp,
                    temp_min: iDefaultTemp - 2,
                    temp_max: iDefaultTemp + 3,
                    humidity: iDefaultHumidity
                },
                wind: {
                    speed: iDefaultWind
                },
                weather: [{
                    main: "Clear",
                    description: "clear sky"
                }],
                dynamicText: "Mais Ensolarado",
                isSunny: true,
                weatherIcon: "sap-icon://light-mode",
                weatherColor: "#FFA500",
                humidityStatus: this._getHumidityStatus(iDefaultHumidity),
                heatStatus: this._getHeatStatus(iDefaultTemp),
                windStatus: this._getWindStatus(iDefaultTemp, iDefaultWind)
            });
            this.getView().setModel(oWeatherModel, "weatherModel");
            
            // Inicializar forecastModel vazio
            var oForecastModel = new sap.ui.model.json.JSONModel([]);
            this.getView().setModel(oForecastModel, "forecastModel");

            // Modelo inicial para o gráfico horário
            var oHourlyChartModel = new sap.ui.model.json.JSONModel({
                points: this.getDefaultHourlyChartData()
            });
            this.getView().setModel(oHourlyChartModel, "hourlyChartModel");
            
            // Carregar dados do clima inicial para São Paulo
            this.fetchWeatherForCity("São Paulo");

            PageNavigation.init(this, "page1");
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
            console.log("Botão buscar pressionado!");
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


        getDefaultHourlyChartData: function() {
            const targetHours = [7, 9, 12, 15, 17, 20, 0];
            return targetHours.map(hour => ({
                hourLabel: this._formatHourLabel(hour),
                temperature: 0
            }));
        },

        updateHourlyChart: function(forecasts, timezoneOffset) {
            if (!Array.isArray(forecasts) || forecasts.length === 0) {
                return;
            }

            const points = this.buildHourlyChartPoints(forecasts, timezoneOffset);
            var oModel = this.getView().getModel("hourlyChartModel");
            if (!oModel) {
                oModel = new sap.ui.model.json.JSONModel();
                this.getView().setModel(oModel, "hourlyChartModel");
            }
            oModel.setProperty("/points", points);
        },

        buildHourlyChartPoints: function(forecasts, timezoneOffset) {
            const targetHours = [7, 9, 12, 15, 17, 20, 0];
            const normalizedForecasts = this._getTodayForecastsWithLocalDate(forecasts, timezoneOffset);

            if (!normalizedForecasts.length) {
                return this.getDefaultHourlyChartData();
            }

            const points = targetHours.map(targetHour => {
                const relevantForecasts = normalizedForecasts.filter(item => {
                    return this._getHourDifference(item.hour, targetHour) <= 1;
                });

                if (relevantForecasts.length) {
                    const avgTemp = this._calculateAverageTemperature(relevantForecasts);
                    return {
                        hourLabel: this._formatHourLabel(targetHour),
                        temperature: avgTemp
                    };
                }

                const interpolatedTemp = this._calculateAverageFromNearest(normalizedForecasts, targetHour);
                if (interpolatedTemp !== null) {
                    return {
                        hourLabel: this._formatHourLabel(targetHour),
                        temperature: interpolatedTemp
                    };
                }

                return null;
            });

            const fallbackTemperature = this._calculateAverageTemperature(normalizedForecasts);
            return points.map((point, index) => point || {
                hourLabel: this._formatHourLabel(targetHours[index]),
                temperature: fallbackTemperature
            });
        },

        _getTodayForecastsWithLocalDate: function(forecasts, timezoneOffset) {
            const locationNow = this._getLocationCurrentDate(timezoneOffset);
            return (forecasts || [])
                .map(forecast => {
                    const localDate = this._convertToLocationDate(forecast.dt, timezoneOffset);
                    return {
                        forecast: forecast,
                        date: localDate,
                        hour: localDate.getHours()
                    };
                })
                .filter(item => this._isSameDay(item.date, locationNow));
        },

        _calculateAverageTemperature: function(items) {
            if (!Array.isArray(items) || !items.length) {
                return 0;
            }

            const sum = items.reduce((acc, item) => {
                const temperature = item.forecast
                    ? item.forecast.main.temp
                    : item.temperature;
                return acc + temperature;
            }, 0);

            return Math.round(sum / items.length);
        },

        _calculateAverageFromNearest: function(normalizedForecasts, targetHour) {
            if (!Array.isArray(normalizedForecasts) || !normalizedForecasts.length) {
                return null;
            }

            const nearest = normalizedForecasts
                .map(item => ({
                    item: item,
                    diff: this._getHourDifference(item.hour, targetHour)
                }))
                .sort((a, b) => a.diff - b.diff)
                .slice(0, 2)
                .filter(entry => entry.diff <= 4);

            if (!nearest.length) {
                return null;
            }

            const averageTemp = nearest.reduce((acc, entry) => {
                return acc + entry.item.forecast.main.temp;
            }, 0) / nearest.length;

            return Math.round(averageTemp);
        },

        _getHourDifference: function(actualHour, targetHour) {
            let diff = Math.abs(actualHour - targetHour);
            if (targetHour === 0 && actualHour >= 21) {
                diff = Math.abs((actualHour - 24) - targetHour);
            }
            return diff;
        },

        _convertToLocationDate: function(timestampInSeconds, timezoneOffset) {
            const baseDate = new Date(timestampInSeconds * 1000);
            const utcTime = baseDate.getTime() + (baseDate.getTimezoneOffset() * 60000);
            const offsetMilliseconds = (timezoneOffset || 0) * 1000;
            return new Date(utcTime + offsetMilliseconds);
        },

        _getLocationCurrentDate: function(timezoneOffset) {
            const now = new Date();
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            return new Date(utcTime + (timezoneOffset || 0) * 1000);
        },

        _isSameDay: function(dateA, dateB) {
            return dateA.getFullYear() === dateB.getFullYear() &&
                dateA.getMonth() === dateB.getMonth() &&
                dateA.getDate() === dateB.getDate();
        },

        _formatHourLabel: function(hour) {
            const normalized = hour === 24 ? 0 : hour;
            const padded = normalized < 10 ? "0" + normalized : normalized.toString();
            return padded + "h";
        },

        onBuscarClima: async function () {
            console.log(">>> ENTROU NO onBuscarClima <<<");
            var sCidade = this.byId("cityInput").getValue();
            if (!sCidade) {
                MessageToast.show("Digite uma cidade.");
                return;
            }
            console.log("onBuscarClima chamado para cidade:", sCidade);
            console.log("VALOR PESQUISADO:", sCidade);
            var infoLocal = await this.identificarLocal(sCidade);
            console.log("LOCAL IDENTIFICADO:", infoLocal);        

            var sChaveAPI = "d6da45bb98ec8fca6ff1ea2cfa6b8674";
            var sUrlWeather = "https://api.openweathermap.org/data/2.5/weather?q=" +
                encodeURIComponent(sCidade) + "&appid=" + sChaveAPI + "&units=metric";

            console.log("Fazendo requisição para:", sUrlWeather);

            fetch(sUrlWeather)
                .then(res => res.json())
                .then(dados => {
                    console.log("Resposta da API /weather:", dados);

                    if (!dados.coord) {
                        throw new Error("Coordenadas não encontradas para esta cidade.");
                    }

                    // Adicionar texto dinâmico baseado na descrição do clima
                    var weatherDescription = (dados.weather[0].description || '').toLowerCase();
                    var weatherDescriptionPT = this.getWeatherDescriptionInPortuguese(weatherDescription);
                    dados.weatherDescriptionPT = weatherDescriptionPT;
                    dados.weather[0].description = weatherDescriptionPT;
                    var dynamicText = this.getDynamicWeatherText(weatherDescription);
                    dados.dynamicText = dynamicText;
                    
                    // Obter ícone e cor baseado no tipo de clima
                    var weatherMain = dados.weather[0].main;
                    var iconAndColor = this.getWeatherIconAndColor(weatherMain);
                    dados.weatherIcon = iconAndColor.icon;
                    dados.weatherColor = iconAndColor.color;
                    console.log("Weather Main:", weatherMain, "| Icon:", iconAndColor.icon, "| Color:", iconAndColor.color);
                    
                    // Arredondar temperatura para número inteiro
                    dados.main.temp = Math.round(dados.main.temp);
                    
                    // Adicionar dados dinâmicos dos detalhes do clima
                    dados.wind.speed = Math.round(dados.wind.speed * 10) / 10; // Arredondar para 1 casa decimal
                    dados.visibility = Math.round(dados.visibility / 1000 * 10) / 10; // Converter para km
                    dados.main.humidity = Math.round(dados.main.humidity);
                    dados.main.pressure = Math.round(dados.main.pressure);
                    
                    // Calcular ponto de orvalho aproximado
                    var temp = dados.main.temp;
                    var humidity = dados.main.humidity;
                    var dewPoint = temp - ((100 - humidity) / 5);
                    dados.dewPoint = Math.round(dewPoint);
                    
                    // Gerar resumo dinâmico do clima
                    dados.weatherSummary = this.generateWeatherSummary(dados);

                    // Definir status descritivos
                    dados.humidityStatus = this._getHumidityStatus(dados.main && dados.main.humidity);
                    dados.heatStatus = this._getHeatStatus(dados.main && dados.main.temp);
                    dados.windStatus = this._getWindStatus(dados.main && dados.main.temp, dados.wind && dados.wind.speed);

                    // Salvar dados atuais no weatherModel
                    var oWeatherModel = new sap.ui.model.json.JSONModel(dados);
                    this.getView().setModel(oWeatherModel, "weatherModel");

                    // Atualizar recomendação baseada no clima
                    console.log("Prestes a chamar updateRecommendation...");
                    this.updateRecommendation(dados);
                    console.log("updateRecommendation chamado com sucesso!");

                    var lat = dados.coord.lat;
                    var lon = dados.coord.lon;

                    this._localPesquisado = dados.name;
                    this._tipoLocal = (infoLocal && infoLocal.tipo) || "Cidade";
                    this._capital = "";
                    // Mock local (sem API externa de turismo)
                    this.buscarInformacoesTuristicas(sCidade || dados.name);

                    console.log("Latitude:", lat, "Longitude:", lon);

                    var sUrlForecast = "https://api.openweathermap.org/data/2.5/forecast?" +
                        "lat=" + lat + "&lon=" + lon + "&appid=" + sChaveAPI + "&units=metric";

                    return fetch(sUrlForecast);
                })
                .then(res => res.json())
                .then(data => {
                    const forecasts = data.list;
                    const dailyForecasts = [];

                    const timezoneOffset = data && data.city ? data.city.timezone : 0;
                    this.updateHourlyChart(forecasts, timezoneOffset);

                    const hoje = new Date();
                    const diasSemana = ['Dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
                    
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
                        const weatherMain = dayData.forecast.weather[0].main;
                        const iconAndColor = this.getWeatherIconAndColor(weatherMain);
                        
                        dailyForecasts.push({
                            date: dayData.date,
                            dia: diaSemana,
                            temperature: Math.round(dayData.forecast.main.temp),
                            tempMax: tempMax,
                            weather: descricaoPT,
                            description: descricaoPT,
                            icon: iconAndColor.icon,
                            weatherColor: iconAndColor.color,
                            tempColor: this.getTemperatureColor(tempMax)
                        });
                    });
                    
                    // Calcular média para os dias 6 e 7 baseado nos dois últimos dias disponíveis
                    if (availableForecasts.length >= 2) {
                        // Pegar os dois últimos dias (últimos 2 do array)
                        const ultimosDoisDias = availableForecasts.slice(-2);
                        const penultimoDia = ultimosDoisDias[0];
                        const ultimoDia = ultimosDoisDias[1];
                        
                        // Calcular média de temperatura e tempMax para sábado (dia 6)
                        const tempMedia6 = Math.round((penultimoDia.forecast.main.temp + ultimoDia.forecast.main.temp) / 2);
                        const tempMaxMedia6 = Math.round((penultimoDia.forecast.main.temp_max + ultimoDia.forecast.main.temp_max) / 2);
                        
                        // Calcular média de temperatura e tempMax para domingo (dia 7)
                        const tempMedia7 = Math.round((penultimoDia.forecast.main.temp + ultimoDia.forecast.main.temp) / 2);
                        const tempMaxMedia7 = Math.round((penultimoDia.forecast.main.temp_max + ultimoDia.forecast.main.temp_max) / 2);
                        
                        // Determinar clima baseado na média dos dois últimos dias
                        // Para sábado, usar o clima do penúltimo dia
                        const weatherMain6 = penultimoDia.forecast.weather[0].main;
                        const weatherDesc6 = penultimoDia.forecast.weather[0].description.toLowerCase();
                        const descricaoPT6 = weatherDescriptions[weatherDesc6] || weatherDesc6;
                        const iconAndColor6 = this.getWeatherIconAndColor(weatherMain6);
                        
                        // Para domingo, usar o clima do último dia
                        const weatherMain7 = ultimoDia.forecast.weather[0].main;
                        const weatherDesc7 = ultimoDia.forecast.weather[0].description.toLowerCase();
                        const descricaoPT7 = weatherDescriptions[weatherDesc7] || weatherDesc7;
                        const iconAndColor7 = this.getWeatherIconAndColor(weatherMain7);
                        
                        // Calcular datas para sábado e domingo
                        const dataSabado = new Date(ultimoDia.date);
                        dataSabado.setDate(dataSabado.getDate() + 1);
                        const dataDomingo = new Date(ultimoDia.date);
                        dataDomingo.setDate(dataDomingo.getDate() + 2);
                        
                        dailyForecasts.push({
                            date: dataSabado.toISOString().split("T")[0],
                            dia: 'sáb.',
                            temperature: tempMedia6,
                            tempMax: tempMaxMedia6,
                            weather: descricaoPT6,
                            description: descricaoPT6,
                            icon: iconAndColor6.icon,
                            weatherColor: iconAndColor6.color,
                            tempColor: this.getTemperatureColor(tempMaxMedia6)
                        });
                        
                        dailyForecasts.push({
                            date: dataDomingo.toISOString().split("T")[0],
                            dia: 'dom.',
                            temperature: tempMedia7,
                            tempMax: tempMaxMedia7,
                            weather: descricaoPT7,
                            description: descricaoPT7,
                            icon: iconAndColor7.icon,
                            weatherColor: iconAndColor7.color,
                            tempColor: this.getTemperatureColor(tempMaxMedia7)
                        });
                    }
                    
                    const organizedForecasts = this.organizeForecastsByWeek(dailyForecasts);

                    var oForecastModel = new sap.ui.model.json.JSONModel(organizedForecasts);
                    console.log("Previsão semanal organizada:", organizedForecasts); 
                    console.log("ForecastModel criado com dados:", oForecastModel.getData());
                    this.getView().setModel(oForecastModel, "forecastModel");
                    
                    // Verificar se o modelo foi definido corretamente
                    var testModel = this.getView().getModel("forecastModel");
                    console.log("Modelo forecastModel na view:", testModel ? testModel.getData() : "Modelo não encontrado");
                })
                .catch(err => {
                    MessageToast.show("Erro ao buscar clima: " + err.message);
                });
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

        _getHumidityStatus: function(humidity) {
            if (humidity === undefined || humidity === null) {
                return "--";
            }

            if (humidity >= 75) {
                return "Ambiente úmido";
            }

            if (humidity >= 45) {
                return "Umidade equilibrada";
            }

            return "Ar seco";
        },

        _getHeatStatus: function(temperature) {
            if (temperature === undefined || temperature === null) {
                return "--";
            }

            if (temperature >= 34) {
                return "Clima muito quente";
            }

            if (temperature >= 28) {
                return "Dia quente";
            }

            if (temperature >= 21) {
                return "Temperatura amena";
            }

            if (temperature >= 15) {
                return "Clima fresco";
            }

            return "Frio intenso";
        },

        _getWindStatus: function(temperature, windSpeed) {
            if ((windSpeed === undefined || windSpeed === null) && (temperature === undefined || temperature === null)) {
                return "--";
            }

            var temp = temperature || 0;
            var wind = windSpeed || 0;

            if (temp >= 28 && wind >= 10) {
                return "Quente com vento fresco";
            }

            if (wind >= 18) {
                return "Vento frio e forte";
            }

            if (wind >= 10) {
                return "Brisa moderada";
            }

            if (temp >= 30 && wind < 6) {
                return "Calor seco e parado";
            }

            return "Ar calmo";
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
        },

        

        formatTemperature: function(temperature) {
            if (!temperature && temperature !== 0) return '';
            return Math.round(temperature) + '°C';
        },

        organizeForecastsByWeek: function(forecasts) {
            console.log("Organizando forecasts:", forecasts);
            const dayOrder = ['seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.', 'dom.'];
            const normalizedForecasts = Array.isArray(forecasts) ? forecasts : [];

            const dayMap = normalizedForecasts.reduce((acc, item) => {
                const normalizedKey = this._normalizeDayKey(item && item.dia);
                if (normalizedKey && !acc[normalizedKey]) {
                    acc[normalizedKey] = item;
                }
                return acc;
            }, {});

            const organized = dayOrder.map(dayKey => {
                const normalizedKey = this._normalizeDayKey(dayKey);
                const forecastForDay = dayMap[normalizedKey];

                if (forecastForDay) {
                    return forecastForDay;
                }

                return {
                    dia: dayKey,
                    temperature: null,
                    tempMax: null,
                    weather: '',
                    description: '',
                    icon: '',
                    weatherColor: '',
                    tempColor: ''
                };
            });

            console.log("Forecasts organizados:", organized);
            return organized;
        },

        _normalizeDayKey: function(dayLabel) {
            return (dayLabel || '').toString().trim().toLowerCase();
        },

        navigateToCity: function(cityName) {
            // Mesmo fluxo do botão Buscar: preenche o input e dispara clima + mapa + mock
            var oCityInput = this.byId("cityInput");
            if (oCityInput) {
                oCityInput.setValue(cityName);
            }
            this.onButtonPress();
        },
        
        fetchWeatherForCity: function(cityName) {
            console.log("Buscando clima para:", cityName);
            var sChaveAPI = "d6da45bb98ec8fca6ff1ea2cfa6b8674";
            var sUrlWeather = "https://api.openweathermap.org/data/2.5/weather?q=" +
                encodeURIComponent(cityName) + "&appid=" + sChaveAPI + "&units=metric";

            fetch(sUrlWeather)
                .then(res => res.json())
                .then(dados => {
                    console.log("Resposta da API recebida para", cityName);
                    
                    if (!dados.coord) {
                        throw new Error("Coordenadas não encontradas para esta cidade.");
                    }

                    // Adicionar texto dinâmico e ícone
                    var weatherDescription = (dados.weather[0].description || '').toLowerCase();
                    var weatherDescriptionPT = this.getWeatherDescriptionInPortuguese(weatherDescription);
                    dados.weatherDescriptionPT = weatherDescriptionPT;
                    dados.weather[0].description = weatherDescriptionPT;
                    var dynamicText = this.getDynamicWeatherText(weatherDescription);
                    dados.dynamicText = dynamicText;
                    
                    var weatherMain = dados.weather[0].main;
                    var iconAndColor = this.getWeatherIconAndColor(weatherMain);
                    dados.weatherIcon = iconAndColor.icon;
                    dados.weatherColor = iconAndColor.color;
                    console.log("[fetchWeatherForCity] Weather Main:", weatherMain, "| Icon:", iconAndColor.icon, "| Color:", iconAndColor.color);
                    
                    // Arredondar temperatura para número inteiro
                    dados.main.temp = Math.round(dados.main.temp);
                    
                    // Adicionar dados dinâmicos dos detalhes do clima
                    dados.wind.speed = Math.round(dados.wind.speed * 10) / 10;
                    dados.visibility = Math.round(dados.visibility / 1000 * 10) / 10;
                    dados.main.humidity = Math.round(dados.main.humidity);
                    dados.main.pressure = Math.round(dados.main.pressure);
                    
                    // Calcular ponto de orvalho aproximado
                    var temp = dados.main.temp;
                    var humidity = dados.main.humidity;
                    var dewPoint = temp - ((100 - humidity) / 5);
                    dados.dewPoint = Math.round(dewPoint);
                    dados.main.temp = Math.round(dados.main.temp);
                    
                    // Gerar resumo dinâmico do clima
                    dados.weatherSummary = this.generateWeatherSummary(dados);

                    // Definir status descritivos
                    dados.humidityStatus = this._getHumidityStatus(dados.main && dados.main.humidity);
                    dados.heatStatus = this._getHeatStatus(dados.main && dados.main.temp);
                    dados.windStatus = this._getWindStatus(dados.main && dados.main.temp, dados.wind && dados.wind.speed);

                    // Salvar dados atuais no weatherModel
                    var oWeatherModel = new sap.ui.model.json.JSONModel(dados);
                    this.getView().setModel(oWeatherModel, "weatherModel");

                    // Atualizar recomendação baseada no clima
                    console.log("🔄 Chamando updateRecommendation...");
                    this.updateRecommendation(dados);

                    // Buscar forecast para os próximos dias
                    var lat = dados.coord.lat;
                    var lon = dados.coord.lon;
                    var sChaveAPI = "d6da45bb98ec8fca6ff1ea2cfa6b8674";
                    var sUrlForecast = "https://api.openweathermap.org/data/2.5/forecast?" +
                        "lat=" + lat + "&lon=" + lon + "&appid=" + sChaveAPI + "&units=metric";

                    return fetch(sUrlForecast);
                })
                .then(res => res.json())
                .then(data => {
                    const forecasts = data.list;
                    const dailyForecasts = [];

                    const timezoneOffset = data && data.city ? data.city.timezone : 0;
                    this.updateHourlyChart(forecasts, timezoneOffset);

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
                        const weatherMain = dayData.forecast.weather[0].main;
                        const iconAndColor = this.getWeatherIconAndColor(weatherMain);
                        
                        dailyForecasts.push({
                            date: dayData.date,
                            dia: diaSemana,
                            temperature: Math.round(dayData.forecast.main.temp),
                            tempMax: tempMax,
                            weather: descricaoPT,
                            description: descricaoPT,
                            icon: iconAndColor.icon,
                            weatherColor: iconAndColor.color,
                            tempColor: this.getTemperatureColor(tempMax)
                        });
                    });
                    
                    // Calcular média para os dias 6 e 7 baseado nos dois últimos dias disponíveis
                    if (availableForecasts.length >= 2) {
                        // Pegar os dois últimos dias (últimos 2 do array)
                        const ultimosDoisDias = availableForecasts.slice(-2);
                        const penultimoDia = ultimosDoisDias[0];
                        const ultimoDia = ultimosDoisDias[1];
                        
                        // Calcular média de temperatura e tempMax para sábado (dia 6)
                        const tempMedia6 = Math.round((penultimoDia.forecast.main.temp + ultimoDia.forecast.main.temp) / 2);
                        const tempMaxMedia6 = Math.round((penultimoDia.forecast.main.temp_max + ultimoDia.forecast.main.temp_max) / 2);
                        
                        // Calcular média de temperatura e tempMax para domingo (dia 7)
                        const tempMedia7 = Math.round((penultimoDia.forecast.main.temp + ultimoDia.forecast.main.temp) / 2);
                        const tempMaxMedia7 = Math.round((penultimoDia.forecast.main.temp_max + ultimoDia.forecast.main.temp_max) / 2);
                        
                        // Determinar clima baseado na média dos dois últimos dias
                        // Para sábado, usar o clima do penúltimo dia
                        const weatherMain6 = penultimoDia.forecast.weather[0].main;
                        const weatherDesc6 = penultimoDia.forecast.weather[0].description.toLowerCase();
                        const descricaoPT6 = weatherDescriptions[weatherDesc6] || weatherDesc6;
                        const iconAndColor6 = this.getWeatherIconAndColor(weatherMain6);
                        
                        // Para domingo, usar o clima do último dia
                        const weatherMain7 = ultimoDia.forecast.weather[0].main;
                        const weatherDesc7 = ultimoDia.forecast.weather[0].description.toLowerCase();
                        const descricaoPT7 = weatherDescriptions[weatherDesc7] || weatherDesc7;
                        const iconAndColor7 = this.getWeatherIconAndColor(weatherMain7);
                        
                        // Calcular datas para sábado e domingo
                        const dataSabado = new Date(ultimoDia.date);
                        dataSabado.setDate(dataSabado.getDate() + 1);
                        const dataDomingo = new Date(ultimoDia.date);
                        dataDomingo.setDate(dataDomingo.getDate() + 2);
                        
                        dailyForecasts.push({
                            date: dataSabado.toISOString().split("T")[0],
                            dia: 'sáb.',
                            temperature: tempMedia6,
                            tempMax: tempMaxMedia6,
                            weather: descricaoPT6,
                            description: descricaoPT6,
                            icon: iconAndColor6.icon,
                            weatherColor: iconAndColor6.color,
                            tempColor: this.getTemperatureColor(tempMaxMedia6)
                        });
                        
                        dailyForecasts.push({
                            date: dataDomingo.toISOString().split("T")[0],
                            dia: 'dom.',
                            temperature: tempMedia7,
                            tempMax: tempMaxMedia7,
                            weather: descricaoPT7,
                            description: descricaoPT7,
                            icon: iconAndColor7.icon,
                            weatherColor: iconAndColor7.color,
                            tempColor: this.getTemperatureColor(tempMaxMedia7)
                        });
                    }
                    
                    const organizedForecasts = this.organizeForecastsByWeek(dailyForecasts);

                    var oForecastModel = new sap.ui.model.json.JSONModel(organizedForecasts);
                    console.log("Previsão semanal organizada (fetchWeatherForCity):", organizedForecasts); 
                    console.log("ForecastModel criado com dados (fetchWeatherForCity):", oForecastModel.getData());
                    this.getView().setModel(oForecastModel, "forecastModel");
                    
                    // Verificar se o modelo foi definido corretamente
                    var testModel = this.getView().getModel("forecastModel");
                    console.log("Modelo forecastModel na view (fetchWeatherForCity):", testModel ? testModel.getData() : "Modelo não encontrado");
                })
                .catch(err => {
                    console.error("❌ Erro ao buscar clima:", err);
                });
        },

        // São Paulo
        onNavigateToSaoPaulo: function() {
            this.navigateToCity("São Paulo");
        },

        // Rio Grande Do Sul
        onNavigateToRioGrandeDoSul: function() {
            this.navigateToCity("Rio Grande Do Sul");
        },

        // Rio de Janeiro
        onNavigateToRio: function() {
            this.navigateToCity("Rio de Janeiro");
        },

        // Brasília
        onNavigateToBrasilia: function() {
            this.navigateToCity("Brasília");
        },

        // Salvador
        onNavigateToSalvador: function() {
            this.navigateToCity("Salvador");
        },

        // Método para atualizar recomendações baseadas no clima
        updateRecommendation: function(weatherData) {
            console.log("updateRecommendation CHAMADO");

            var suggestions = [];
            var weatherMain = (weatherData.weather[0].main || "").toLowerCase();
            var weatherDesc = (weatherData.weather[0].description || "").toLowerCase();

            // Manter a imagem local fixa
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/weatherImage", "../assets/logo-marca.jpeg");

            var bChuva =
                weatherMain === "rain" ||
                weatherMain === "drizzle" ||
                weatherMain === "thunderstorm" ||
                weatherDesc.indexOf("chuva") !== -1 ||
                weatherDesc.indexOf("garoa") !== -1 ||
                weatherDesc.indexOf("tempestade") !== -1;

            var bSol =
                weatherMain === "clear" ||
                weatherDesc.indexOf("céu limpo") !== -1 ||
                weatherDesc.indexOf("ensolarado") !== -1;

            // Ícones do SAP Icon Explorer (todos válidos no font SAP-icons):
            // https://ui5.sap.com/test-resources/sap/m/demokit/iconExplorer/webapp/index.html
            if (bChuva) {
                suggestions = [
                    { icon: "sap-icon://cloud", text: "Dia de chuva: o melhor plano é ficar em casa e aproveitar o aconchego." },
                    { icon: "sap-icon://meal", text: "Que tal uma xícara de café quente enquanto a chuva cai lá fora?" },
                    { icon: "sap-icon://weather-proofing", text: "Se precisar sair, leve o guarda-chuva e evite se molhar." },
                    { icon: "sap-icon://education", text: "Ótimo momento para ler um bom livro bem confortável no sofá." },
                    { icon: "sap-icon://home", text: "Aproveite a chuva para um filme aconchegante sem pressa." }
                ];
            } else if (bSol) {
                suggestions = [
                    { icon: "sap-icon://light-mode", text: "Dia ensolarado: saia para caminhar e aproveitar o tempo bom." },
                    { icon: "sap-icon://map", text: "Que tal um passeio tranquilo no parque ou na praça da cidade?" },
                    { icon: "sap-icon://soccer", text: "Bom momento para corrida, ciclismo ou um esporte ao ar livre." },
                    { icon: "sap-icon://group", text: "Chame os amigos e marque um encontro fora de casa." },
                    { icon: "sap-icon://alert", text: "Lembre-se de beber água e usar protetor solar ao longo do dia." }
                ];
            } else {
                // Nublado / outros — cada frase com ícone
                suggestions = [
                    { icon: "sap-icon://cloud", text: "Nublado, mas ainda dá para aproveitar um passeio sem sol forte." },
                    { icon: "sap-icon://meal", text: "Que tal um café quente em um lugar aconchegante neste clima?" },
                    { icon: "sap-icon://map", text: "Uma caminhada leve ao ar livre combina bem com o tempo de hoje." },
                    { icon: "sap-icon://home", text: "Se preferir ficar, é um ótimo momento para um filme ou série em casa." },
                    { icon: "sap-icon://hint", text: "Clima ideal para atividades tranquilas — acompanhe a previsão do dia." }
                ];
            }

            // Garante ícone em todas as frases
            suggestions = suggestions.map(function (oItem) {
                return {
                    icon: oItem.icon || "sap-icon://hint",
                    text: oItem.text
                };
            });

            console.log("Sugestões geradas para", weatherMain, ":", suggestions);

            this.getView().setModel(
                new sap.ui.model.json.JSONModel({ suggestions: suggestions }),
                "suggestionsModel"
            );
        },

        getWeatherDescriptionInPortuguese: function(description) {
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
                'rain': 'chuva',
                'clouds': 'nublado'
            };

            return weatherDescriptions[(description || '').toLowerCase()] || (description || '');
        },

        // Função para gerar texto dinâmico baseado na descrição do clima
        getDynamicWeatherText: function(weatherDescription) {
            // Condições que indicam chuva
            const rainConditions = [
                'light rain', 'moderate rain', 'heavy rain', 'thunderstorm', 
                'drizzle', 'heavy intensity rain', 'shower rain', 'rain'
            ];
            
            // Se for condição de chuva, retorna "Mais Chuvoso"
            if (rainConditions.includes(weatherDescription)) {
                return 'Mais Chuvoso';
            }
            
            // Para todas as outras condições (sol, nuvens, etc.), retorna "Mais Ensolarado"
            return 'Mais Ensolarado';
        },

        // Função para determinar o ícone e cor baseado no tipo de clima
        getWeatherIconAndColor: function(weatherMain) {
            const rainConditions = ['Rain', 'Thunderstorm', 'Drizzle'];
            const cloudConditions = ['Clouds'];
            
            console.log("Determinando ícone para:", weatherMain);
            
            // Chuva e Trovão - usar ícone de chuva com azul
            if (rainConditions.includes(weatherMain)) {
                console.log("Chuva/Trovão - retornando weather-proofing com azul");
                return {
                    icon: 'sap-icon://weather-proofing',
                    color: '#4682B4'
                };
            }
            
            // Nuvem - usar ícone de nuvem com azul
            if (cloudConditions.includes(weatherMain)) {
                console.log("Nuvem - retornando cloud com azul");
                return {
                    icon: 'sap-icon://cloud',
                    color: '#4682B4'
                };
            }
            
            // Sol/Claro - usar ícone de sol com laranja
            console.log("Sol/Claro - retornando light-mode com laranja");
            return {
                icon: 'sap-icon://light-mode',
                color: '#FFA500'
            };
        },

        // Função para gerar resumo dinâmico do clima (máximo 4 frases)
        generateWeatherSummary: function(weatherData) {
            if (!weatherData || !weatherData.weather) {
                return "Dados climáticos indisponíveis.";
            }
            
            var summary = [];
            var weatherMain = weatherData.weather[0].main;
            var weatherDesc = weatherData.weather[0].description;
            var temp = weatherData.main.temp;
            var tempMax = weatherData.main.temp_max;
            var humidity = weatherData.main.humidity;
            var wind = weatherData.wind.speed;
            var feelsLike = weatherData.main.feels_like;
            
            // Frase 1: Condição principal do céu
            if (weatherMain === 'Clear') {
                summary.push("O céu estará predominantemente ensolarado.");
            } else if (weatherMain === 'Clouds') {
                summary.push("O céu estará predominantemente nublado.");
            } else if (weatherMain === 'Rain') {
                summary.push("Espera-se chuva durante o dia.");
            } else if (weatherMain === 'Thunderstorm') {
                summary.push("Há possibilidade de tempestade com raios.");
            } else if (weatherMain === 'Drizzle') {
                summary.push("Pode haver garoa leve durante o dia.");
            } else {
                summary.push("Condição climática: " + weatherDesc + ".");
            }
            
            // Frase 2: Temperatura máxima
            summary.push("A máxima será de " + Math.round(tempMax) + "°C");
            
            // Frase 3: Umidade e vento (se relevantes)
            if (humidity > 80) {
                summary.push("com elevada umidade de " + humidity + "%.");
            } else if (wind > 15) {
                summary.push("com ventos de " + Math.round(wind * 10) / 10 + " km/h.");
            } else if (feelsLike < temp - 2) {
                summary.push("mas com sensação térmica de " + Math.round(feelsLike) + "°C.");
            } else {
                summary.push("");
            }
            
            // Limpar frases vazias
            summary = summary.filter(s => s.length > 0);
            
            // Limitar a 4 frases máximo
            if (summary.length > 4) {
                summary = summary.slice(0, 4);
            }
            
            // Garantir que a última frase tem ponto final
            if (summary.length > 0 && !summary[summary.length - 1].endsWith('.')) {
                summary[summary.length - 1] += '.';
            }
            
            return summary.join(' ');
        },

        // Função para determinar se é sol (true) ou nuvem (false) - mantida para compatibilidade

        onNavigateToPage1: function () {
            PageNavigation.navigateToPage1(this);
        },

        onNavigateToPage2: function () {
            PageNavigation.navigateToPage2(this);
        },

        onVerMais: function () {
            console.log("ENTROU NO onVerMais");

            // Recria a modal para refletir o layout atual (país/estado/pontos)
            if (this._oDialog) {
                this._oDialog.destroy();
                this._oDialog = null;
            }

            this._oDialog = new sap.m.Dialog({
                title: "Guia do destino",
                contentWidth: "520px",
                contentHeight: "460px",
                verticalScrolling: true,

                content: [
                    new sap.m.VBox({
                        items: [
                            new sap.m.Title({
                                text: "{placesModel>/localPesquisado}",
                                titleStyle: "H4",
                                wrapping: true
                            }).addStyleClass("sapUiTinyMarginBottom"),

                            new sap.m.Text({
                                text: "{placesModel>/resumo}",
                                wrapping: true
                            }).addStyleClass("sapUiSmallMarginBottom"),

                            new sap.m.ObjectStatus({
                                title: "{placesModel>/localizacao/titulo}",
                                text: "{placesModel>/localizacao/texto}",
                                icon: "{placesModel>/localizacao/icone}",
                                state: "Information"
                            }).addStyleClass("sapUiSmallMarginBottom"),

                            new sap.m.Title({
                                text: "O que fazer por aqui",
                                titleStyle: "H5"
                            }).addStyleClass("sapUiTinyMarginBottom"),

                            new sap.m.List({
                                noDataText: "Nenhum tópico disponível",
                                items: {
                                    path: "placesModel>/topicos",
                                    template: new sap.m.StandardListItem({
                                        title: "{placesModel>titulo}",
                                        description: "{placesModel>texto}",
                                        icon: "{placesModel>icone}",
                                        info: "{placesModel>nome}",
                                        wrapping: true,
                                        type: "Inactive"
                                    })
                                }
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],

                beginButton: new sap.m.Button({
                    text: "Fechar",
                    press: function () {
                        this._oDialog.close();
                    }.bind(this)
                })
            });

            this.getView().addDependent(this._oDialog);
            this._oDialog.open();
        },

        /**
         * Busca país / estado / capital / pontos turísticos no mock local.
         */
        buscarInformacoesTuristicas: async function (sCidadeBusca) {
            try {
                var oResultado = await MockLocaisService.buscarPorCidade(sCidadeBusca);

                if (!oResultado) {
                    oResultado = MockLocaisService.resultadoVazio(
                        this._localPesquisado || sCidadeBusca,
                        this._tipoLocal
                    );
                    MessageToast.show(
                        "Cidade ainda não cadastrada no mock de locais turísticos."
                    );
                }

                this._capital = oResultado.capital || "";
                this._tipoLocal = oResultado.tipoLocal || this._tipoLocal;

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel(oResultado),
                    "placesModel"
                );

                console.log("RESULTADO TURISMO (mock):", oResultado);
            } catch (error) {
                console.error("Erro ao buscar mock de locais:", error);

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel(
                        MockLocaisService.resultadoVazio(
                            this._localPesquisado,
                            this._tipoLocal
                        )
                    ),
                    "placesModel"
                );

                MessageToast.show(
                    "Não foi possível carregar as informações turísticas."
                );
            }
        },

        calcularDistancia: function (
                    lat1,
                    lon1,
                    lat2,
                    lon2
                ) {

                    var R = 6371; // raio da Terra em km

                    var dLat =
                        (lat2 - lat1) * Math.PI / 180;

                    var dLon =
                        (lon2 - lon1) * Math.PI / 180;

                    var a =
                        Math.sin(dLat / 2) *
                        Math.sin(dLat / 2) +

                        Math.cos(lat1 * Math.PI / 180) *
                        Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLon / 2) *
                        Math.sin(dLon / 2);

                    var c =
                        2 * Math.atan2(
                            Math.sqrt(a),
                            Math.sqrt(1 - a)
                        );

                    var distancia = R * c;

                    return Math.round(distancia * 10) / 10;
                },

                identificarLocal: async function (local) {

            var url =
                "https://nominatim.openstreetmap.org/search" +
                "?q=" + encodeURIComponent(local) +
                "&format=jsonv2" +
                "&addressdetails=1" +
                "&limit=1";

            try {

                var response = await fetch(url);

                if (!response.ok) {
                    throw new Error("Erro ao consultar Nominatim");
                }

                var resultados = await response.json();

                if (!resultados.length) {
                    return null;
                }

                var resultado = resultados[0];

                console.log("NOMINATIM:", resultado);

                var tipo = "Cidade";
                var sAddressType = resultado.addresstype || "";
                var sType = resultado.type || "";
                var sClass = resultado.class || "";

                // País / estado só quando o próprio resultado for isso
                // (cidade também vem com address.state — isso NÃO a torna estado)
                if (sAddressType === "country" || sType === "country") {
                    tipo = "País";
                } else if (sAddressType === "state" || sType === "state") {
                    tipo = "Estado";
                } else if (
                    sAddressType === "city" ||
                    sAddressType === "municipality" ||
                    sAddressType === "town" ||
                    sAddressType === "village" ||
                    sAddressType === "suburb" ||
                    sClass === "place" ||
                    sType === "administrative"
                ) {
                    tipo = "Cidade";
                }

                return {
                    nome: resultado.name,
                    tipo: tipo,
                    latitude: parseFloat(resultado.lat),
                    longitude: parseFloat(resultado.lon),
                    address: resultado.address
                };

            } catch (error) {

                console.error("Erro Nominatim:", error);

                return null;
            }
        },



        
    });
});