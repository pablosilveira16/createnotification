sap.ui.define([
    "sap/ui/model/odata/ODataModel",
    "com/blueboot/createnotification/utils/OutputParser"
], function (ODataModel, OutputParser) {
    "use strict";

    var oDataModel = ODataModel.extend("com.blueboot.hybrid.odata.model.HybridODataModel", {
        constructor: function(sServiceUrl, bJSON, sUser, sPassword, mHeaders, bTokenHandling, bWithCredentials, bLoadMetadataAsync) {
            ODataModel.apply(this,arguments);
        },
        dfdMetadata: $.Deferred()
    });

    var create = oDataModel.prototype.create;
    oDataModel.prototype.create = function (sPath, oData, mParameters) {
        if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1 && sap.OData.httpClientApplied) {
            try {
                var localModel = sap.ui.getCore().getModel();
                var pendingItems = localModel.getProperty("/pendingItems") ? localModel.getProperty("/pendingItems") : [];
                var pendingItemsCount = localModel.getProperty("/pendingItemsCount") ? localModel.getProperty("/pendingItemsCount") : 0;

                var match = sPath.match(/\('(id-.*)?'\)/);
                if (match && match[1]) {
                    //No deberian existir nietos
                    var parent = pendingItems.filter(function(x) { return x.uid === match[1]; });
                    if (parent.length > 0 ) {
                        parent[0].children.push(pendingItems.length);
                    }
                }

                var uid = jQuery.sap.uid();
                pendingItems.push({
                    "uid": uid,
                    "sPath": sPath,
                    "oData": oData,
                    "mParameters": mParameters,
                    "children": [],
                    "method": "create"
                });
                pendingItemsCount++;

                localModel.setProperty("/pendingItems", pendingItems);
                localModel.setProperty("/pendingItemsCount", pendingItemsCount);

                if (mParameters.success) {
                    var response = $.extend(true, {}, oData);
                    var path = sPath.startsWith("/") ? sPath : "/" + sPath;
                    var uri = this.sServiceUrl + path + "('" + uid + "')";
                    response.__metadata = { "uri": uri };
                    mParameters.success(response);
                }
            } catch (err) {
                if(mParameters.error) {
                    mParameters.error(err);
                } else {
                    console.log(err);
                    throw err;
                }
            }
        } else {
            create.apply(this, arguments);
        }
    };

    var read = oDataModel.prototype.read;
    oDataModel.prototype.read = function (sPath, mParameters) {
        if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1 && sap.OData.httpClientApplied) {
            var localModel = sap.ui.getCore().getModel();
            var pendingItems = localModel.getProperty("/pendingItems") ? localModel.getProperty("/pendingItems") : [];
            
            try {
                var match = sPath.match(/\('(id-.*)?'\)/);
                if (match && match[1]) {
                    var result = pendingItems.filter(function(x) { return x.uid === match[1]; });
                    if (result.length > 0 ) {
                        if (mParameters.success) {
                            mParameters.success(result[0]);
                        }
                    } else {
                        throw "Pending not found";
                    }
                } else {
                    throw "Invalid Key or no key";
                }
            } catch(err) {
                //Intento un read al store
                console.log(err);
                read.apply(this, arguments);
            }
        } else {
            read.apply(this, arguments);
        }
    };


    var update = oDataModel.prototype.update;
    oDataModel.prototype.update = function (sPath, oData, mParameters) {
        if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1 && sap.OData.httpClientApplied) {
            try {
                var localModel = sap.ui.getCore().getModel();
                var pendingItems = localModel.getProperty("/pendingItems") ? localModel.getProperty("/pendingItems") : [];
                var pendingItemsCount = localModel.getProperty("/pendingItemsCount") ? localModel.getProperty("/pendingItemsCount") : 0;

                var match = sPath.match(/\('(id-.*)?'\)/);
                if (match && match[1]) {
                    //No deberian existir nietos
                    var parent = pendingItems.filter(function(x) { return x.uid === match[1]; });
                    if (parent.length > 0 ) {
                        parent[0].children.push(pendingItems.length);
                    }
                }

                var uid = jQuery.sap.uid();
                pendingItems.push({
                    "uid": uid,
                    "sPath": sPath,
                    "oData": oData,
                    "mParameters": mParameters,
                    "children": [],
                    "method": "update"
                });
                pendingItemsCount++;

                localModel.setProperty("/pendingItems", pendingItems);
                localModel.setProperty("/pendingItemsCount", pendingItemsCount);

                if (mParameters.success) {
                    var response = $.extend(true, {}, oData);
                    var path = sPath.startsWith("/") ? sPath : "/" + sPath;
                    var uri = this.sServiceUrl + path + "('" + uid + "')";
                    response.__metadata = { "uri": uri };
                    mParameters.success(response);
                }
            } catch (err) {
                if(mParameters.error) {
                    mParameters.error(err);
                } else {
                    console.log(err);
                    throw err;
                }
            }
        } else {
            update.apply(this, arguments);
        }
    };

    oDataModel.prototype.flush = function() {
        var dfd = $.Deferred();
        var localModel = sap.ui.getCore().getModel();
        var pendingItemsCount = localModel.getProperty("/pendingItemsCount");
        var result = { success: [], error: [] };
        var that = this;
        if (pendingItemsCount) {
            var pendingItems = localModel.getProperty("/pendingItems");
            var parents = pendingItems.filter(function(x) { return x.children.length > 0; });
            var dfdParents = $.Deferred();
            //Proceso aquellos items que tienen hijos primero
            if (parents.length > 0) {
                var pendingParents = parents.length;
                for (var i in parents) {
                    var request = parents[i];
                    //Hago override del sucess y error con el que se guardaron
                    request.mParameters.success = $.proxy(function(request, odata, response) {
                        var match = new URL(odata.__metadata.uri).href.split(that.sServiceUrl)[1].match(/\((.*)?\)/);
                        
                        for (var i in request.children) {
                            pendingItems[request.children[i]].sPath = pendingItems[request.children[i]].sPath.replace("'" + request.uid + "'", match[1]);
                        }
                        request.oData = odata;
                        result.success.push(OutputParser.parseOutput(request));
                        pendingParents--;
                        if (pendingParents === 0) {
                            dfdParents.resolve();
                        }
                        pendingItemsCount--;
                        if (pendingItemsCount === 0) {
                            localModel.setProperty("/pendingItems", [], localModel, true);
                            localModel.setProperty("/pendingItemsCount", 0, localModel, true);
                            localModel.setProperty("/synchOutput", result);
                            dfd.resolve();
                        }
                    }, this, request);
                    request.mParameters.error = $.proxy(function(request, err) {
                        request.error = err;
                        result.error.push(request);
                        //Si el elemento padre da error agrego sus hijos con error también.
                        for (var i in request.children) {
                            pendingItems[request.children[i]].error = err;
                            result.error.push(pendingItems[request.children[i]]);
                            delete pendingItems[request.children[i]];
                            pendingItemsCount--;
                        }

                        pendingParents--;
                        if (pendingParents === 0) {
                            dfdParents.resolve();
                        }
                        pendingItemsCount--;
                        if (pendingItemsCount === 0) {
                            localModel.setProperty("/pendingItems", [], localModel, true);
                            localModel.setProperty("/pendingItemsCount", 0, localModel, true);
                            localModel.setProperty("/synchOutput", result);
                            dfd.resolve();
                        }
                    }, this, request);
                    this[request.method].apply(this, [request.sPath, request.oData, request.mParameters]);
                }
            } else {
                dfdParents.resolve();
            }

            var that = this;
            //Proceso aquellos items que dependian de algun padre
            var children = pendingItems.filter(function(x) { return x.children.length === 0; });
            $.when(dfdParents).then(function() {
                for (var i in children) {
                    var request = children[i];
                    //Hago override del sucess y error con el que se guardaron
                    request.mParameters.success = $.proxy(function(request, odata, response) {
                        //var match = new URL(odata.__metadata.uri).href.split(that.sServiceUrl)[1].match(/\((.*)?\)/);
                        //request.oData = odata;
                        result.success.push(OutputParser.parseOutput(request));
                        pendingItemsCount--;
                        if (pendingItemsCount === 0) {
                            localModel.setProperty("/pendingItems", [], localModel, true);
                            localModel.setProperty("/pendingItemsCount", 0, localModel, true);
                            localModel.setProperty("/synchOutput", result);
                            dfd.resolve();
                        }
                    }, that, request);
                    request.mParameters.error = $.proxy(function(request, err) {
                        request.error = err;
                        result.error.push(request);
                        pendingItemsCount--;
                        if (pendingItemsCount === 0) {
                            localModel.setProperty("/pendingItems", [], localModel, true);
                            localModel.setProperty("/pendingItemsCount", 0, localModel, true);
                            localModel.setProperty("/synchOutput", result);
                            dfd.resolve();
                        }
                    }, that, request);
                    that[request.method].apply(that, [request.sPath, request.oData, request.mParameters]);
                }
            })
            
        }else{
            dfd.resolve();
        }

        return dfd;
    };

    return oDataModel;
});