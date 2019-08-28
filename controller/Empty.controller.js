sap.ui.define([
	"com/blueboot/createnotification/controller/BaseController"
], function(BaseController) {
	"use strict";

	return BaseController.extend("com.blueboot.createnotification.controller.Empty", {
		onInit: function() {
			this.getRouter().attachRoutePatternMatched(this.onRouteMatched, this);
		},

		onRouteMatched: function(oEvent) {
			if (oEvent.getParameter("name") !== "empty") {
				/* Por alguna razon en el "onNavBack" ejecuta esto yendo al home. En la doc tira que haga esto */
				return;
			}
		},

		handleNavButtonPress: function() {
			var eventBus = sap.ui.getCore().getEventBus();
			eventBus.publish("MasterController", "navBack");
		}

	});

});