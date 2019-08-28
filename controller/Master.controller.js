/*global history */
sap.ui.define([
  "com/blueboot/createnotification/controller/BaseController",
  "com/blueboot/createnotification/model/models",
  "com/blueboot/createnotification/utils/Offline",
  "com/blueboot/createnotification/utils/formatter",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/BusyDialog",
  "com/blueboot/createnotification/config/config"
], function (BaseController, models, offline, formatter, Filter, FilterOperator, BusyDialog, config) {
  "use strict";

  return BaseController.extend("com.blueboot.createnotification.controller.Master", {
    _router: null,
    _dialog: null,
    _idStack: [],
    _baseEquipments: [],
    _baseFunctionalLocations: [],
    _currentId: null,
    _initialContext: null,
    _scanner: null,
    formatter: formatter,
    oSearcher: null,

    onInit: function () {
      /*
        No modificar este metodo ni agregar codigo acá. Agregar todo código custom del onInit en la funcion "customInit"
      */
      sap.ui.require(['com/blueboot/createnotification/utils/Scanner']);
      this._router = sap.ui.core.UIComponent.getRouterFor(this);
      this._oBundle = sap.ui.getCore().getModel("i18n").getResourceBundle();
      var oEventBus = sap.ui.getCore().getEventBus();
      oEventBus.subscribe("OfflineStore", "OfflineOpened", jQuery.proxy(this.customInit, this), this);
      oEventBus.subscribe("OfflineStore", "OfflineNoStore", jQuery.proxy(this.onConfig, this), this);
      oEventBus.publish("OfflineStore", "OfflineStart");
    },

    customInit: function () {
      var oEventBus = sap.ui.getCore().getEventBus();
      oEventBus.subscribe("CreateNotification", "onNavBack", jQuery.proxy(this.handleNavButtonPress, this), this);
      oEventBus.subscribe("MasterController", "navBack", jQuery.proxy(this.handleNavButtonPress, this), this);

      if (!this.isOfflineStoreCreated() && !this.isOfflineStoreOpened()) {
        this.onConfig();
      } else {
        var oDataModel = sap.ui.getCore().getModel("oDataModel");
        var that = this;
        $.when(oDataModel.dfdMetadata).then(function() {
          that._bindInitialContext();
          that.bindTreeInfo();
        })
        
      }
    },

    onContextChange: function () {
      var eventBus = sap.ui.getCore().getEventBus();
      eventBus.publish("OfflineStore", "ContextChange");
    },

    setOfflineContext: function (mParameters) {
      var localModel = sap.ui.getCore().getModel();

      localModel.setProperty("/ActualPlant", mParameters.actualPlant, localModel, true);
      localModel.setProperty("/RootElement", mParameters.funcLoc, localModel, true);
      var definingRequests;
      var plant = mParameters.actualPlant.Werks;
      var rootElement = mParameters.funcLoc;
      definingRequests = {
        "EquipSet": "/EquipSet?$filter=Planplant eq '" + plant + "' and RootElement eq '" + rootElement + "'",
        "FuncLocSet": "/FuncLocSet?$filter=Planplant eq '" + plant + "' and RootElement eq '" + rootElement + "'",
        "NotificationTypeSet": "/NotificationTypeSet",
        "PrioritySet": "/PrioritySet",
        "PlanGroupSet": "/PlanGroupSet",
        "UserStatusSet": "/UserStatusSet",
        "NotifEffectSet": "/NotifEffectSet",
        "CatalogSet": "/CatalogSet",
        "ObjectPartSet": "/ObjectPartSet",
        "CauseSet": "/CauseSet",
        "SymptomsSet": "/SymptomsSet",
        "WorkCenterSet": "/WorkCenterSet?$expand=PersonSet&$filter=Werks eq '" + plant + "'",
        //"PlantSet": "/PlantSet",
        //"LocationSet": "/LocationSet",
        //"PlantSectionSet": "/PlantSectionSet"
      };
      var oEventBus = sap.ui.getCore().getEventBus();
      oEventBus.publish("OfflineStore", "DefiningRequests", {
        definingRequests: definingRequests
      });
    },

    refreshData: function () {
    
      var that = this;
      if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
        $.when(offline.forceCheckIfOnlineAndLoggedIn()).then(function(){
          that.getView().setBusy(true);
          setTimeout(function(){
            var oEventBus = sap.ui.getCore().getEventBus();
            oEventBus.publish("OfflineStore", "Refreshing");
            that.getView().setBusy(false);
          },100);
        });
      } else {
        console.log("Esta funcionalidad es solo para Kapsel Offline.");
      }
    },

    onConfig: function () {
      var that = this;
      $.when(offline.forceCheckIfOnlineAndLoggedIn()).then(function(){
          setTimeout(function() {
            var localModel = sap.ui.getCore().getModel();
            var oDataModel = sap.ui.getCore().getModel("oDataModel");            
            localModel.setProperty("/OfflineContext", []);
            var filterCriteria = localModel.getProperty("/FilterCriteria");
            if (filterCriteria) {
              localModel.setProperty("/FilterCriteria", filterCriteria);
            } else {
              localModel.setProperty("/FilterCriteria", "FuncLocSet");
            }
            localModel.setProperty("/searchText", "");
            if (!that._dialog) {
              that._dialog = sap.ui.xmlfragment("com.blueboot.createnotification.view.Filter", that);
              that._dialog.setModel(sap.ui.getCore().getModel("i18n"), "i18n");
              that._dialog.setModel(sap.ui.getCore().getModel("device"), "device");
              that._dialog.setModel(sap.ui.getCore().getModel());
              that.getView().addDependent(that._dialog);
            }

            models.initLocalModel(that.getOwnerComponent());

            oDataModel.read("/PlantSet", {
              success: function (oData, response) {
                localModel.setProperty("/PlantSet", oData.results, localModel, true);
                that._dialog.open();
              },
              error: function (oError) {
                oError.customMessage = "SOMETHING_HAS_HAPPENED";
                oDataModel.fireRequestFailed(oError);
              }
            });
          }, 0);             
        }); 
    },

    _bindInitialContext: function () {
      // No mostramos nada hasta que seleccione centro
      var localModel = sap.ui.getCore().getModel();
      localModel.setProperty("/ActualEquipments", [], localModel, true);
      localModel.setProperty("/ActualFunctionalLocations", [], localModel, true);
    },

    bindTreeInfo: function (mParameters) {
      var that = this;
      var oDataModel = sap.ui.getCore().getModel("oDataModel");
      var localModel = sap.ui.getCore().getModel();
      var dfdTree = $.Deferred();
      var dfdPlanGroup = $.Deferred();
      var dfdWorkCenter = $.Deferred();
      var dfdEquip = $.Deferred();
      var dfdFuncLoc = $.Deferred();
      var oBusyDialog = new sap.m.BusyDialog();
      var actualPlant, funcLoc;
      if (!mParameters) {
        //inicializo la variable si no la pasaron para poder asignar el actualPlant y funcLoc en la siguiente sentencia
        mParameters = {};
      }
      actualPlant = mParameters.actualPlant || localModel.getProperty("/ActualPlant");
      funcLoc = mParameters.funcLoc || localModel.getProperty("/RootElement");

      oBusyDialog.setTitle(that._oBundle.getText("PLANT_LOADING"));
      oBusyDialog.setText(that._oBundle.getText("TAKE_A_WHILE"));
      oBusyDialog.open();
      oDataModel.read("/PlanGroupSet", {
        success: function (oData, response) {
          localModel.setProperty("/Plangroup", oData.results, localModel, true);
          dfdPlanGroup.resolve();
        },
        error: function (oError) {
          dfdPlanGroup.reject();
          oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
          oDataModel.fireRequestFailed(oError);
        },
        filters: [
          new sap.ui.model.Filter("IWERK", sap.ui.model.FilterOperator.EQ, actualPlant.Werks)
        ]
      });
      oDataModel.read("/WorkCenterSet?$expand=PersonSet", {
        success: function (oData, response) {
          localModel.setProperty("/WorkCenter", oData.results, localModel, true);
          dfdWorkCenter.resolve();
        },
        error: function (oError) {
          dfdWorkCenter.reject();
          oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
          oDataModel.fireRequestFailed(oError);
        },
        filters: [new sap.ui.model.Filter("Werks", sap.ui.model.FilterOperator.EQ, actualPlant.Werks)]
      });

      var filters = [
        new sap.ui.model.Filter("Planplant", sap.ui.model.FilterOperator.EQ, actualPlant.Werks),
        new sap.ui.model.Filter("RootElement", sap.ui.model.FilterOperator.EQ, funcLoc)
      ];

      if (!mParameters.ignoreTree) {
        oDataModel.read("/EquipSet", {
          success: function (oData, response) {
            var aActualEquipments = oData.results;
            localModel.setProperty("/Equipments", aActualEquipments, localModel, true);
            dfdEquip.resolve();
          },
          error: function (oError) {
            dfdEquip.reject();
            oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
            oDataModel.fireRequestFailed(oError);
          },
          filters: filters
        });
        oDataModel.read("/FuncLocSet", {
          success: function (oData, response) {
            var aActualFuncLocs = oData.results;
            localModel.setProperty("/FunctionalLocations", aActualFuncLocs, localModel, true);
            dfdFuncLoc.resolve();
          },
          error: function (oError) {
            dfdFuncLoc.reject();
            oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
            oDataModel.fireRequestFailed(oError);
          },
          filters: filters
        });
      } else {
        dfdEquip.resolve();
        dfdFuncLoc.resolve();
      }

      $.when(dfdEquip, dfdFuncLoc, dfdPlanGroup, dfdWorkCenter).then(
        function () {
          oBusyDialog.close();
          that._bindLists("");
          dfdTree.resolve();
        },
        function () {
          oBusyDialog.close();
          dfdTree.reject();
        });

      return dfdTree;
    },

    _bindLists: function (currentId) {
      this._currentId = currentId;
      var localModel = sap.ui.getCore().getModel();
      //var oPlant = localModel.getProperty("/ActualPlant");
      var rootElement = localModel.getProperty("/RootElement");

      if (currentId === "") {
        currentId = rootElement;
      }

      var aActualEquipments = localModel.getProperty("/Equipments");
      aActualEquipments = aActualEquipments ?
        aActualEquipments.filter(function (x) {
          return x.Functlocation === currentId;
        }) : [];
      localModel.setProperty("/ActualEquipments", aActualEquipments, localModel, true);

      var aActualFuncLocs = localModel.getProperty("/FunctionalLocations");

      if (aActualFuncLocs) {
        var currentIdIndex = aActualFuncLocs.findIndex(function (x) {
          return x.Functlocation === currentId;
        });
        if (currentIdIndex >= 0) {
          var supflocObject = aActualFuncLocs[currentIdIndex];
          localModel.setProperty("/MasterTitle", supflocObject.Functlocation + " - " + supflocObject.Descript, localModel, true);
        }
        aActualFuncLocs = aActualFuncLocs.filter(function (x) {
          return x.Supfloc === currentId;
        })
      } else {
        aActualFuncLocs = [];
      }
      localModel.setProperty("/ActualFunctionalLocations", aActualFuncLocs, localModel, true);
    },

    /******************** FILTER FUNCTIONS START ********************/

    afterOpenFilter: function () {
      $("#searchInput").attr("autocomplete", "off");
      $("#searchInput-inner").attr("autocomplete", "off");
    },

    closeDialog: function () {
      this._dialog.close();
      this._dialog.destroy();
      this._dialog = null;
    },

    handleFilterCriteriaChange: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      localModel.setProperty("/searchResults", [], localModel, true);
    },

    onScanFilter: function () {
      var that = this;
      var permissions = cordova.plugins.permissions;
      permissions.checkPermission(permissions.CAMERA, function( status ){
        if ( status.hasPermission ) {
          that.qrFilter();
        }
        else {
          permissions.requestPermission(permissions.CAMERA, success, error); 
          function error() {
            console.warn('Camera permission is not turned on');
          }
           
          function success( status ) {
            if( !status.hasPermission ) error();
          }
        }
      });
    },

    qrFilter: function() {
      var that = this;
      if (!this._qrDialog) {
        this._qrDialog = sap.ui.xmlfragment("com.blueboot.createnotification.view.QR", this);
        this.getView().addDependent(this._selectDialog);
      }
      this._qrDialog.open();

        this._scanner = new Instascan.Scanner({
          video: sap.ui.getCore().byId('preview').$()[0]
        });

        this._scanner.addListener('scan', function (content) {
          that._qrDialog.close();
          that._scanner.stop();
          var localModel = sap.ui.getCore().getModel();
          localModel.setProperty("/searchText", content, localModel, true);
          that.handleFilterAccept();
        });

      Instascan.Camera.getCameras().then(function (cameras) {
        if (!jQuery.device.is.phone) {
          if (cameras.length > 0) {
            that._scanner.start(cameras[0]);
          } else {
            console.error('No cameras found.');
          }
        } else {
          if (cameras.length > 0) {
            if (cameras.length == 1) {
              that._scanner.start(cameras[0]);
            } else {
              that._scanner.start(cameras[1]);
            }
          } else {
            console.error('No cameras found.');
          }
        }
      }).catch(function (e) {
        console.error(e);
      });
    },

    qrClose: function () {
      if (this._qrDialog) {
        this._qrDialog.close();
        this._scanner.stop();
      }
    },
    
    qrDialogAfterClose: function () {
    	this._qrDialog.destroy();
    	this._qrDialog = null;
    },

    /**************** FILTER FUNCTIONS END *********************/

    /**************** MASTER LIST EVENTS START ****************/

    handleRefresh: function (oEvent) {
      this.handleSearch(oEvent);
      var that = this;
      setTimeout(function () {
        that.getView().byId("pullToRefresh").hide();
      }, 200);
    },
    handleSearch: function (oEvent) {
      var sValue = oEvent.getParameter("query");
      if (sValue) {
        var localModel = sap.ui.getCore().getModel();
        var oDataModel = sap.ui.getCore().getModel("oDataModel");
        var oPlant = localModel.getProperty("/ActualPlant");
        var dfdEquip = $.Deferred();
        var dfdFuncLoc = $.Deferred();
        var that = this;
        var oBusyDialog = new sap.m.BusyDialog();
        oBusyDialog.open();
        sValue = sValue.toUpperCase();
        //Los equipos se filtran con un substring de 0 a 18 por que el EQUNR es de 18 y el TPLNR de 30
        oDataModel.read("/EquipSet", {
          success: function (oData, response) {
            var aActualEquipments = oData.results;
            localModel.setProperty("/ActualEquipments", aActualEquipments, localModel, true);
            dfdEquip.resolve();
          },
          error: function (oError) {
            oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
            oDataModel.fireRequestFailed(oError);
            dfdEquip.reject();
          },
          filters: [new sap.ui.model.Filter("Equipment", sap.ui.model.FilterOperator.EQ, sValue.substring(0, 18)), new sap.ui.model.Filter(
            "Planplant", sap.ui.model.FilterOperator.EQ, oPlant.Werks)]
        });
        oDataModel.read("/FuncLocSet", {
          success: function (oData, response) {
            var aActualFuncLocs = oData.results;
            localModel.setProperty("/ActualFunctionalLocations", aActualFuncLocs, localModel, true);
            dfdFuncLoc.resolve();
          },
          error: function (oError) {
            oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
            oDataModel.fireRequestFailed(oError);
            dfdFuncLoc.reject();
          },
          filters: [new sap.ui.model.Filter("Functlocation", sap.ui.model.FilterOperator.EQ, sValue.substring(0, 30)), new sap.ui.model.Filter(
            "Planplant", sap.ui.model.FilterOperator.EQ, oPlant.Werks)]
        });
        $.when(dfdEquip, dfdFuncLoc).always(function () {
          oBusyDialog.close();
        });
      } else {
        this._bindLists("");
      }
    },
    handleFuncLocItemPress: function (oEvent) {
      var oItem = oEvent.getParameter("listItem"),
        localModel = sap.ui.getCore().getModel(),
        oDataModel = sap.ui.getCore().getModel("oDataModel"),
        oSelectedFuncLoc = localModel.getProperty(oItem.getBindingContextPath()),
        //aNotifications = oDataModel.getProperty("/Notifications"),
        oNewNotification = {};
      this._idStack.push(this._currentId);
      this._bindLists(oSelectedFuncLoc.Functlocation);
      oNewNotification.FunctLoc = oSelectedFuncLoc.Functlocation;
      oNewNotification.PmWkctr = oSelectedFuncLoc.Workcenter;
      var planGroups = localModel.getProperty("/Plangroup").map(function (g) {
        return g.INGRP;
      });
      if (planGroups.includes(oSelectedFuncLoc.Plangroup)) {
        oNewNotification.Plangroup = oSelectedFuncLoc.Plangroup;
      }
      oNewNotification.Planplant = oSelectedFuncLoc.Planplant;
      oNewNotification.NotifLongtextSet = [{}];
      oNewNotification.NotifItemSet = [{}];
      localModel.setProperty("/NewNotification", oNewNotification, localModel, true);
      localModel.setProperty("/MasterTitle", oSelectedFuncLoc.Functlocation + " - " + oSelectedFuncLoc.Descript, localModel, true);
      localModel.setProperty("/showHiddenNotification", true, localModel, true);
      localModel.setProperty("/NotificationHistory", {}, localModel, true);
      var that = this;
      if (!jQuery.device.is.phone) {
        that._router.navTo("notification", {
          from: "master",
          Id: oNewNotification.FunctLoc
        }, true);
      }
    },
    handleFuncLocDeviceNav: function () {
      var localModel = sap.ui.getCore().getModel();
      var oNewNotification = localModel.getProperty("/NewNotification");
      if (this._currentId) {
        this._router.navTo("notification", {
          from: "master",
          Id: oNewNotification.FunctLoc
        }, true);
      } else {
        sap.m.MessageToast.show(this._oBundle.getText("FUNCLOC_NOT_SELECTED"));
      }
    },
    handleEquipListItemPress: function (oEvent, equip) {
      var oItem = oEvent ? oEvent.getParameter("listItem") : null;
      var localModel = sap.ui.getCore().getModel(),
        oSelectedEquipment = oItem ? localModel.getProperty(oItem.getBindingContextPath()) : equip,
        //aNotifications = oDataModel.getProperty("/Notifications"),
        oNewNotification = {};
      oNewNotification.Equipment = oSelectedEquipment.Equipment;
      oNewNotification.FunctLoc = oSelectedEquipment.Functlocation;
      oNewNotification.PmWkctr = oSelectedEquipment.Workcenter;
      var planGroups = localModel.getProperty("/Plangroup").map(function (g) {
        return g.IWERK;
      });
      if (planGroups.includes(oSelectedEquipment.Plangroup)) {
        oNewNotification.Plangroup = oSelectedEquipment.Plangroup;
      }
      oNewNotification.Planplant = oSelectedEquipment.Planplant;
      oNewNotification.NotifLongtextSet = [{}];
      oNewNotification.NotifItemSet = [{}];
      localModel.setProperty('/showHiddenNotification', true, localModel, true);
      localModel.setProperty('/NotificationHistory', {}, localModel, true);
      localModel.setProperty("/NewNotification", oNewNotification, localModel, true);
      this._router.navTo("notification", {
        from: "master",
        Id: oNewNotification.Equipment
      }, true);
    },

    /**************** MASTER LIST EVENTS END *****************/

    handleNavButtonPress: function () {
      if (typeof (this._currentId) !== "undefined" && this._currentId !== null && this._currentId !== "") {
        var oValue = this._idStack.pop();
        if (oValue) {
          this._bindLists(oValue);
        } else {
          this._bindLists("");
        }
      } else {
        this.onNavBack();
      }
    },
    onNavBack: function () {
      var history = sap.ui.core.routing.History.getInstance();
      if (history.aHistory.length > 0) {
        var _currentView = history.aHistory[history.iHistoryPosition];
        this.getView().unbindElement();
        switch (_currentView.split("/")[0]) {
        case "":
        case "Empty":
          if (parent.sap.ushell || sap.ushell) {
            var ushell = sap.ushell || parent.sap.ushell;
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
        default:
          if (!sap.ui.Device.system.phone) {
            if (parent.sap.ushell || sap.ushell) {
              var ushell = parent.sap.ushell || sap.ushell;
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
            this._router.navTo("master", {}, true);
          }
          break;
        }
      } else {
        if (parent.sap.ushell || sap.ushell) {
          var ushell = parent.sap.ushell || sap.ushell;
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

    navHome: function () {
      if (parent.sap.ushell || sap.ushell) {
        var ushell = parent.sap.ushell || sap.ushell;
        this.oCrossAppNav = ushell.Container.getService("CrossApplicationNavigation");
        this.oCrossAppNav.toExternal({
          target: {
            shellHash: "#"
          }
        });
      } else {
        window.history.go(-1);
      }
    },

    matchRule: function (str, rule) {
      return new RegExp("^" + rule.split("*").join(".*") + "$").test(str);
    },

    handleValueHelp: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      var sInputValue = oEvent.getSource().getValue();
      var i18n = sap.ui.getCore().getModel("i18n").getResourceBundle();

      // create value help dialog
      if (!this._valueHelpDialog) {
        this._valueHelpDialog = sap.ui.xmlfragment("valuehelp", "com.blueboot.createnotification.view.ValueHelp", this);
        this._valueHelpDialog.setModel(i18n, "i18n");
        this._valueHelpDialog.setModel(localModel);
        this.getView().addDependent(this._valueHelpDialog);
      }

      //this.inputId = oEvent.getSource().getId();

      var sPath = oEvent.getSource().mBindingInfos.value.binding.sPath;
      var field = sPath && sPath.split("/") ? sPath.split("/")[1] : "";
      if (sPath === "Low" || sPath === "High") {
        field = localModel.getProperty("/IndexField").replace("/", "");
      }
      localModel.setProperty("/IndexFieldsPath", sPath, localModel, true);

      var listDataProperty = "/" + field + "Help";
      var listData = localModel.getProperty(listDataProperty);
      var dfd = $.Deferred();

      if (!listData) {
        dfd = this.getDataForValueHelp(field);
      } else {
        dfd.resolve();
      }

      var that = this;
      var oBusyDialog = new BusyDialog();
      oBusyDialog.open();
      $.when(dfd).then(function () {

        listData = localModel.getProperty(listDataProperty).map(function (x) {
          x.Id = x.Id || x[config.ValueHelp[field].Key];
          x.description = x.description || x[config.ValueHelp[field].Value];
          x.additionalData = x.additionalData || x[config.ValueHelp[field].AdditionalData];
          return x;
        });
        localModel.setProperty("/ValueHelpItems", listData);

        // create a filter for the binding
        var oFilter = new Filter({
        filters: [
          new Filter("Id", sap.ui.model.FilterOperator.Contains, sInputValue),
          new Filter("additionalData", sap.ui.model.FilterOperator.Contains, sInputValue)
        ],
        and: false
      })

        that._valueHelpDialog.getBinding("items").filter([oFilter]);

        // open value help dialog filtered by the input value
        that._valueHelpDialog.open(sInputValue);
      }).always(function () {
        oBusyDialog.close()
      });
    },

    getDataForValueHelp: function (oField) {
      var oDataModel = sap.ui.getCore().getModel("oDataModel");
      var localModel = sap.ui.getCore().getModel();
      var dfd = $.Deferred();

      oDataModel.read(config.ValueHelp[oField].Url, {
        success: function (oData, response) {
          localModel.setProperty("/" + oField + "Help", oData.results);
          dfd.resolve();
        },
        error: function (oError) {
          oError.customMessage = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
          oDataModel.fireRequestFailed(oError);
          dfd.reject();
        }
      });

      return dfd;
    },

    _handleValueHelpSearch: function (evt) {
      var sValue = evt.getParameter("value");
      var oFilter = new Filter({
        filters: [
          new Filter("Id", sap.ui.model.FilterOperator.Contains, sValue),
          new Filter("additionalData", sap.ui.model.FilterOperator.Contains, sValue),
          new Filter("description", sap.ui.model.FilterOperator.Contains, sValue)
        ],
        and: false
      });
      evt.getSource().getBinding("items").filter([oFilter]);
    },
    
    _handleResultsSearch: function (evt) {
      var sValue = evt.getParameter("query");
      var oFilter = new Filter({
        filters: [
          new Filter("Id", sap.ui.model.FilterOperator.Contains, sValue),
          new Filter("additionalData", sap.ui.model.FilterOperator.Contains, sValue),
          new Filter("description", sap.ui.model.FilterOperator.Contains, sValue)
        ],
        and: false
      });
	  evt.getSource().getParent().getContent()[1].getBinding("items").filter([oFilter]);
    },
    /*
    _handleValueHelpSearch: function (evt) {
      var sValue = evt.getParameter("value");
      if (!sValue) {
        return;
      }
      sValue = sValue.toUpperCase();

      var oModel = sap.ui.getCore().getModel("oDataModel");
      var localModel = sap.ui.getCore().getModel();
      var searchText = sValue ? sValue : localModel.getProperty("/searchText");
      var minLength = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("MIN_LENGTH");
      var minLengthError = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("MIN_LENGTH_ERROR").replace("MIN_LENGTH",
        minLength);
      var filterCriteria = localModel.getProperty("/FilterCriteria");
      var that = this;
      if (searchText.length < minLength && filterCriteria !== "WorkCenter") {
        sap.m.MessageBox.alert(minLengthError);
        return;
      }
      var listItems;
      switch (filterCriteria) {
      case "FunctLoc":
        //This should only happen in online mode.
        that._valueHelpDialog.setBusy(true);
        oModel.read("/FuncLocSet", {
          success: function (oData, response) {
            var aActualFuncLocs = oData.results;
            listItems = aActualFuncLocs.map(function (functLoc) {
              functLoc.Id = functLoc.Functlocation;
              functLoc.description = functLoc.Descript;
              return functLoc;
            });
            localModel.setProperty("/searchResults", listItems, localModel, true);
            that._valueHelpDialog.setBusy(false);
          },
          error: function (oError) {
            oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
            oModel.fireRequestFailed(oError);
            that._valueHelpDialog.setBusy(false);
          },
          filters: [new sap.ui.model.Filter("Functlocation", sap.ui.model.FilterOperator.Contains, searchText.toUpperCase())]
        });
        break;
      case "Equipment":
        //This should only happen in online mode.
        that._valueHelpDialog.setBusy(true);
        var filter;
        if (localModel.getProperty("/FilterEquipment") === "EquiTag") {
          filter = new sap.ui.model.Filter("Tidnr", sap.ui.model.FilterOperator.EQ, searchText);
        } else {
          filter = new sap.ui.model.Filter("Equipment", sap.ui.model.FilterOperator.Contains, searchText.toUpperCase());
        }
        oModel.read("/EquipSet", {
          success: function (oData, response) {
            var aActualEquipments = oData.results;
            //localModel.setProperty("/ActualEquipments", aActualEquipments, localModel, true);
            listItems = aActualEquipments.map(function (currentEquipment) {
              currentEquipment.Id = currentEquipment.Equipment;
              currentEquipment.description = currentEquipment.Descript;
              return currentEquipment;
            });
            localModel.setProperty("/searchResults", listItems, localModel, true);
            that._valueHelpDialog.setBusy(false);
          },
          error: function (oError) {
            oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
            oModel.fireRequestFailed(oError);
            that._valueHelpDialog.setBusy(false);
          },
          filters: [filter]
        });
        break;
      default:
        break;
      }
    },*/
    _handleValueHelpClose: function (evt) {
      var oSelectedItem = evt.getParameter("selectedItem");
      if (oSelectedItem) {
        //var input = sap.ui.core.Fragment.byId("searcherFragment", this.inputId.replace("searcherFragment--", ""));
        var localModel = sap.ui.getCore().getModel();
        var sPath = localModel.getProperty("/IndexFieldsPath");
        localModel.setProperty(sPath, oSelectedItem.getTitle());
        //input.setValue(oSelectedItem.getTitle());
      }
      evt.getSource().getBinding("items").filter([]);
    },

    handleFilterAccept: function () {
      var localModel = sap.ui.getCore().getModel();
      var oDataModel = sap.ui.getCore().getModel("oDataModel");
      var filterCriteria = localModel.getProperty("/FilterCriteria");
      var searchText = localModel.getProperty("/searchText").toUpperCase();
      var plants = localModel.getProperty("/PlantSet");
      var aPlantIndex;
      var mParameters = {};
      var that = this;
      this._dialog.setBusy(true);
      switch (filterCriteria) {
      case "WorkCenter":
        //DEPRECATED
        /*
        var oItem = localModel.getProperty(oEvent.getParameter("listItem").getBindingContextPath());
        if (oItem) {
          var plants = localModel.getProperty("/PlantSet");
          var aPlantIndex = plants.findIndex(function (x) {
            return x.Werks === oItem.Id;
          });
          this.setOfflineContext(plants[aPlantIndex]);
          //oEvent.getSource().getParent().close();
        }
        */
        break;
      case "FuncLocSet":
        if (searchText) {
          oDataModel.read("FuncLocSet('" + searchText + "')", {
            success: function (odata) {
              aPlantIndex = plants.findIndex(function (x) {
                return x.Werks === odata.Planplant;
              });
              mParameters.actualPlant = plants[aPlantIndex];
              mParameters.funcLoc = odata.Functlocation;
              that.setOfflineContext(mParameters);
              that._dialog.setBusy(false);
              that.closeDialog();
            },
            error: function (oError) {
              that._dialog.setBusy(false);
              oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
              oDataModel.fireRequestFailed(oError);
            }
          });
        } else {
			sap.m.MessageBox.alert(that._oBundle.getText("SEARCH_MUST_NOT_BE_EMPTY"));
			that._dialog.setBusy(false);
		}
        break;
      case "EquipSet":
        //This should happen only in online mode

        if (searchText) {
          oDataModel.read("EquipSet('" + searchText + "')", {
            success: function (odata) {
              aPlantIndex = plants.findIndex(function (x) {
                return x.Werks === odata.Planplant;
              });
              localModel.setProperty("/ActualPlant", plants[aPlantIndex], localModel, true);
              localModel.setProperty("/Equipments", [odata], localModel, true);
              mParameters.actualPlant = plants[aPlantIndex];
              mParameters.ignoreTree = true;

              $.when(that.bindTreeInfo(mParameters)).then(function () {
                that.handleEquipListItemPress(null, odata);
                that._dialog.setBusy(false);
                that.closeDialog();
              });
              that.closeDialog();
            },
            error: function (oError) {
              that._dialog.setBusy(false);
              oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
              oDataModel.fireRequestFailed(oError);
            }
          });
        }else {
			sap.m.MessageBox.alert(that._oBundle.getText("SEARCH_MUST_NOT_BE_EMPTY"));
			that._dialog.setBusy(false);
		}
        break;
      }

    },

    /******************* VARIANT FUNCTIONS ********************/

    handleVariant: function (oEvent) {
      this.openSearcher();
    },

    openSearcher: function () {

      var searcher = this._getSearcher();
      var localModel = sap.ui.getCore().getModel();
      var filterCriteria = localModel.getProperty("/FilterCriteria");

      var oFragment = sap.ui.xmlfragment("searcherPage", "com.blueboot.createnotification.view." + filterCriteria, this);
      oFragment.setModel(sap.ui.getCore().getModel("i18n"), "i18n");
      oFragment.setModel(sap.ui.getCore().getModel());
      var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
      oNavCon.addPage(oFragment);
      var oConditionsPage = sap.ui.core.Fragment.byId("searcherPage", filterCriteria);
      oNavCon.to(oConditionsPage);

      searcher.open();

      this.getFields();
    },

    _getSearcher: function () {
      if (this._oSearcher) {
        this._oSearcher.destroy();
        this._oSearcher = null;
      }
      this._oSearcher = sap.ui.xmlfragment("searcherFragment", "com.blueboot.createnotification.view.Variant", this);
      this._oSearcher.setModel(sap.ui.getCore().getModel("i18n"), "i18n");
      this._oSearcher.setModel(sap.ui.getCore().getModel());
      this.getView().addDependent(this._oSearcher);

      return this._oSearcher;
    },
    closeSearcher: function () {
      this._getSearcher().close();
    },
    getFields: function () {
      var oDataModel = sap.ui.getCore().getModel("oDataModel");
      var localModel = sap.ui.getCore().getModel();
      var oBusyDialog = new BusyDialog();
      var filterCriteria = localModel.getProperty("/FilterCriteria");
      var report;

      switch (filterCriteria) {
      case "FuncLocSet":
        report = "RIIFLO20";
        break;
      case "EquipSet":
        report = "RIEQUI20";
        break;
      }

      var dfdVariant = $.Deferred();
      oBusyDialog.open();
      oDataModel.read("/VariantSet(Report='" + report + "',VariantName='" + config.DefaultVariantName +
        "')?$expand=VariantObjectsSet,VariantValutabSet", {
          success: function (oData, response) {
            dfdVariant.resolve();
            localModel.setProperty("/Variant", oData);

            oData.VariantObjectsSet.results.forEach(function (object) {
              var field = {
                Name: object.Name,
                Text: object.Text,
                Conditions: [],
                Low: "",
                High: ""
              };
              localModel.setProperty("/" + field.Name, field);
            });
          },
          error: function (oError) {
            oError.customMessage = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
            oDataModel.fireRequestFailed(oError);
            oBusyDialog.close();
          }
        });

      $.when(dfdVariant).then(function () {
        oBusyDialog.close();
      });
    },
    navToConditions: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      var indexField = "/" + oEvent.getSource().getParent().mBindingInfos.label.binding.sPath.split("/")[1];

      localModel.setProperty("/IndexField", indexField);
      localModel.setProperty("/ShowValueHelp", oEvent.getSource().getParent().getFields()[0].getShowValueHelp());

      var conditions = localModel.getProperty(indexField).Conditions;
      var conditionsOriginal = [];

      for (var i in conditions) {
        conditionsOriginal.push(conditions[i]);
      }

      if (!conditionsOriginal.length) {
        localModel.setProperty("/AddVisible", true);
      } else {
        localModel.setProperty("/AddVisible", false);
      }

      localModel.setProperty("/FieldConditionsOriginal", conditionsOriginal);
      localModel.setProperty("/FieldConditions", conditions);
      var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
      var oConditionsPage = sap.ui.core.Fragment.byId("searcherFragment", "conditions");
      oNavCon.to(oConditionsPage);
    },
    addCondition: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      var conditions = localModel.getProperty("/FieldConditions");
      var condition = {
        Low: "",
        High: "",
        Operator: "EQ",
        Add: true
      };

      if (conditions.length) {
        var lastCondition = conditions[conditions.length - 1];
        lastCondition.Add = false;
        conditions[conditions.length - 1] = lastCondition;
      }

      conditions.push(condition);
      localModel.setProperty("/FieldConditions", conditions);
      localModel.setProperty("/AddVisible", false);
    },
    removeCondition: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      var conditions = localModel.getProperty("/FieldConditions");
      var index = oEvent.getSource().getBindingContext().sPath.substr(-1);
      conditions.splice(index, 1);
      if (!conditions.length) {
        localModel.setProperty("/AddVisible", true);
      } else {
        var lastCondition = conditions[conditions.length - 1];
        lastCondition.Add = true;
        conditions[conditions.length - 1] = lastCondition;
      }
      localModel.setProperty("/FieldConditions", conditions);
    },
    approveConditions: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      var indexField = localModel.getProperty("/IndexField");
      var field = localModel.getProperty(indexField);
      var conditions = localModel.getProperty("/FieldConditions");

      field.Conditions = conditions;
      localModel.setProperty(indexField, field);
      var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
      oNavCon.back();
      this.getView().getModel().updateBindings(true);
    },
    cancelConditions: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      var conditionsOriginal = localModel.getProperty("/FieldConditionsOriginal");
      var indexField = localModel.getProperty("/IndexField");
      var field = localModel.getProperty(indexField);
      field.Conditions = conditionsOriginal;
      localModel.setProperty(indexField, field);
      var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
      oNavCon.back();
    },
    cancelSearch: function (oEvent) {
      this.closeSearcher();
    },
    acceptSearch: function (oEvent) {
      var that = this;
      var localModel = sap.ui.getCore().getModel();
      var variant = localModel.getProperty("/Variant");
      var variantValutab = [];
      var fieldsToFilter = this.getTabFields();

      //create ValuTab for POST
      variant.VariantObjectsSet.results.forEach(function (object) {
        var field = localModel.getProperty("/" + object.Name);

        var fieldToFilter = fieldsToFilter.find(function (f) {
          return f.Name === object.Name;
        });

        if (fieldToFilter) {
          if (field.Conditions.length) {
            field.Conditions.forEach(function (condition) {
              var valuTab = {
                Selname: object.Name,
                Kind: "S",
                Sign: "I",
                Option: condition.Operator,
                Low: condition.Low,
                High: condition.High
              };
              variantValutab.push(valuTab);
            });
          } else {
            if (field.Low) {
              var valuTab = {
                Selname: object.Name,
                Kind: "S",
                Sign: "I",
                Option: "EQ",
                Low: field.Low,
                High: ""
              };

              if (field.High) {
                valuTab.High = field.High;
                valuTab.Option = "BT";
              }

              variantValutab.push(valuTab);
            }

          }
        }

        delete object.__metadata;
      });

      //Check if at least one filter was added
      if (!variantValutab.length) {
        sap.m.MessageBox.warning(sap.ui.getCore().getModel("i18n").getResourceBundle().getText("MessageAddFilter"));
        return;
      }

      var variantSet = {
        Report: variant.Report,
        VariantName: variant.VariantName,
        VariantObjectsSet: variant.VariantObjectsSet.results,
        VariantValutabSet: variantValutab
      };

      var busyDialog = new sap.m.BusyDialog();
      var oDataModel = sap.ui.getCore().getModel("oDataModel");
      busyDialog.open();
      oDataModel.create("/VariantSet", variantSet, {
        success: function (oData, response) {
          busyDialog.close();
          that.getVariantValues();
        },
        error: function (oError) {
          busyDialog.close();
        }
      });
    },
    getVariantValues: function () {
      var localModel = sap.ui.getCore().getModel();
      var oDataModel = sap.ui.getCore().getModel("oDataModel");
      var oBusyDialog = new BusyDialog();
      var that = this;
      oBusyDialog.open();
      var navigationEntity = localModel.getProperty("/FilterCriteria")
      var variant = localModel.getProperty("/Variant");
      var queryURL = "/VariantSet(Report='" + encodeURIComponent(variant.Report) + "',VariantName='" + encodeURIComponent(variant.VariantName) +
        "')/" + encodeURIComponent(navigationEntity);
      oDataModel.read(queryURL, {
        success: function (oData, response) {
          var searchResults;
          switch (navigationEntity) {
          case "FuncLocSet":
            searchResults = oData.results.map(function (functLoc) {
              functLoc.Id = functLoc.Functlocation;
              functLoc.description = functLoc.Descript;
              return functLoc;
            });
            break;
          case "EquipSet":
            searchResults = oData.results.map(function (currentEquipment) {
              currentEquipment.Id = currentEquipment.Equipment;
              currentEquipment.description = currentEquipment.Descript;
              return currentEquipment;
            });
            break;
          }
          localModel.setProperty("/searchResults", searchResults);
          var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
          var oConditionsPage = sap.ui.core.Fragment.byId("searcherFragment", "searchResultsPage");
          oNavCon.to(oConditionsPage);
          //that._resizeTableColumns("skusTable");
          oBusyDialog.close();
        },
        error: function (oError) {
          oError.customMessage = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
          oDataModel.fireRequestFailed(oError);
          oBusyDialog.close();
        }
      });
    },
    variantBack: function () {
      var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
      oNavCon.back();
    },
    cleanSearch: function () {
      var localModel = sap.ui.getCore().getModel();
      var fieldsToClean = this.getTabFields();

      fieldsToClean.forEach(function (fieldToClean) {
        var field = localModel.getProperty("/" + fieldToClean.Name);
        field.Low = "";
        field.High = "";
        field.Conditions = [];

        if (fieldToClean.Name === "S_CLINT") {
          localModel.setProperty("/ClassSelected", "");
          localModel.setProperty("/Characteristic", []);
        }

        localModel.setProperty("/" + fieldToClean.Name, field);
      });

      this.getView().getModel().updateBindings(true);
    },

    handleVariantResultSelect: function (oEvent) {
      var localModel = sap.ui.getCore().getModel();
      var searchText = oEvent.getSource().getTitle();
      localModel.setProperty("/searchText", searchText, localModel, true);
      this.closeSearcher();
    },

    getTabFields: function () {
      var localModel = sap.ui.getCore().getModel();
      var filterCriteria = localModel.getProperty("/FilterCriteria");
      var fields = [];
      //TODO: Mover al archivo de configuracion config.
      switch (filterCriteria) {
      case "FuncLocSet":
        fields = [{
          Name: "SWERK"
        }, {
          Name: "BEBER"
        }, {
          Name: "STORT"
        }];
        break;

      case "EquipSet":
        fields = [{
          Name: "TIDNR"
        }, {
          Name: "EQUNR"
        }, {
          Name: "TPLNR"
        }, {
          Name: "STRNO"
        }];
        break;
      }

      return fields;
    }

  });
});