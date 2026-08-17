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

        onBuscarClima: function () {
            var sCidade = this.byId("cityInput").getValue();
            console.log("onBuscarClima chamado para cidade:", sCidade);
            
            if (!sCidade) {
                MessageToast.show("Digite uma cidade.");
                return;
            }

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
            
            if (isRainy) {
                console.log("-> Retornando imagem de CHUVA");
                return 'https://images.pexels.com/photos/1463530/pexels-photo-1463530.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1&t=' + timestamp;
            }
            
            // Imagem de sol para todos os outros casos (Clear, Clouds, etc)
            console.log("-> Retornando imagem de SOL");
            return 'https://images.pexels.com/photos/259620/pexels-photo-259620.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1&t=' + timestamp;
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
            console.log("updateRecommendation CHAMADO");
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

            // Manter a imagem local fixa, sem substituição por URL dinâmica do clima
            console.log("ATUALIZANDO IMAGEM");
            console.log("Condição climática da API:", weatherMain, "-", weatherDesc);
            var weatherImageUrl = "../assets/logo-marca.jpeg";
            console.log("URL da imagem selecionada:", weatherImageUrl);
            
            var oViewModel = this.getView().getModel("viewModel");
            console.log("Modelo antes:", oViewModel.getProperty("/weatherImage"));
            oViewModel.setProperty("/weatherImage", weatherImageUrl);
            console.log("Modelo depois:", oViewModel.getProperty("/weatherImage"));
            console.log("FIM ATUALIZAÇÃO IMAGEM");

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
        isSunnyWeather: function(weatherMain) {
            const rainConditions = ['Rain', 'Thunderstorm', 'Drizzle'];
            const cloudConditions = ['Clouds'];
            
            console.log("Verificando clima:", weatherMain);
            
            // Retorna false para chuva e nuvem (não é sol)
            if (rainConditions.includes(weatherMain) || cloudConditions.includes(weatherMain)) {
                console.log("Não é sol");
                return false;
            }
            
            // Para todas as outras condições, retorna true (é sol)
            console.log("É sol");
            return true;
        }

    });
});