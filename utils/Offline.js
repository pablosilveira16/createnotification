sap.ui.define([
	"sap/m/BusyDialog",
	"sap/m/MessageBox",
	"sap/ui/thirdparty/datajs",
	"sap/ui/model/json/JSONModel",
	"com/blueboot/createnotification/utils/DBHelper"
], function(BusyDialog, MessageBox, dtjs, jsnmdl, DBHelper) {
	"use strict";

	return {

		appContext: null,
		appOfflineStore: {},
		appLocalStorageContext: null,
		i18n: null,
		isOpened: false,

		doLogonInit: function(context, appId) {
			//set offline store attribute first
			var dfd = $.Deferred();
			this.appOfflineStore.appID = appId;
			this.appOfflineStore.interval = 300000; //5 minutes

			var that = this;
			sap.Logon.init(
				function(context) {
					//Make sure Logon returned a context for us to work with
					if (context) {
						that.appContext = context;
						dfd.resolve();
					}
				},
				function() {
					dfd.reject("LOGON_FAILED");
				}, appId, context);

			return dfd;
		},

		doDeleteRegistration: function() {
			var that = this;
			if (this.appContext) {
				//Call logon's deleteRegistration method
				sap.Logon.core.deleteRegistration(
					function(res) {
						var context = JSON.parse(JSON.stringify(that.appContext));
						that.appContext = null;

						that.doLogonInit(context, that.appOfflineStore.appID);
					},
					function(errObj) {
						//No connection causes error but still deletes registration on client's side.
						var context = JSON.parse(JSON.stringify(that.appContext));
						that.appContext = null;

						that.doLogonInit(context, that.appOfflineStore.appID);
					});
			}
		},

		createAppOfflineStore: function(definingRequests) {
			if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
				if (definingRequests) {
					var properties = {
						"name": "MasterDetailAppOfflineStore",
						"host": this.appContext.registrationContext.serverHost,
						"port": this.appContext.registrationContext.serverPort,
						"https": this.appContext.registrationContext.https,
						"serviceRoot": this.appContext.applicationEndpointURL + "/",
						"refreshSAMLSessionOnResume": "skip",
						"definingRequests": definingRequests
					};

					if (!this.appOfflineStore.store) {
						this.appOfflineStore.store = sap.OData.createOfflineStore(properties);
					}
				}
			}
		},

		openAppOfflineStore: function(definingRequests) {
			var dfd = $.Deferred();
			var oResourceModel = new sap.ui.model.resource.ResourceModel({
				bundleUrl: "i18n/i18n.properties"
			});
			this.i18n = oResourceModel.getResourceBundle();
			var that = this;
			if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
				if (!this.appOfflineStore.store) {
					dfd.reject("OFFLINE_NO_STORE");
					return dfd;
				}

				var busyDL = new BusyDialog();
				busyDL.setTitle(this.i18n.getText("openOfflineStoreTitle"));
				busyDL.setText(this.i18n.getText("openOfflineStoreMessage"));
				busyDL.open();

				this.appOfflineStore.store.open(
					function() {
						that.isOpened = true;
						busyDL.close();
						//set offline client
						sap.OData.applyHttpClient();
						sap.OData.httpClientApplied = true;
						sap.ui.getCore().getModel("oDataModel").refreshMetadata();
						dfd.resolve();
					},
					function(e) {
						busyDL.close();
						dfd.reject("OFFLINE_OPEN_ERROR", e);
					});
			} else {
				dfd.resolve();
			}
			return dfd;
		},

		refreshAppOfflineStore: function() {
			if (!this.appOfflineStore.store) {
				return;
			}
			var oEventBus = sap.ui.getCore().getEventBus();
			var that = this;
			if (window.navigator.onLine) {
				//this.appOfflineStore.startTimeRefresh = new Date();
				this.appOfflineStore.store.refresh(
					function() {
						//publish ui5 offlineStore Synced event
						sap.OData.applyHttpClient();
						sap.OData.httpClientApplied = true;
						oEventBus.publish("OfflineStore", "Synced");
					},
					function(e) {
						that.appOfflineStore.callbackError = e;
						//publish ui5 offlineStore Synced event
						sap.OData.applyHttpClient();
						sap.OData.httpClientApplied = true;
						oEventBus.publish("OfflineStore", "Synced");
					});
			}
		},

		flushAppOfflineStore: function() {
			if (!this.appOfflineStore.store) {
				return;
			}
			if (window.navigator.onLine) {
				var that = this;
				
				var oDataModel = sap.ui.getCore().getModel("oDataModel");
				sap.OData.removeHttpClient();
        		sap.OData.httpClientApplied = false;
        		
				$.when(oDataModel.flush()).then(function() {

					that.appOfflineStore.store.flush(
						function() {
							//check offline error
							that.refreshAppOfflineStore();
						},
						function(e) {
							//save the error
							that.appOfflineStore.callbackError = e;
							sap.OData.applyHttpClient();
							sap.OData.httpClientApplied = true;
							var oEventBus = sap.ui.getCore().getEventBus();
							oEventBus.publish("OfflineStore", "Synced");
						});
				});

			} else {
				sap.m.MessageBox.show(this.i18n.getText("NO_CONNECTION"), {
					icon: sap.m.MessageBox.Icon.WARNING
				});
				return -1;
			}
		},

		deleteAppOfflineStore: function() {
			var dfd = $.Deferred();
			var that = this;
			$.when(this.forceCheckIfOnlineAndLoggedIn()).then(function(){
				if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
						sap.m.MessageBox.show(sap.ui.getCore().getModel("i18n").getResourceBundle().getText("OFFLINE_STORE_CHANGE"), {
							icon: sap.m.MessageBox.Icon.WARNING,
							title: sap.ui.getCore().getModel("i18n").getResourceBundle().getText("OFFLINE_STORE_CHANGE_TITLE"),
							actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
							onClose: function(bResult) {
								var localModel = sap.ui.getCore().getModel();
								localModel.setProperty("/ContextChanging", false);
							if (sap.m.MessageBox.Action.YES === bResult) {
								if (that.appOfflineStore.store) {
									that.appOfflineStore.store.close(
										function() {
											that.appOfflineStore.store.clear(
												function() {
													that.destroyLocalStorage();
													sap.OData.removeHttpClient();
													sap.OData.httpClientApplied = false;
													that.appOfflineStore.store = null;
													delete window.localStorage.OfflineStore;
													that.isOpened = false;
													dfd.resolve();
												},
												function(err) {
													//Da error pero destruye la Store que es lo que queremos
													that.destroyLocalStorage();
													sap.OData.removeHttpClient();
													sap.OData.httpClientApplied = false;
													that.appOfflineStore.store = null;
													delete window.localStorage.OfflineStore;
													that.isOpened = false;
													dfd.resolve();
													console.log("Error al intentar limpiar offline store");
													console.log(err);

												}
											);
										},
										function(err) {
											//Da error pero destruye la Store que es lo que queremos
											that.destroyLocalStorage();
											sap.OData.removeHttpClient();
											sap.OData.httpClientApplied = false;
											that.appOfflineStore.store = null;
											delete window.localStorage.OfflineStore;
											that.isOpened = false;
											dfd.resolve();
											console.log("Error al intentar elimninar offline store");
											console.log(err);
										}
									);
								} else {
									dfd.resolve();
								}
							} else {
								dfd.reject();
							}
						}
					});
				} else {
					dfd.resolve();
				}
			});
			return dfd;
		},
		forceCheckIfOnlineAndLoggedIn: function(){
			var dfd = $.Deferred()
			if (window.navigator.onLine) {
				sap.Logon.performSAMLAuth( 
					function() {
						dfd.resolve();
					},
					function(oError) {
						sap.m.MessageBox.show(sap.ui.getCore().getModel("i18n").getResourceBundle().getText("OFFLINE_OPEN_ERROR"), {
						 icon: sap.m.MessageBox.Icon.ERROR
						});
						dfd.reject();
					}
				);
			}
			return dfd;
		},
		saveLocalStorage: function() {
			if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
				var localModel = sap.ui.getCore().getModel();
				var objToSave = {};
				for (var i in this.appLocalStorageContext) {
					objToSave[i] = localModel.getProperty(this.appLocalStorageContext[i].path);
				}
				this._saveToSessionStorage(objToSave);
			}
		},

		loadLocalStorage: function(context) {
			var dfd = $.Deferred();
			var localModel = sap.ui.getCore().getModel();
			if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
				this.appLocalStorageContext = $.extend(true, {}, context);				
				this._getFromSessionStorage($.proxy(function(dfd, dbData){
					for (var i in this.appLocalStorageContext) {
						if (dbData && typeof dbData[i] !== "undefined") {
							localModel.setProperty(this.appLocalStorageContext[i].path, dbData[i]);
						} else {
							if (this.appLocalStorageContext[i].defaultValue) {
								localModel.setProperty(this.appLocalStorageContext[i].path, this.appLocalStorageContext[i].defaultValue);
							}
						}
					}
					dfd.resolve();
				}, this, dfd));
			}else{
				var initialParameters = localModel.getProperty("/initialParameters");
				if (initialParameters) {
					localModel.setProperty("/ActualPlant", {Werks: initialParameters.Planplant}, localModel, true);
					dfd.resolve();
				}else if (sessionStorage.ZCREATENOTIF == "saved"){
		          this._getFromSessionStorage($.proxy(function(dfd, dbData){
						for (var i in this.appLocalStorageContext) {
							if (dbData && typeof dbData[i] !== "undefined") {
								localModel.setProperty(this.appLocalStorageContext[i].path, dbData[i]);
							} else {
								if (this.appLocalStorageContext[i].defaultValue) {
									localModel.setProperty(this.appLocalStorageContext[i].path, this.appLocalStorageContext[i].defaultValue);
								}
							}
						}
						dfd.resolve();
					}, this, dfd));
		        } else {
		        	dfd.resolve();
		        }
			}
			return dfd;
		},

		_getFromSessionStorage: function(callback){
			DBHelper.readAll(
				"sessions"
				).then(function(records){
					var fetched = records[0];
					fetched = fetched? JSON.parse(fetched): null;
					callback(fetched);
				});
		},

		_saveToSessionStorage: function(jsonObj){
			DBHelper.save(
				"sessions",
				JSON.stringify(jsonObj)
				).then(function(){
					sessionStorage.ZCREATENOTIF = "saved";
				});
		},

		destroyLocalStorage: function() {
			for (var i in this.appLocalStorageContext) {
				delete window.localStorage[i];
			}
		}
	};

});