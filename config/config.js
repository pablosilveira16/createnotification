sap.ui.define([
  "sap/ui/model/json/JSONModel"
], function (JSONModel) {
  "use strict";

  return {
    //Filtros utilizados para la busqueda de tipos de notificacion
    NotificationTypeSet: [{
      "Table": "TQ80",
      "Field": "QMTYP",
      "Value": "01"
    }, {
      "Table": "TQ80",
      "Field": "TCODE",
      "Value": "IW21"
    }],
    //Endpoints definidos para los campos de los ValueHelp
    ValueHelp: {
      "BEBER": {
        "Url": "/PlantSectionSet",
        "Key": "Beber",
        "Value": "Fing",
        "AdditionalData": "Werks"
      },
      "STORT": {
        "Url": "LocationSet",
        "Key": "Stand",
        "Value": "Ktext",
        "AdditionalData": "Werks"
      },
      "SWERK": {
        "Url": "/PlantSet",
        "Key": "Werks",
        "Value": "Name1",
        "AdditionalData": ""
      },
      "TIDNR": {
        "Url": "",
        "Key": "",
        "Value": "",
        "AdditionalData": ""
      },
      "TPLNR": {
        "Url": "",
        "Key": "",
        "Value": "",
        "AdditionalData": ""
      },
      "STRNO": {
        "Url": "",
        "Key": "",
        "Value": "",
        "AdditionalData": ""
      },
      "EQUNR": {
        "Url": "",
        "Key": "",
        "Value": "",
        "AdditionalData": ""
      }
    },
    //Valor de Variante para obtener reporte dinamicamente
    DefaultVariantName: "TEMPLATE"
  };

});