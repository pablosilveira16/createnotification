sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"com/blueboot/createnotification/utils/Utils",
	"com/blueboot/createnotification/model/HybridODataModel",
	"com/blueboot/createnotification/config/config"
], function (JSONModel, Device, utils, HybridODataModel, config) {
	"use strict";

	return {
		createModels: function (sServiceUrl, param, component) {
			this.createODataModel(sServiceUrl, param);
			this.createLocalModel(component);
		},

		createSapAppModel: function (component) {
			var sapApp = component.getMetadata().getManifestEntry("sap.app");
			sap.ui.getCore().setModel(new JSONModel(sapApp), "sapApp");
			return sapApp;
		},

		createDeviceModel: function (component) {
			var oDeviceModel = new JSONModel({
				isTouch: Device.support.touch,
				isNoTouch: !Device.support.touch,
				isPhone: Device.system.phone,
				isNoPhone: !Device.system.phone,
				listMode: (Device.system.phone) ? "None" : "SingleSelectMaster",
				listItemType: (Device.system.phone) ? "Active" : "Inactive",
				isKapsel: (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) ? true : false
			});
			oDeviceModel.setDefaultBindingMode("OneWay");
			sap.ui.getCore().setModel(oDeviceModel, "device");
			component.setModel(oDeviceModel, "device");
			return oDeviceModel;
		},

		createI18NModel: function (sModulePath) {
			var i18nModel = new sap.ui.model.resource.ResourceModel({
				bundleUrl: jQuery.sap.getModulePath(sModulePath, "/i18n/i18n.properties")
			});
			sap.ui.getCore().setModel(i18nModel, "i18n");
			return i18nModel;
		},

		createODataModel: function (sServiceUrl, param) {
			var href;
			try {
				href = new URL(sServiceUrl).href;
			} catch (e) {
				href = sServiceUrl;
			}
			var oDataModel = new HybridODataModel(href, param);
			oDataModel.setDefaultBindingMode("TwoWay");
			oDataModel.attachRequestFailed(utils.parseError);
			oDataModel.attachMetadataLoaded(function () {
				oDataModel.dfdMetadata.resolve();
			});
			sap.ui.getCore().setModel(oDataModel, "oDataModel");
			return oDataModel;
		},

		createLocalModel: function () {
			var localModel = new JSONModel();
			localModel.setDefaultBindingMode("TwoWay");
			localModel.setSizeLimit(500);
			this.setQueryStringParameters(localModel)
			sap.ui.getCore().setModel(localModel);
			return localModel;
		},

		setQueryStringParameters: function (localModel) {
			var params = {};
			var expectedParams = ["OrderId",
				"Functlocation",
				"Equipment",
				"Plant",
				"Planplant",
				"Workcenter"
			];
			expectedParams.forEach(function (param) {
				var value = utils.getParameterByName(param);
				if (value) {
					params[param] = value;
				}
			});
			if (Object.keys(params).length !== 0) {
				localModel.setProperty("/initialParameters", params, localModel, true);
			}
		},
		initLocalModel: function (component) {
			//O bien tengo conexión, o hay un OfflineStore abierto ya.
			var localModel = sap.ui.getCore().getModel();
			var oDataModel = sap.ui.getCore().getModel("oDataModel");
			var dfdInit = $.Deferred();

			/******************* CODIGO CUSTOM PARA CADA CLIENTE Y/O APP *******************/
			var lang;
			switch (sap.ui.getCore().getConfiguration().getLanguage().toUpperCase()) {
			case 'EN':
				lang = 'E';
				break;
			case 'ES':
				lang = 'S';
				break;
			case 'PT':
				lang = 'PT';
				break;
			default:
				lang = 'S';
				break;
			}

			component.setModel(localModel);
			localModel.setProperty('/showHiddenNotification', true, localModel, true);
			var that = this;

			$.when(oDataModel.dfdMetadata).then(function () {
				var dfdNotifType = $.Deferred();
				var dfdPriority = $.Deferred();
				var dfdNotifEffect = $.Deferred();
				var dfdUserStatus = $.Deferred();
				var dfdCatalog = $.Deferred();
				var filterArray = config.NotificationTypeSet.map(utils.createFilterString);
				var filterString = filterArray.join(" and ");
				oDataModel.read("/NotificationTypeSet?$filter=" + filterString, {
					success: function (oData, response) {
						localModel.setProperty("/NotificationTypes", oData.results, localModel, true);
						dfdNotifType.resolve();
					},
					error: function (oError) {
						dfdNotifType.reject();
						oError.customMessage = "SOMETHING_HAS_HAPPENED";
						oDataModel.fireRequestFailed(oError);
					}
				});

				oDataModel.read("/PrioritySet", {
					success: function (oData, response) {
						localModel.setProperty("/Priority", oData.results, localModel, true);
						dfdPriority.resolve();
					},
					error: function (oError) {
						dfdPriority.reject();
						oError.customMessage = "SOMETHING_HAS_HAPPENED";
						oDataModel.fireRequestFailed(oError);
					}
				});

				oDataModel.read("/NotifEffectSet", {
					success: function (oData, response) {
						localModel.setProperty("/NotifEffect", oData.results, localModel, true);
						dfdNotifEffect.resolve();
					},
					error: function (oError) {
						dfdNotifEffect.reject();
						oError.customMessage = "SOMETHING_HAS_HAPPENED";
						oDataModel.fireRequestFailed(oError);
					}
				});

				oDataModel.read("/UserStatusSet", {
					success: function (oData, response) {
						localModel.setProperty("/UserStatus", oData.results, localModel, true);
						dfdUserStatus.resolve();
					},
					error: function (oError) {
						dfdUserStatus.reject();
						oError.customMessage = "SOMETHING_HAS_HAPPENED";
						oDataModel.fireRequestFailed(oError);
					}
				});

				oDataModel.read("/CatalogSet", {
					success: function (oData, response) {
						localModel.setProperty("/CatalogSet", oData.results, localModel, true);
						dfdCatalog.resolve();
					},
					error: function (oError) {
						dfdCatalog.reject();
						oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
						oDataModel.fireRequestFailed(oError);
					}
				});
				var i18n = sap.ui.getCore().getModel("i18n").getResourceBundle();
				var operators = [{
					Key: "NONE",
					Text: i18n.getText("CMP_NONE")
				}, {
					Key: "EQ",
					Text: i18n.getText("CMP_EQ")
				}, {
					Key: "NE",
					Text: i18n.getText("CMP_NE")
				}, {
					Key: "LT",
					Text: i18n.getText("CMP_LT")
				}, {
					Key: "LE",
					Text: i18n.getText("CMP_LE")
				}, {
					Key: "GT",
					Text: i18n.getText("CMP_GT")
				}, {
					Key: "GE",
					Text: i18n.getText("CMP_GE")
				}, {
					Key: "BT",
					Text: i18n.getText("CMP_BT")
				}, {
					Key: "CP",
					Text: i18n.getText("CMP_CP")
				}];
				localModel.setProperty("/Operators", operators, localModel, true);

				$.when(dfdNotifType, dfdPriority, dfdNotifEffect, dfdUserStatus, dfdCatalog).then(dfdInit.resolve, dfdInit.reject);

			});

			/******************* FIN CODIGO CUSTOM PARA CADA CLIENTE Y/O APP *******************/

			return dfdInit;
		}
	};

});