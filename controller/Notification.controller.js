/*global location */
jQuery.sap.require("sap.m.MessageBox");
sap.ui.define([
	"com/blueboot/createnotification/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/blueboot/createnotification/utils/formatter",
	"com/blueboot/createnotification/utils/Offline",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/BusyDialog"
], function (BaseController, JSONModel, formatter, offline, Filter, FilterOperator, BusyDialog) {
	"use strict";

	return BaseController.extend("com.blueboot.createnotification.controller.Notification", {

		formatter: formatter,
		_equipIdNoti: null,
		_equipDesc: null,
		_templete: null,
		_busyDialog: null,

		onInit: function () {
			this._router = sap.ui.core.UIComponent.getRouterFor(this);
			this._router.attachRoutePatternMatched(this.onRouteMatched, this);
			this._oBundle = sap.ui.getCore().getModel("i18n").getResourceBundle();
		},

		onRouteMatched: function (oEvent) {
			if (oEvent.getParameter("name") !== "notification") {
				/* Por alguna razon en el "onNavBack" ejecuta esto yendo al home. En la doc tira que haga esto */
				return;
			}
			var oView = this.getView();
			oView.setBusy(true);
			var localModel = sap.ui.getCore().getModel();
			var oNewNotification = localModel.getProperty("/NewNotification");
			var notifDefaultType = localModel.getProperty("/NotificationTypes").filter(function (x) {
				return x.IS_DEFAULT === "X";
			});
			
			//Limpio las prioridades y status por si tenia alguna seleccionada previamente.
			localModel.setProperty("/BindPriority", [], localModel, true);
			localModel.setProperty("/BindUserStatus", [], localModel, true);
			
			if (notifDefaultType.length > 0) {
				oNewNotification.NotifType = notifDefaultType[0].QMART;
				this.onTypeChange();
			} else {
				oNewNotification.NotifType = "";
			}

			oNewNotification.Planplant = localModel.getProperty("/ActualPlant").Werks;
			var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "yyyyMMddHHmmss"
			});
			oNewNotification.Strmlfndate = oDateFormat.format(new Date());
			oNewNotification.Desstdate = oDateFormat.format(new Date());
			oNewNotification.Desenddate = oDateFormat.format(new Date());

			var equipments = localModel.getProperty("/Equipments");
			var functionalLocations = localModel.getProperty("/FunctionalLocations");
			var equip, functLoc, equipDescr, functLocDesc;
			var object, value, rbnr;
			try {
				functLoc = functionalLocations.filter(function (equip) {
					return equip.Functlocation === oNewNotification.FunctLoc;
				})[0];
				functLocDesc = functLoc.Descript;
				object = "FunctLoc";
				value = oNewNotification.FunctLoc;
				rbnr = functLoc.Rbnr;
			} catch (error) {
				functLocDesc = "";
			}
			try {
				equip = equipments.filter(function (eq) {
					return eq.Equipment === oNewNotification.Equipment;
				})[0];
				equipDescr = equip.Descript;
				object = "Equipment";
				value = oNewNotification.Equipment;
				rbnr = equip.Rbnr;
			} catch (error) {
				equipDescr = "";
			}
			if (equip) {
				oNewNotification.Plangroup = equip.Plangroup;
			}
			
			var auxDesc = {};
			auxDesc.Equipment = equipDescr;
			auxDesc.FunctLoc = functLocDesc;
			localModel.setProperty("/AuxDescriptions", auxDesc, localModel, true);
			var oFileUploader = oView.byId("photoFileUploader");
			oFileUploader.clear();
			oFileUploader.destroyHeaderParameters();
			localModel.setProperty("/refresh", true, localModel, true);

			$.when(this.bindHistoryData(object, value), this.bindPositionInfo(rbnr)).then(function () {
				oView.bindElement("/NewNotification");
				localModel.updateBindings(true);
			}).always(function () {
				oView.setBusy(false);
			});
		},

		onTypeChange: function () {
			var localModel = sap.ui.getCore().getModel();
			var oNewNotification = localModel.getProperty("/NewNotification");
			var notificationTypes = localModel.getProperty("/NotificationTypes");
			var notifType = notificationTypes.filter(function (x) {
				return x.QMART === oNewNotification.NotifType;
			})[0];
			//Cargo status de usuario y prioridades para ese tipo de notificacion

			var priorities = localModel.getProperty("/Priority");
			var userStatuses = localModel.getProperty("/UserStatus");

			var bindPriorities = priorities.filter(function (x) {
				return x.ARTPR === notifType.ARTPR;
			});
			var bindUserStatuses = userStatuses.filter(function (x) {
				return x.STSMA === notifType.STSMA;
			});
			localModel.setProperty("/BindPriority", bindPriorities, localModel, true);
			localModel.setProperty("/BindUserStatus", bindUserStatuses, localModel, true);

			var defaultUserStatus = bindUserStatuses.filter(function (x) {
				return x.INIST === "X";
			});
			oNewNotification.UserStatus = defaultUserStatus.length > 0 ? defaultUserStatus[0].ESTAT : "";
		},

		handleConfirm: function (oEvent) {
			var that = this;
			var localModel = sap.ui.getCore().getModel(),
				oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oNewNotification = localModel.getProperty("/NewNotification");
			if (!oNewNotification.ShortText) {
				sap.m.MessageBox.information(this._oBundle.getText("NOTI_ALERT_SHORT_TEXT"));
				return;
			} else if (!oNewNotification.NotifType) {
				sap.m.MessageBox.information(this._oBundle.getText("NOTI_ALERT_TYPE"));
				return;
			} else if (!oNewNotification.Priority) {
				sap.m.MessageBox.information(this._oBundle.getText("NOTI_ALERT_PRIORITY"));
				return;
			}

			var dialog = new sap.m.Dialog({
				title: this._oBundle.getText("CONFIRM_ACTION"),
				content: [
					new sap.m.Text({
						text: this._oBundle.getText("NOTI_CONFIRM_ACTION")
					})
				],
				beginButton: new sap.m.Button({
					text: this._oBundle.getText("YES"),
					icon: "sap-icon://accept",
					type: sap.m.ButtonType.Accept,
					press: function () {
						dialog.close();
						that.handleConfirmAction(oEvent);
					}
				}),
				endButton: new sap.m.Button({
					text: this._oBundle.getText("NO"),
					icon: "sap-icon://decline",
					type: sap.m.ButtonType.Reject,
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function () {
					dialog.destroy();
				}
			}).addStyleClass("sapUiSizeCompact sapUiContentPadding");
			dialog.open();

		},

		handleConfirmAction: function (oEvent) {
			var that = this;
			var localModel = sap.ui.getCore().getModel(),
				oDataModel = sap.ui.getCore().getModel("oDataModel");
			this._originalHeaders = oDataModel.getHeaders();
			var oNewNotification = localModel.getProperty("/NewNotification");
			
			var oBusyDialog = new BusyDialog();
			oBusyDialog.open();

			var oFileUploader = that.getView().byId("photoFileUploader");

			var base64_marker = ";base64,";
			var notifPhotoSet = [];
			var notifPhotoType = [];
			var notifPhotoFname = [];
			var readAllFiles = $.Deferred();
			if (oFileUploader && oFileUploader.oFileUpload && oFileUploader.oFileUpload.files && oFileUploader.oFileUpload.files.length) {
				var base64_marker = ";base64,";
				var file;
				var fileCount = oFileUploader.oFileUpload.files.length;
				for (var i in Object.keys(oFileUploader.oFileUpload.files)) {
					file = oFileUploader.oFileUpload.files[i];
					var reader = new FileReader();
					reader.onload = function (oEvent) {
						var fileContent = oEvent.target.result;
						var base64index = fileContent.indexOf(base64_marker);
						//Para que el pedido odata funcione, el base64 no tiene que tener el marker.
						var base64 = fileContent.substring(base64index + base64_marker.length).match(/.{1,76}/g).join("\n");
						notifPhotoSet.push(base64);
						notifPhotoType.push(file.type);
						notifPhotoFname.push(file.name)
						fileCount--;
						if (fileCount === 0) {
							readAllFiles.resolve();
						}
					};
					reader.readAsDataURL(file);
				}
			} else {
				readAllFiles.resolve();
			}

			$.when(readAllFiles).then(function () {

				var newNotification = $.extend(true, {}, oNewNotification);
				newNotification.Breakdown = oNewNotification.Breakdown ? "X" : "";
				newNotification.Strmlfndate = oNewNotification.Strmlfndate.substr(0, 8);
				newNotification.Strmlfntime = oNewNotification.Strmlfndate.substr(8, 6);
				newNotification.Desstdate = oNewNotification.Desstdate.substr(0, 8);
				newNotification.Dessttime = oNewNotification.Desstdate.substr(8, 6);
				newNotification.Desenddate = oNewNotification.Desenddate.substr(0, 8);
				newNotification.Desendtime = oNewNotification.Desenddate.substr(8, 6);
				var lines = [];
				try {
					var fulltext = newNotification.NotifLongtextSet[0].TextLine,
						paragraphs = fulltext.split("\n"),
						lineIndex = 1;
					paragraphs = paragraphs.map(function (par) {
						return par.split(" ")
					});
					//pongo distintos parrafos en distintas lineas
					paragraphs.forEach(function (par) {
						var line = "";
						//corto de a 132 char pero por palabra
						par.forEach(function (word) {
							if (line.length + word.length + 1 <= 132) {
								line += " " + word;
							} else {
								lines.push({
									Objkey: "" + lineIndex,
									TextLine: line
								});
								lineIndex++;
								line = word;
								//si ingrsaron una cadena mayor a 132 sin espacios corto de a 132
								while (line.length > 132) {
									newNotification.NotifLongtextSet.push({
										Objkey: "" + lineIndex,
										TextLine: line.substr(0, 132)
									});
									line = line.substr(132);
									lineIndex++;
								}
							}
						});
						lines.push({
							Objkey: "" + lineIndex,
							TextLine: line
						});
						lineIndex++;
					});
				} catch (Ex) {
					lines = [];
				}
				newNotification.NotifLongtextSet = lines;
				oDataModel.create("/NotifSet", newNotification, {
					success: function (data) {
						oBusyDialog.close();
						var dfdNotifPhoto = $.Deferred();
						var notifPhotoCount = notifPhotoSet.length;
						if (notifPhotoCount > 0) {
							for (var i in notifPhotoSet) {
								var sPath = new URL(data.__metadata.uri).href.split(oDataModel.sServiceUrl)[1] + "/NotifPhotoSet"
								oDataModel.setHeaders({
									"slug": notifPhotoFname[i]
								});
								oDataModel.create(sPath, notifPhotoSet[i], {
									success: function (data) {
										notifPhotoCount--;
										if (notifPhotoCount === 0) {
											oDataModel.setHeaders(that._originalHeaders);
											dfdNotifPhoto.resolve();
										}
									},
									error: function (err) {
										notifPhotoCount--;
										if (notifPhotoCount === 0) {
											oDataModel.setHeaders(that._originalHeaders);
											dfdNotifPhoto.reject();
										}
									}
								});
							}
						} else {
							dfdNotifPhoto.resolve();
						}

						$.when(dfdNotifPhoto).then(function () {
							var match = data.__metadata.uri.match(/\((.*)?\)/);
							var msg = that._oBundle.getText("CREATE_ITEM_OFFLINE");
							if (match && match[1]) {
								msg = that._oBundle.getText("NOTI_SUCCESS_MSG", [match[1]]);
							}
							sap.m.MessageBox.success(msg, {
								onClose: function (oAction) {
									if (!sap.ui.Device.system.phone) {
										that._router.navTo("empty", {}, true);
									} else {
										that._router.navTo("master", {}, true);
									}
								}
							});
						});
					},
					error: function (e) {
						oBusyDialog.close();
						e.customMessage = that._oBundle.getText("NOTI_ERROR_MSG");
						oDataModel.fireRequestFailed(e);
					}
				});
			});
		},

		handleWorkCentersHelp: function (oEvent) {
			// create value help dialog
			if (!this._valueHelpDialog) {
				this._valueHelpDialog = sap.ui.xmlfragment(
					"com.blueboot.createnotification.view.WorkCenter",
					this
				);
				this.getView().addDependent(this._valueHelpDialog);
			}
			this._valueHelpDialog.open();
		},

		handleWorkCentersSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value").toUpperCase(),
				oBinding = oEvent.getSource().getBinding("items");
				//oFilter = new sap.ui.model.Filter("Arbpl", sap.ui.model.FilterOperator.Contains, sValue);
			var oFilter = new Filter({
		      filters: [
		        new Filter("Arbpl", sap.ui.model.FilterOperator.Contains, sValue),
		        new Filter("Ktext", sap.ui.model.FilterOperator.Contains, sValue)
		      ],
		      and: false
		    });
			oBinding.filter([oFilter]);
		},

		handleWorkCentersClose: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem"),
				oLocalModel = sap.ui.getCore().getModel(),
				oSelectedObject = oLocalModel.getProperty(oSelectedItem.getBindingContext().getPath());

			oLocalModel.setProperty("/NewNotification/PmWkctr", oSelectedObject.Objid);
			oEvent.getSource().getBinding("items").filter([]);
		},

		onPriorityChange: function () {
			var localModel = sap.ui.getCore().getModel();
			var oNewNotification = localModel.getProperty("/NewNotification");

			var priorities = localModel.getProperty("/BindPriority");

			var index = priorities.findIndex(function (x) {
				return x.PRIOK === oNewNotification.Priority;
			});

			//Si se pasa de 30 o 31 el date hace lo suyo.
			var startDate = new Date(oNewNotification.Strmlfndate.substring(0, 4), parseInt(oNewNotification.Strmlfndate.substring(4, 6)) - 1,
				parseInt(oNewNotification.Strmlfndate.substring(6, 8)) + parseInt(priorities[index].TAGBN), oNewNotification.Strmlfndate.substr(8,
					2),
				oNewNotification.Strmlfndate.substr(10, 2), oNewNotification.Strmlfndate.substr(12, 2));
			var endDate = new Date(oNewNotification.Strmlfndate.substring(0, 4), parseInt(oNewNotification.Strmlfndate.substring(4, 6)) - 1,
				parseInt(oNewNotification.Strmlfndate.substring(6, 8)) + parseInt(priorities[index].TAGEN), oNewNotification.Strmlfndate.substr(8,
					2),
				oNewNotification.Strmlfndate.substr(10, 2), oNewNotification.Strmlfndate.substr(12, 2));
			var that = this;
			sap.m.MessageBox.show(
				that._oBundle.getText("PRIORITY_CHANGE_TEXT"), {
					icon: sap.m.MessageBox.Icon.INFORMATION,
					title: that._oBundle.getText("PRIORITY_CHANGE_TITLE"),
					actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.YES) {
							var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
								pattern: "yyyyMMddHHmmss"
							});
							oNewNotification.Desstdate = oDateFormat.format(startDate);
							oNewNotification.Desenddate = oDateFormat.format(endDate);
							localModel.refresh();
						}
					}
				}
			);

		},

		onObjectPartChange: function (oControlEvent) {
			var localModel = sap.ui.getCore().getModel();
			var oNewNotification = localModel.getProperty("/NewNotification");
			var objectPart = localModel.getProperty(oControlEvent.mParameters.selectedItem.getBindingContext().sPath);
			oNewNotification.NotifItemSet[0].DlCode = objectPart.CODE;
		},

		onSymptomChange: function (oControlEvent) {
			var localModel = sap.ui.getCore().getModel();
			var oNewNotification = localModel.getProperty("/NewNotification");
			var symptom = localModel.getProperty(oControlEvent.mParameters.selectedItem.getBindingContext().sPath);
			oNewNotification.NotifItemSet[0].DCode = symptom.CODE;
		},

		onCauseChange: function (oControlEvent) {
			var localModel = sap.ui.getCore().getModel();
			var oNewNotification = localModel.getProperty("/NewNotification");
			var cause = localModel.getProperty(oControlEvent.mParameters.selectedItem.getBindingContext().sPath);
			oNewNotification.NotifItemSet[0].CauseCode = cause.CODE;
		},

		onHistoryUpdateFinished: function (oEvent) {
			if (oEvent.getParameter("reason") !== "Sort") {
				var oTable = oEvent.getSource(),
					oBinding = oTable.getBinding("items");
				oBinding.sort(new sap.ui.model.Sorter("Date", true, null, function (d1, d2) {
					// Compare two dates
					if (d1 && d2) {
						var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
								pattern: "yyyyMMdd"
							}),
							date1 = oDateFormat.parse(d1),
							date2 = oDateFormat.parse(d2);
						if (date1.getTime() < date2.getTime()) {
							return -1;
						} else if (date1.getTime() === date2.getTime()) {
							return 0;
						} else {
							return 1;
						}
					}
				}));
			}
		},

		onHidden: function (evt) {

			var localModel = sap.ui.getCore().getModel();
			var showHiddenNotification = !localModel.getProperty("/showHiddenNotification");

			localModel.setProperty("/showHiddenNotification", showHiddenNotification, localModel, true);

			if (localModel.getProperty("/refresh")) {
				//Si hago el clear en el route matched como el control no es visible genera problemas al querer cargar el mismo archivo que ya estaba cargado
				//Seteo la variable refresh en el on routematched en true, entonces sé que tengo que ademas tirar el clear acá.
				//El timeout es para esperar a que el control este visible
				var oView = this.getView();
				setTimeout(function () {
					var oFileUploader = oView.byId("photoFileUploader");
					oFileUploader.clear();
					localModel.setProperty("/refresh", false, localModel, true);
				}, 100);
			}

		},

		onCatalog: function () {
			if (!this._catalogDialog) {
				//var masterController = sap.ui.controller("com.blueboot.createnotification.controller.Master");
				this._catalogDialog = sap.ui.xmlfragment(
					"com.blueboot.createnotification.view.Catalog",
					this
				);
				this.getView().addDependent(this._catalogDialog);
			}
			this._catalogDialog.open();
		},

		handleRbnrSelect: function (oEvent) {
			var params = oEvent.getParameter("selectedItem");
			var oView = this.getView();

			oView.setBusy(true);
			$.when(this.bindPositionInfo(params.mProperties.title)).always(function () {
				oView.setBusy(false);
			});
		},

		handleRbnrSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilterTitle = new sap.ui.model.Filter("RBNR", sap.ui.model.FilterOperator.Contains, sValue);
			var oFilterDesc = new sap.ui.model.Filter("RBNRX", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(new sap.ui.model.Filter({
				filters: [oFilterTitle, oFilterDesc],
				or: true
			}));
		},

		bindHistoryData: function (object, value) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel");
			var localModel = sap.ui.getCore().getModel();
			// Cargo historial
			var that = this;
			var dfdHistory = $.Deferred();
			oDataModel.read("/NotifSet", {
				success: function (oData, response) {
					var oHistory = oData.results;
					localModel.setProperty("/NotificationHistory", oHistory, localModel, true);
					dfdHistory.resolve();
				},
				error: function (oError) {
					oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
					dfdHistory.reject();
					oDataModel.fireRequestFailed(oError);
				},
				filters: [new sap.ui.model.Filter(object, sap.ui.model.FilterOperator.EQ, value)]
			});

			return dfdHistory;
		},

		bindPositionInfo: function (rbnr) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				localModel = sap.ui.getCore().getModel();
			var that = this;
			var dfdPositionInfo = jQuery.Deferred();
			var dfdObjectPart = jQuery.Deferred();
			var dfdSymptoms = jQuery.Deferred();
			var dfdCauses = jQuery.Deferred();
			localModel.setProperty("/ObjectParts", [], localModel, true);
			localModel.setProperty("/Symptoms", [], localModel, true);
			localModel.setProperty("/Causes", [], localModel, true);
			
			var filters = [];
			
			if (rbnr) {
				filters.push(new Filter("RBNR", FilterOperator.EQ, rbnr));
			}

			oDataModel.read("/ObjectPartSet", {
				success: function (oData, response) {
					oData.results = oData.results.filter(function (x) {
						return x.CODE;
					});
					oData.results = oData.results.sort(function (a, b) {
						return (a.CODEGRUPPE === b.CODEGRUPPE) ? (parseInt(a.CODE) - parseInt(b.CODE)) : a.CODEGRUPPE < b.CODEGRUPPE;
					});
					localModel.setProperty("/ObjectParts", oData.results, localModel, true);
					dfdObjectPart.resolve();
				},
				error: function (oError) {
					oError.customMessage = that.getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
					dfdObjectPart.reject("B");
					oDataModel.fireRequestFailed(oError);
				},
				filters: filters
			});

			oDataModel.read("/SymptomsSet", {
				success: function (oData, response) {
					oData.results = oData.results.filter(function (x) {
						return x.CODE;
					});
					oData.results = oData.results.sort(function (a, b) {
						return (a.CODEGRUPPE === b.CODEGRUPPE) ? (parseInt(a.CODE) - parseInt(b.CODE)) : a.CODEGRUPPE < b.CODEGRUPPE;
					});
					localModel.setProperty("/Symptoms", oData.results, localModel, true);
					dfdSymptoms.resolve();
				},
				error: function (oError) {
					oError.customMessage = that.getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
					dfdSymptoms.reject("B");
					oDataModel.fireRequestFailed(oError);
				},
				filters: filters
			});

			oDataModel.read("/CauseSet", {
				success: function (oData, response) {
					oData.results = oData.results.filter(function (x) {
						return x.CODE;
					});
					oData.results = oData.results.sort(function (a, b) {
						return (a.CODEGRUPPE === b.CODEGRUPPE) ? (parseInt(a.CODE) - parseInt(b.CODE)) : a.CODEGRUPPE < b.CODEGRUPPE;
					});
					localModel.setProperty("/Causes", oData.results, localModel, true);
					dfdCauses.resolve();
				},
				error: function (oError) {
					oError.customMessage = that.getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
					dfdCauses.reject("B");
					oDataModel.fireRequestFailed(oError);
				},
				filters: filters
			});

			$.when(dfdObjectPart, dfdSymptoms, dfdCauses).then(
				function () {
					dfdPositionInfo.resolve();
				},
				function (args) {
					if (args) {
						var msg = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
						switch (args) {
						case "B":
							msg = that._oBundle.getText("NOTIFICATIONS_GROUP_CODE_OP");
							break;
						case "C":
							msg = that._oBundle.getText("NOTIFICATIONS_GROUP_CODE_SYM");
							break;
						case "5":
							msg = that._oBundle.getText("NOTIFICATIONS_GROUP_CODE_CAUS");
							break;
						}
						sap.m.MessageBox.error(msg);
					}
					dfdPositionInfo.resolve();
				});
			return dfdPositionInfo;
		},

		handleNavButtonPress: function () {
			this._router.navTo("master", {}, true);
		}

	});

});