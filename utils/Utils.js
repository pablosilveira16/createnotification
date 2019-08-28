sap.ui.define([
	"sap/ui/model/json/JSONModel"
], function (JSONModel) {
	"use strict";

	return {
		polyfill: function () {
			if (!Array.prototype.map) {

				Array.prototype.map = function (callback, thisArg) {

					var T, A, k;

					if (this == null) {
						throw new TypeError(' this is null or not defined');
					}

					// 1. Let O be the result of calling ToObject passing the |this| 
					//    value as the argument.
					var O = Object(this);

					// 2. Let lenValue be the result of calling the Get internal 
					//    method of O with the argument "length".
					// 3. Let len be ToUint32(lenValue).
					var len = O.length >>> 0;

					// 4. If IsCallable(callback) is false, throw a TypeError exception.
					// See: http://es5.github.com/#x9.11
					if (typeof callback !== 'function') {
						throw new TypeError(callback + ' is not a function');
					}

					// 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
					if (arguments.length > 1) {
						T = thisArg;
					}

					// 6. Let A be a new array created as if by the expression new Array(len) 
					//    where Array is the standard built-in constructor with that name and 
					//    len is the value of len.
					A = new Array(len);

					// 7. Let k be 0
					k = 0;

					// 8. Repeat, while k < len
					while (k < len) {

						var kValue, mappedValue;

						// a. Let Pk be ToString(k).
						//   This is implicit for LHS operands of the in operator
						// b. Let kPresent be the result of calling the HasProperty internal 
						//    method of O with argument Pk.
						//   This step can be combined with c
						// c. If kPresent is true, then
						if (k in O) {

							// i. Let kValue be the result of calling the Get internal 
							//    method of O with argument Pk.
							kValue = O[k];

							// ii. Let mappedValue be the result of calling the Call internal 
							//     method of callback with T as the this value and argument 
							//     list containing kValue, k, and O.
							mappedValue = callback.call(T, kValue, k, O);

							// iii. Call the DefineOwnProperty internal method of A with arguments
							// Pk, Property Descriptor
							// { Value: mappedValue,
							//   Writable: true,
							//   Enumerable: true,
							//   Configurable: true },
							// and false.

							// In browsers that support Object.defineProperty, use the following:
							// Object.defineProperty(A, k, {
							//   value: mappedValue,
							//   writable: true,
							//   enumerable: true,
							//   configurable: true
							// });

							// For best browser support, use the following:
							A[k] = mappedValue;
						}
						// d. Increase k by 1.
						k++;
					}

					// 9. return A
					return A;
				};
			}
			if (!Array.from) {
				Array.from = (function () {
					var toStr = Object.prototype.toString;
					var isCallable = function (fn) {
						return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
					};
					var toInteger = function (value) {
						var number = Number(value);
						if (isNaN(number)) {
							return 0;
						}
						if (number === 0 || !isFinite(number)) {
							return number;
						}
						return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
					};
					var maxSafeInteger = Math.pow(2, 53) - 1;
					var toLength = function (value) {
						var len = toInteger(value);
						return Math.min(Math.max(len, 0), maxSafeInteger);
					};

					// La propiedad length del método from es 1.
					return function from(arrayLike /*, mapFn, thisArg */ ) {
						// 1. Deje a C ser el este valor.
						var C = this;

						// 2. Deje que los elementos sean ToObject(arrayLike).
						var items = Object(arrayLike);

						// 3. Retornar IfAbrupt(items).
						if (arrayLike == null) {
							throw new TypeError("Array.from requiere un objeto array-like - not null or undefined");
						}

						// 4. Si mapfn no está definida, entonces deja que sea false.
						var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
						var T;
						if (typeof mapFn !== 'undefined') {
							// 5. si no
							// 5. a If IsCallable(mapfn) es false, lanza una excepción TypeError.
							if (!isCallable(mapFn)) {
								throw new TypeError('Array.from: si hay mapFn, el segundo argumento debe ser una función');
							}

							// 5. b. Si thisArg se suministró, deje que T sea thisArg; si no, deje que T esté indefinido.
							if (arguments.length > 2) {
								T = arguments[2];
							}
						}

						// 10. Let lenValue be Get(items, "length").
						// 11. Let len be ToLength(lenValue).
						var len = toLength(items.length);

						// 13. If IsConstructor(C) is true, then
						// 13. a. Let A be the result of calling the [[Construct]] internal method of C with an argument list containing the single item len.
						// 14. a. Else, Let A be ArrayCreate(len).
						var A = isCallable(C) ? Object(new C(len)) : new Array(len);

						// 16. Let k be 0.
						var k = 0;
						// 17. Repeat, while k < len… (also steps a - h)
						var kValue;
						while (k < len) {
							kValue = items[k];
							if (mapFn) {
								A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
							} else {
								A[k] = kValue;
							}
							k += 1;
						}
						// 18. Let putStatus be Put(A, "length", len, true).
						A.length = len;
						// 20. Return A.
						return A;
					};
				}());
			}
			if (!String.prototype.includes) {
				String.prototype.includes = function (search, start) {
					'use strict';
					if (typeof start !== 'number') {
						start = 0;
					}

					if (start + search.length > this.length) {
						return false;
					} else {
						return this.indexOf(search, start) !== -1;
					}
				};
			}
			if (!Array.prototype.includes) {
				Object.defineProperty(Array.prototype, 'includes', {
					value: function (searchElement, fromIndex) {

						if (this == null) {
							throw new TypeError('"this" es null o no está definido');
						}

						// 1. Dejar que O sea ? ToObject(this value).
						var o = Object(this);

						// 2. Dejar que len sea ? ToLength(? Get(O, "length")).
						var len = o.length >>> 0;

						// 3. Si len es 0, devuelve false.
						if (len === 0) {
							return false;
						}

						// 4. Dejar que n sea ? ToInteger(fromIndex).
						//    (Si fromIndex no está definido, este paso produce el valor 0.)
						var n = fromIndex | 0;

						// 5. Si n ≥ 0, entonces
						//  a. Dejar que k sea n.
						// 6. Else n < 0,
						//  a. Dejar que k sea len + n.
						//  b. Si k < 0, Dejar que k sea 0.
						var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

						function sameValueZero(x, y) {
							return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
						}

						// 7. Repite, mientras k < len
						while (k < len) {
							// a. Dejar que elementK sea el resultado de ? Get(O, ! ToString(k)).
							// b. Si SameValueZero(searchElement, elementK) es true, devuelve true.
							if (sameValueZero(o[k], searchElement)) {
								return true;
							}
							// c. Incrementa k por 1.
							k++;
						}

						// 8. Devuelve false
						return false;
					}
				});
			}
			if (!Array.prototype.findIndex) {
				Object.defineProperty(Array.prototype, 'findIndex', {
					value: function (predicate) {
						// 1. Let O be ? ToObject(this value).
						if (this == null) {
							throw new TypeError('"this" is null or not defined');
						}

						var o = Object(this);

						// 2. Let len be ? ToLength(? Get(O, "length")).
						var len = o.length >>> 0;

						// 3. If IsCallable(predicate) is false, throw a TypeError exception.
						if (typeof predicate !== 'function') {
							throw new TypeError('predicate must be a function');
						}

						// 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
						var thisArg = arguments[1];

						// 5. Let k be 0.
						var k = 0;

						// 6. Repeat, while k < len
						while (k < len) {
							// a. Let Pk be ! ToString(k).
							// b. Let kValue be ? Get(O, Pk).
							// c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
							// d. If testResult is true, return k.
							var kValue = o[k];
							if (predicate.call(thisArg, kValue, k, o)) {
								return k;
							}
							// e. Increase k by 1.
							k++;
						}

						// 7. Return -1.
						return -1;
					},
					configurable: true,
					writable: true
				});
			}
			if (!Array.prototype.find) {
				Object.defineProperty(Array.prototype, 'find', {
					value: function (predicate) {
						// 1. Let O be ? ToObject(this value).
						if (this == null) {
							throw new TypeError('"this" is null or not defined');
						}

						var o = Object(this);

						// 2. Let len be ? ToLength(? Get(O, "length")).
						var len = o.length >>> 0;

						// 3. If IsCallable(predicate) is false, throw a TypeError exception.
						if (typeof predicate !== 'function') {
							throw new TypeError('predicate must be a function');
						}

						// 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
						var thisArg = arguments[1];

						// 5. Let k be 0.
						var k = 0;

						// 6. Repeat, while k < len
						while (k < len) {
							// a. Let Pk be ! ToString(k).
							// b. Let kValue be ? Get(O, Pk).
							// c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
							// d. If testResult is true, return kValue.
							var kValue = o[k];
							if (predicate.call(thisArg, kValue, k, o)) {
								return kValue;
							}
							// e. Increase k by 1.
							k++;
						}

						// 7. Return undefined.
						return undefined;
					},
					configurable: true,
					writable: true
				});
			}
			var Event, getAll, IDBIndex, IDBObjectStore, IDBRequest;

			IDBObjectStore = window.IDBObjectStore || window.webkitIDBObjectStore || window.mozIDBObjectStore || window.msIDBObjectStore;
			IDBIndex = window.IDBIndex || window.webkitIDBIndex || window.mozIDBIndex || window.msIDBIndex;

			if (typeof IDBObjectStore.prototype.getAll !== "undefined" && typeof IDBIndex.prototype.getAll !== "undefined") {
				return;
			}

			// https://github.com/axemclion/IndexedDBShim/blob/gh-pages/src/IDBRequest.js
			IDBRequest = function () {
				this.onsuccess = null;
				this.readyState = "pending";
			};
			// https://github.com/axemclion/IndexedDBShim/blob/gh-pages/src/Event.js
			Event = function (type, debug) {
				return {
					"type": type,
					debug: debug,
					bubbles: false,
					cancelable: false,
					eventPhase: 0,
					timeStamp: new Date()
				};
			};

			getAll = function (key) {
				var request, result;

				key = typeof key !== "undefined" ? key : null;

				request = new IDBRequest();
				result = [];

				// this is either an IDBObjectStore or an IDBIndex, depending on the context.
				this.openCursor(key).onsuccess = function (event) {
					var cursor, e, target;

					cursor = event.target.result;
					if (cursor) {
						result.push(cursor.value);
						cursor.continue();
					} else {
						if (typeof request.onsuccess === "function") {
							e = new Event("success");
							e.target = {
								readyState: "done",
								result: result
							};
							request.onsuccess(e);
						}
					}
				};

				return request;
			};

			if (typeof IDBObjectStore.prototype.getAll === "undefined") {
				IDBObjectStore.prototype.getAll = getAll;
			}
			if (typeof IDBIndex.prototype.getAll === "undefined") {
				IDBIndex.prototype.getAll = getAll;
			}
		},
		getParameterByName: function (name, url) {
			if (!url) {
				url = window.location.href;
			}
			name = name.replace(/[\[\]]/g, "\\$&");
			var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
				results = regex.exec(url);
			if (!results) {
				return null;
			}
			if (!results[2]) {
				return '';
			}
			return decodeURIComponent(results[2].replace(/\+/g, " "));
		},

		getCookie: function (cookiename) {
			// Get name followed by anything except a semicolon
			var cookiestring = RegExp("" + cookiename + "[^;]+").exec(document.cookie);
			// Return everything after the equal sign, or an empty string if the cookie name not found
			var test = !!cookiestring;
			return unescape(test ? cookiestring.toString().replace(/^[^=]+./, "") : "");
		},

		setLanguage: function () {
			var language = this.getParameterByName("sap-language");
			if (!language) {
				var userContext = this.getCookie("sap-usercontext");
				var saplang = RegExp(/sap-language=([^&]+)/).exec(userContext);
				if (saplang) {
					language = saplang[1];
				} else {
					// No encontre configuración de lenguaje, uso el pro defecto.
					language = sap.ui.getCore().getConfiguration().getLanguage();
				}
			}

			sap.ui.getCore().getConfiguration().setLanguage(language);
		},
		
		createFilterString: function(x) {
			return x.Field + " eq '" + x.Value + "'";
		},

		parseError: function (oEvent) {
			var responseText, statusCode, statusText, msg, msgTitle, customMessage;
			var i18n = sap.ui.getCore().getModel("i18n").getResourceBundle();
			if (oEvent.response) {
				//No vino con mParameters, lo agrego.
				oEvent.mParameters = {};
				oEvent.mParameters.response = oEvent.response;
			}

			customMessage = i18n.getText(oEvent.mParameters.customMessage) ? i18n.getText(oEvent.mParameters.customMessage) : oEvent.mParameters.customMessage;
			try {
				if (oEvent.mParameters.response) {
					responseText = JSON.parse(oEvent.mParameters.response.body);
					statusCode = oEvent.mParameters.response.statusCode;
					statusText = oEvent.mParameters.response.statusText;
				} else {
					if (oEvent.mParameters.responseText) {
						responseText = JSON.parse(oEvent.mParameters.responseText);
						statusCode = oEvent.mParameters.statusCode;
						statusText = oEvent.mParameters.statusText;
					}
				}

				msgTitle = i18n.getText("ODataErrorTitle");
				var match;
				console.log("StatusCode: " + statusCode + " - " + statusText);
				switch (statusCode) {
				case 400:
					// Bad Request
					if (customMessage) {
						msg = customMessage;
					} else {
						switch (responseText.error.code) {
						case "SY/530":
							match = /\((.*)\)/.exec(responseText.error.message.value);
							if (typeof (match) !== "undefined" && match != null && match != "") {
								msg = match[1];
							} else {
								msg = responseText.error.message.value;
							}
							break;
						default:
							match = /\((.*)\)/.exec(responseText.error.message.value);
							if (typeof (match) !== "undefined" && match != null && match != "") {
								msg = match[1];
							} else {
								msg = responseText.error.message.value;
							}
							break;
						}
					}

					break;
				case 401:
					// Unauthorized
					msg = i18n.getText("Unauthorized");
					break;
				case 403:
					// Forbidden
					msg = i18n.getText("Forbidden");
					break;
				case 408:
					// Request Timeout
					msg = i18n.getText("Timeout");
					break;
				case 500:
					// Internal Server Error
					switch (responseText.error.code) {
					case "/IWFND/CM_BEC/026":
						if (responseText.error.message && responseText.error.message.value) {
							msg = i18n.getText("ErrorRFCWithMessage", [responseText.error.message.value]);
						} else {
							msg = i18n.getText("ErrorRFC");
						}
						break;
					default:
						match = /\((.*)\)/.exec(responseText.error.message.value);
						if (typeof (match) !== "undefined" && match != null && match != "") {
							msg = i18n.getText("InternalError", [match[1]]);
						} else {
							msg = i18n.getText("InternalError", [responseText.error.message.value]);
						}
						break;
					}
					break;
				case 501:
					// Not Implemented
					msg = i18n.getText("NotImplemented");
					break;
				default:
					msg = customMessage ? customMessage : i18n.getText("ODataGenericError", [responseText.error.message.value]);
					break;

				}

				var errorDetailsArray = [];
				if (responseText && responseText.error && responseText.error.innererror && responseText.error.innererror.errordetails) {

					var array = responseText.error.innererror.errordetails;
					for (var i = 0; i < array.length; i++) {
						errorDetailsArray.push(array[i].message);
					}
				}

				if (responseText && responseText.error && responseText.error.message && responseText.error.message.value) {
					match = /\((.*)\)/.exec(responseText.error.message.value);
					if (typeof (match) !== "undefined" && match != null && match != "") {
						errorDetailsArray.push(match[1]);
					} else {
						errorDetailsArray.push(responseText.error.message.value);
					}
				}

				if (oEvent.mParameters.details) {
					var array = oEvent.mParameters.details;
					for (var i = 0; i < array.length; i++) {
						errorDetailsArray.push(array[i]);
					}
				}
				errorDetailsArray = Array.from(new Set(errorDetailsArray));

				if (msg || errorDetailsArray.length) {
					var details = errorDetailsArray.length > 0 ? "<p><strong>" + i18n.getText("details") + "</strong></p>\n<ul><li>" +
						errorDetailsArray.join("</li><li>") + "</li></ul>" : "";
					sap.m.MessageBox.error(msg, {
						title: msgTitle,
						details: details
					});
				}
			} catch (err) {
				//Not json.
			}
		}
	};

});