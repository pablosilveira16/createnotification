sap.ui.define(["sap/ui/core/format/DateFormat"], function(DateFormat) {
	"use strict";

	return {
		/**
		 * Rounds the currency value to 2 digits
		 *
		 * @public
		 * @param {string} sValue value to be formatted
		 * @returns {string} formatted currency value with 2 digits
		 */
		parseMetadata: function(oData, sPath) {
			var path = sPath;
			if (oData.__metadata) {
				path = new URL(oData.__metadata.uri).href.split(sap.ui.getCore().getModel("oDataModel").sServiceUrl)[1];
			};
			return path;
		},

		formatAttachmentIcon: function(m) {
			return sap.ui.core.IconPool.getIconForMimeType(m);
		},
		
		parseNumber: function(number) {
			var numb = Number(number);
			if (isNaN(numb)) { //Si no es parseable lo devuelvo como esta
				numb = parseFloat(number);
				if (isNaN(numb)) {
					return number;
				} else {
					return numb;
				}
			} else {
				return numb;
			}
		},

		parseNotif: function(number) {
			if(number === "") {
				return number;
			}
			var numb = Number(number);
			if (isNaN(numb)) { //Si no es parseable lo devuelvo como esta
				numb = parseFloat(number);
				if (isNaN(numb)) {
					return number;
				} else {
					return numb;
				}
			} else {
				return numb;
			}
		},

		dateToFormat: function(format, d) {
			d = d || new Date();
			var yyyy = d.getFullYear(),
				MM = ('0' + (d.getMonth() + 1)).slice(-2),
				dd = ('0' + d.getDate()).slice(-2);
			switch (format) {
				case 'yyyyMMdd':
					return yyyy + MM + dd;
				case 'dd/MM/yyyy':
					return dd + "/" + MM + "/" + yyyy;
				case 'dd.MM.yyyy':
					return dd + "." + MM + "." + yyyy;
				default:
					return dd + "/" + MM + "/" + yyyy;
			}
		},

		dateFromFormat: function(d, format) {
			switch (format) {
				case 'yyyyMMdd':
					return new Date(d.substr(0, 4), d.substr(4, 2) - 1, d.substr(6, 2));
				case 'yyyy-MM-dd':
					return new Date(d.substr(0, 4), d.substr(5, 2) - 1, d.substr(8, 2));
				default:
					return new Date(d.substr(0, 4), d.substr(4, 2) - 1, d.substr(6, 2));
			}
		},

		dateFormatToFormat: function(d, from, to) {
			return this.dateToFormat(to, this.dateFromFormat(d, from));
		},
		
		horaEnMs: function(ms) {
			var timeFormat = DateFormat.getTimeInstance({pattern: "KK:mm a"}),
				// Transformo offset de horas a milisegundos
				TZOffsetMs = new Date(0).getTimezoneOffset()*60*1000;

			return timeFormat.format(new Date(ms + TZOffsetMs));
		},

		leadingZeros: function(number) {
			var numb = parseInt(number, 10);
			if (isNaN(numb)) //Si no es parseable lo devuelvo como esta
				return number;
			else
				return parseInt(number, 10);
		},

		operationDescription: function(activity, subactivity) {
			if (subactivity) {
				return activity + " - " + subactivity;
			} else {
				return activity;
			}
		},
		
		formatWorkCenter: function(oValue) {
			if (oValue && oValue != 0) {
				var workCenters = sap.ui.getCore().getModel().getProperty("/WorkCenter");
				var workCenter = workCenters.filter(function(x) {
					return x.Objid === oValue;
				});
				return workCenter[0].Arbpl;
			}
		},
		
		handleUntranslated: function(txt){
			if (!txt){
				txt = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("NoTranslation");
			}
			return txt;
		},

		i18n: function(name) {
			var value = null;
			try{
				value = sap.ui.getCore().getModel("i18n").getResourceBundle().getText(name);
				if (!value){
					throw 0;
				}
			}catch (Exception){
				value = name;
			}
			return value;
		}
	};

});