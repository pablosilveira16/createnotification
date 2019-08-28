sap.ui.define([
], function() {
	"use strict";

	return {
		_entities: [
			{
				re: /\/NotifSet\(\'(\d*|-)*\'\)\/NotifPhotoSet/,
				entity: "IMAGE",
				child: true,
				parent: 'NOTIFICATION',
				matcherc: /\d\d*/g,
				matcherp: 'NotifNo',
				attributes: []
			},
			{
				re: /NotifSet/,
				entity: "NOTIFICATION",
				attributes: [
					{sapName: "NotifNo", i18nName: "NOTIFICATION"},
					{sapName: "FunctLoc", i18nName: "FUNC_LOC"},
//					{sapName: "Plangroup", i18nName: "NOTI_GROUP"},
					{sapName: "Planplant", i18nName: "Planplant"},
					{sapName: "Desstdate", i18nName: "NOTI_DES_START_DATE"},
					{sapName: "Dessttime", i18nName: "NOTI_DES_START_TIME"},
					{sapName: "Desenddate", i18nName: "NOTI_DES_END_DATE"},
					{sapName: "Desendtime", i18nName: "NOTI_DES_END_TIME"},
//					{sapName: "NotifItemSet", i18nName: ""},
//					{sapName: "NotifLongtextSet", i18nName: ""},
					{sapName: "NotifType", i18nName: "NOTI_TYPE"},
					{sapName: "PmWkctr", i18nName: "NOTI_WORK_CENTER"},
					{sapName: "Priority", i18nName: "NOTI_PRIORITY"},
					{sapName: "ShortText", i18nName: "NOTI_DESCRIPTION"},
					{sapName: "Strmlfndate", i18nName: "NOTI_START_DATE"},
					{sapName: "Strmlfntime", i18nName: "NOTI_START_TIME"}
//					{sapName: "UserStatus", i18nName: "NOTI_USER_STATUS"}
				],
			},
			{
				re: /NotifItemSet/,
				entity: "NOTIFICATIONITEM",
				attributes: [
					{sapName: 'Number', i18nName:'NUMBER'},
					{sapName: 'DlCodegrp', i18nName:'NOTIFICATION_POSITION_PART'},
					{sapName: 'Descript', i18nName:'NOTIFICATIONS_NOTIFICATIONS_TEXTO'},
					{sapName: 'DCodegrp', i18nName:'NOTIFICATION_POSITION_SYMPTOM'},
					{sapName: 'CauseCodeGRP', i18nName:'NOTIFICATION_POSITION_CAUSE'},
					{sapName: 'CauseText', i18nName:'NOTIFICATION_POSITION_CAUSE_TEXT'},
				],
			},
			{
				re: /OrderOperationSet/,
				entity: "ORDER_CONFIRMATION",
				attributes: [
					{sapName: "ConfNo", i18nName: "CONFIRMATION_NUMBER"},
					{sapName: "PersNo", i18nName: "PERSON_NUMBER"},
					{sapName: "Work", i18nName: "WORK"},
					{sapName: "WorkActual", i18nName: "ACTUAL_WORK"},
					{sapName: "Duration", i18nName: "DURATION"},
					{sapName: "ActualDur", i18nName: "ACTUAL_DURATION"},
				],
			}
		],

		parseOutput: function(output){
			var uri = output.sPath;
			var entity = this._entities.find(function(oEntity){
				return oEntity.re.test(uri)
			});
			var ret = output;
			if (entity && output && output.oData){
				ret.entityName = entity.entity;
				var attributes = [];
				entity.attributes.forEach(function(attr){
					var text = output.oData[attr.sapName]? output.oData[attr.sapName]: "";
					attributes.push({Key: attr.i18nName, Value: text});
				});
				ret.oDataAsArray = attributes;
			}

			return ret;
		},

		isChild: function(){
			return this._entities.find(function(oEntity){
				return oEntity.re.test(uri)
			}).child;		
		},

		appendChild: function(lParents, oChild){
			try {
					//info en outputparser sobre la entidad hija
				var child = this._entities.find(function(oEntity){
						return oEntity.re.test(uri);
					}),
					//busco al padre en lParents
					parent = lParents.find(function(oParent){
						return oParent.entityName === child.parent && 
							oChild.sPath.match(child.matcherc)[0] === oParent[child.matcherp];
					}),
					row = parent.oDataAsArray.find(function(prop){
						return prop.Key === "IMAGES"
					});
				if (!row){
					row = {Key: "IMAGES", Value: "1"};
					parent.oDataAsArray.push(row);
				}else{
					row.Value = (parseInt(row.Value) + 1) + "";
				}
				
			}catch (exception){
				
			}
		}
	};
});