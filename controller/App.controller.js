sap.ui.define([
	"com/blueboot/createnotification/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/blueboot/createnotification/utils/Offline",
	"com/blueboot/createnotification/model/models",
	"sap/m/MessageBox",
	"sap/ui/core/Fragment",
	"com/blueboot/createnotification/utils/formatter",
	"com/blueboot/createnotification/utils/Utils"
], function(BaseController, JSONModel, offline, models, MessageBox, Fragment, formatter, utils) {
	"use strict";


	return BaseController.extend("com.blueboot.createnotification.controller.App", {
		formatter: formatter,
		/**
			El appContext define que paths del localModel son persistidos a localStorage, y levantados cuando inicia la app.
		**/
		_appContext: {
			"pendingItems": {
				"path": "/pendingItems",
				"defaultValue": []
			},
			"pendingParentsCount": {
				"path": "/pendingParentsCount",
				"defaultValue": 0
			},
			"pendingItemsCount": {
				"path": "/pendingItemsCount",
				"defaultValue": 0
			},
			"actualPlant": {
				"path": "/ActualPlant",
				"defaultValue": ""
			},
			"rootElement": {
				"path": "/RootElement",
				"defaultValue": ""
			}
		},

		onInit: function() {
			var oEventBus = sap.ui.getCore().getEventBus();
			/* El destroy lo hago para que no se subscriba dos veces al mismo evento. Este bug pasa cuando estas en un launchpad. */
			oEventBus.destroy();
			oEventBus.subscribe("OfflineStore", "Refreshing", jQuery.proxy(this.onRefreshing, this), this);
			oEventBus.subscribe("OfflineStore", "Synced", jQuery.proxy(this.synFinished, this), this);
			oEventBus.subscribe("OfflineStore", "OfflineStart", jQuery.proxy(this.appStart, this), this);
			oEventBus.subscribe("OfflineStore", "DefiningRequests", jQuery.proxy(this.setDefiningRequest, this), this);
			oEventBus.subscribe("OfflineStore", "ContextChange", jQuery.proxy(this.contextChange, this), this);
			oEventBus.subscribe("OfflineStore", "PauseApp", jQuery.proxy(this.pauseApp, this), this);
			oEventBus.subscribe("App", "SetBusy", jQuery.proxy(this.setBusy, this), this);
			oEventBus.subscribe("App", "UnsetBusy", jQuery.proxy(this.unsetBusy, this), this);
		},

		setBusy: function() {
			var localModel = sap.ui.getCore().getModel();
			localModel.setProperty("/appIsBusy", true, localModel, true);
		},

		unsetBusy: function() {
			var localModel = sap.ui.getCore().getModel();
			localModel.setProperty("/appIsBusy", false, localModel, true);
		},

		contextChange: function() {
			var that = this;
			$.when(offline.deleteAppOfflineStore()).then(
				function() {
					that.appStart();
				}
			);
		},

		pauseApp: function() {
			offline.saveLocalStorage();
		},

		setDefiningRequest: function(sChannel, oEvent, oData) {
			this.offlineStoreInit(oData.definingRequests);
		},

		appStart: function() {
			$.when(offline.loadLocalStorage(this._appContext)).then($.proxy(
				function(){
					var oEventBus = sap.ui.getCore().getEventBus();
					var definingRequest = this.isOfflineStoreDefined();
					if (definingRequest) {
						this.offlineStoreInit(definingRequest);
					} else {
						oEventBus.publish("OfflineStore", "OfflineNoStore");
					}
				}
			, this));
		},

		offlineStoreInit: function(definingRequest) {
			var oEventBus = sap.ui.getCore().getEventBus();
			var that = this;
			offline.createAppOfflineStore(definingRequest);
			window.localStorage.OfflineStore = JSON.stringify(definingRequest);
			if (!this.isOfflineStoreOpened()) {
				$.when(offline.openAppOfflineStore()).then(
					function() {
						models.initLocalModel(that.getOwnerComponent());
						oEventBus.publish("OfflineStore", "OfflineOpened");
					},
					function(msg, err) {
						var errorDetailsArray = [ err ];
						var details = "<p><strong>" + that.getResourceBundle().getText("details") + "</strong></p>\n<ul><li>" +
						errorDetailsArray.join("</li><li>") + "</li></ul>";
						sap.m.MessageBox.error(that.getResourceBundle().getText(msg), {
							title: that.getResourceBundle().getText("ODataErrorTitle"),
							details: details
						});
						console.log("Offline store open failed");
					});
			} 

			if (!(document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1)) {
				models.initLocalModel(that.getOwnerComponent());
				oEventBus.publish("OfflineStore", "OfflineOpened");
			}
		},

		onRefreshing: function() {
			if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
				if (offline.flushAppOfflineStore() === -1){
					//No hay conexion. Ya se desplego un messagebox en Offline.js
					this.getView().setBusy(false);
				}
			} else {
				sap.ui.getCore().getModel("oDataModel").refresh();
				this.getView().setBusy(false);
			}
		},

		synFinished: function() {
			var namespace = this.getOwnerComponent().getMetadata().getLibraryName()
			this.getView().setBusy(false);
			sap.ui.getCore().getEventBus().publish("OfflineStore", "OfflineOpened");
			if (offline.appOfflineStore.callbackError) {
				MessageBox.alert(JSON.stringify(offline.appOfflineStore.callbackError));
			} else {
				if (!this._synchOutput) {
					this._synchOutput = sap.ui.xmlfragment("SynchOutput",  namespace + ".view.SynchOutput", this);
					this.getView().addDependent(this._synchOutput);
				}
				this._synchOutput.open();
			}
			offline.appOfflineStore.callbackError = null;
		},

		onNavtoSynchDetail: function(oEvent) {
			var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
			var oCtx = oItem.getBindingContext();
			var oCtxPath = oCtx.getPath();
			var localModel = sap.ui.getCore().getModel();
			var elem = localModel.getProperty(oCtxPath);
			if (!elem.oDataAsArray){
				elem.oDataAsArray = [];
				if (typeof(elem.oData) === "object") {
					var keys = Object.keys(elem.oData);
					for (var i in keys) {
						elem.oDataAsArray.push({"Key": keys[i], "Value": elem.oData[keys[i]]});
					}
				}
			}
			localModel.setProperty(oCtxPath,elem,localModel,true);
			var oNavCon = Fragment.byId("SynchOutput", "synchNav");
			var oDetailPage = Fragment.byId("SynchOutput", "synchDetail");
			oNavCon.to(oDetailPage);
			oDetailPage.bindElement(oCtxPath);
		},

		onNavtoSynchError: function(oEvent) {
			var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
			var oCtx = oItem.getBindingContext();
			var oCtxPath = oCtx.getPath();
			var localModel = sap.ui.getCore().getModel();
			var elem = localModel.getProperty(oCtxPath);
			utils.parseError(elem.error);
		},

		onSynchNavBack: function() {
			var oNavCon = Fragment.byId("SynchOutput", "synchNav");
			oNavCon.back();
		},

		onSynchDlgClose: function() {
			var localModel = sap.ui.getCore().getModel();
			var synchOutput = localModel.getProperty("/synchOutput");
			if (synchOutput && synchOutput.error && synchOutput.error.length) {
				var errorItems = synchOutput.error;
				sap.m.MessageBox.show(this.getResourceBundle().getText("RETRY_ITEMS"), {
					icon: sap.m.MessageBox.Icon.WARNING,
					title: this.getResourceBundle().getText("RETRY_ITEMS_TITLE"),
					actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
					onClose: function(bResult) {
						if (sap.m.MessageBox.Action.YES === bResult) {
							localModel.setProperty("/pendingItems", errorItems);	
							localModel.setProperty("/pendingItemsCount", errorItems.length);
						}
					}
				});
			}
			this._synchOutput.close();
		}

	});

});