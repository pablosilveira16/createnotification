sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"com/blueboot/createnotification/model/models",
	"com/blueboot/createnotification/utils/Utils",
	"com/blueboot/createnotification/utils/Offline"
], function(UIComponent, Device, models, utils, offline) {
	"use strict";

	return UIComponent.extend("com.blueboot.createnotification.Component", {
//
		metadata: {
			manifest: "json"
		},

		init: function() {
			utils.polyfill();
			var that = this;

			var param = {
				"json": true,
				loadMetadataAsync: true
			};
			var sServiceUrl = "";

			var appMeta = models.createSapAppModel(this);
			var sModulePath = appMeta.id;
			offline.i18n = models.createI18NModel(sModulePath).getResourceBundle();
			models.createDeviceModel(this);

			var dfdInit = $.Deferred();
			if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
				document.addEventListener("pause", function() {
					var oEventBus = sap.ui.getCore().getEventBus();
					oEventBus.publish("OfflineStore", "PauseApp");
				}, false);
				document.addEventListener("deviceready", jQuery.proxy(function() {
					$.getJSON("dev/service.json",
						function(data) {
							if (data && data.logon) {
								var context = {
									"serverHost": data.host,
									"https": data.https,
									"serverPort": data.port,
									"refreshSAMLSessionOnResume": "skip",
									"auth": [ { "type": "saml2.web.post" } ],
									"custom": { "disablePasscode" : true }
								};

								$.when(offline.doLogonInit(context, data.appID)).then(
									function() {
										sServiceUrl = new URL(offline.appContext.applicationEndpointURL + "/").href;
										var oHeader = {
											"X-SMP-APPCID": offline.appContext.applicationConnectionId
										};
										if (offline.appContext.registrationContext.user) {
											oHeader.Authorization = "Basic " + btoa(offline.appContext.registrationContext.user + ":" + offline.appContext.registrationContext
												.password);
										}
										param.headers = oHeader;
										dfdInit.resolve();
									},
									function(err) {
										dfdInit.reject(err);
									});
							} else {
								dfdInit.reject("SERVICE_JSON_ERROR");
							}
						},
						function() {
							dfdInit.reject("SERVICE_JSON_ERROR");
						});
				}, this), false);

			} else {
				// conectandome desde un browser
				sServiceUrl = appMeta.dataSources.mainService.internetHost + appMeta.dataSources.mainService.uri;
				dfdInit.resolve();
			}

			sap.ui.core.UIComponent.prototype.init.apply(that, arguments);

			$.when(dfdInit).then(
				function() {
					utils.setLanguage();
					models.createModels(sServiceUrl, sModulePath, param, that);
					that.getRouter().initialize();
				},
				function(err) {
					var i18n = sap.ui.getCore().getModel("i18n").getResourceBundle();
					var msgTitle = i18n.getText("ODataErrorTitle");
					var msg = i18n.getText(err);
					var details = [];
					sap.m.MessageBox.error(msg, {
						title: msgTitle,
						details: details
					});
				});
		}
	});
});