sap.ui.define([], function () {
	"use strict";

	return {

		name: "ZBBCONTEXTDATABASE",

		open: function () {
			var db, dfd = $.Deferred(),
				request = indexedDB.open(this.name);
			request.onerror = function (event) {
				dfd.reject(event);
			};

			request.onsuccess = function (event) {
				db = request.result;
				dfd.resolve(db);
			};

			request.onupgradeneeded = function (event) {
				var db = event.target.result;
				var objectStore = db.createObjectStore("sessions", {
					autoIncrement: true
				});
				objectStore.transaction.oncomplete = function (event) {
					dfd.resolve(db);
				};
			};

			return dfd;
		},

		save: function (table, data) {
			var dfd = $.Deferred();
			$.when(this.open()).then(function (db) {
				var customerObjectStore = db.transaction(table, "readwrite").objectStore(table);
				//Solo quiero guardar una sesion
				customerObjectStore.clear();
				customerObjectStore.add(data);
				dfd.resolve();
			});
			return dfd;
		},

		readAll: function (table) {
			var dfd = $.Deferred();
			$.when(this.open()).then(function (db) {
				var customerObjectStore = db.transaction(table, "readwrite").objectStore(table);
				customerObjectStore.getAll().onsuccess = function (data) {
					dfd.resolve(data.target.result);
				};
			});
			return dfd;
		}
	};
});