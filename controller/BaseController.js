sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"com/blueboot/createnotification/utils/Offline"
], function(Controller, History, offline) {
	"use strict";

	return Controller.extend("com.blueboot.createnotification.controller.BaseController", {
		/**
		 * Convenience method for accessing the router.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */

		closeBusyDialog: function() {
			if (this._busyDialog) {
				this._busyDialog.close();
			}
		},

		getRouter: function() {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},

		/**
		 * Convenience method for getting the view model by name.
		 * @public
		 * @param {string} [sName] the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function(sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model.
		 * @public
		 * @param {sap.ui.model.Model} oDataModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function(oDataModel, sName) {
			return this.getView().setModel(oDataModel, sName);
		},

		/**
		 * Getter for the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function() {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		onNavBack: function() {
			var history = sap.ui.core.routing.History.getInstance();
			var ushell = parent.sap.ushell || sap.ushell;
			var localModel = sap.ui.getCore().getModel();
			if (history.aHistory.length > 0) {
				var _currentView = history.aHistory[history.iHistoryPosition];
				this.getView().unbindElement();
				switch (_currentView.split("/")[0]) {
					case "":
					case "Empty":
						if(!localModel.getProperty("/ordenesVisibles")){
							localModel.setProperty("/ordenesVisibles", true);
							if (!sap.ui.Device.system.phone) {
								this.getRouter().navTo("empty", {}, true);
							}else{
								this.getRouter().navTo("master", {}, true);
							}
						}else if(ushell){
							this.oCrossAppNav = ushell.Container.getService("CrossApplicationNavigation");
							this.oCrossAppNav.toExternal({
								target: {
									shellHash: "#"
								}
							});
						} else {
							window.history.go(-1);
						}
						break;
					case "Order":
						this.getRouter().navTo("empty", {}, true);
						break;
					case "MeasPoint":
					case "Operation":
						localModel.setProperty("/ordenesVisibles", true);
						this.getRouter().navTo("empty", {}, true);
						break;
					case "ApprReqSet":
						if (!sap.ui.Device.system.phone) {
							this.getRouter().navTo("empty", {}, true);
						} else {
							this.getRouter().navTo("master", {}, true);
						}
						break;
					default:
						if (!sap.ui.Device.system.phone) {
							if (ushell) {
								this.oCrossAppNav = ushell.Container.getService("CrossApplicationNavigation");
								this.oCrossAppNav.toExternal({
									target: {
										shellHash: "#"
									}
								});
							} else {
								window.history.go(-1);
							}
						} else {
							this.getRouter().navTo("master", {}, true);
						}
						break;

				}
			} else {
				if (ushell) {
					this.oCrossAppNav = ushell.Container.getService("CrossApplicationNavigation");
					this.oCrossAppNav.toExternal({
						target: {
							shellHash: "#"
						}
					});
				} else {
					window.history.go(-1);
				}
			}
		},

		navHome: function() {
			if (parent.sap.ushell || sap.ushell) {
				var ushell = parent.sap.ushell || sap.ushell;
				this.oCrossAppNav = ushell.Container.getService("CrossApplicationNavigation");
				this.oCrossAppNav.toExternal({
					target: {
						shellHash: "#"
					}
				});
			}
		},

		isOfflineStoreDefined: function() {
			if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
				if (window.localStorage.OfflineStore) {
					return JSON.parse(window.localStorage.OfflineStore);	
				}
				return false;				 
			} 
			return false;			
		},

		isOfflineStoreCreated: function() {
			return document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1 ? offline.appOfflineStore.store : true;
		},

		isOfflineStoreOpened: function() {
			return document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1 ? offline.isOpened : true;
		},

		onExit: function() {
			offline.saveLocalStorage();
		}		

	});

});