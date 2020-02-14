/**
 * Copyright 2019 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    var settings = RED.settings;
    const fs = require('fs');
    const path = require('path');

    function HTML(config) {
        // The configuration is a Javascript object, which needs to be converted to a JSON string
        var configAsJson = JSON.stringify(config);  
        
        var html = String.raw`
            <div id='div_geo_` + config.id + `' style='width:100%; height:100%;' ng-init='init(` + configAsJson + `)'>
            </div>`;  

        return html;
    };

    var ui = undefined;
    
    function WebPushClientNode(config) {
        var node = this;

        debugger;
        console.log("************************ we zijn er ***********************");
        console.log(node.listeners("input"));
        
        node.removeAllListeners(["input"]);
        node.on("input", function(msg) {
            console.log("************************ Jip ***********************");
        });
        
        if(ui === undefined) {
            ui = RED.require("node-red-dashboard")(RED);
        }
        
        RED.nodes.createNode(this, config);
        
        // Make the public Vapid key available for the http endpoint
        this.getVapidPublicKey = function () {     
            // Retrieve the config node, where the VAPID keys are configured
            var webPushConfig = RED.nodes.getNode(config.webPushConfig);
        
            // Use the new keys in the credentials, unless we are dealing with an old node (without credentials)
            return webPushConfig.getKeys().publicKey;
        }
        
        var html = HTML(config);
        
        var done = ui.addWidget({
            node: node,
            group: config.group,
            width: config.width,
            height: config.height,
            format: html,
            templateScope: "local",
            emitOnlyNewValues: false,
            forwardInputMessages: false,
            storeFrontEndInputAsState: false,
            convertBack: function (value) {
                return value;
            },
            beforeEmit: function(msg, value) {   
                return { msg: msg };
            },
            beforeSend: function (msg, orig) {
                if (orig) {
                    return orig.msg;
                }
            },
            initController: function($scope, events) {
                $scope.flag = true;

                $scope.init = function (config) {
                    $scope.config = config;
                    
                    debugger;
                    
                    if (!('serviceWorker' in navigator)) {
                        console.log('Service workers are NOT supported by this browser!');
                        return;
                    }
                    else {
                        console.log('Service workers are supported by this browser.');
                    }
                    
                    if (!('Notification.requestPermission in navigator')) {
                        // This feature is available only in secure contexts (HTTPS) !!!!!!!!!!!!!!!!
                        // This feature is not available with self signed certificates !!!!!!!!!!!!!!!!
                        console.log('The notification api is NOT supported by this browser!  Make sure you use https and no self-signed certificates!');
                        return;
                    }
                    else {
                        console.log('The notification api is supported by this browser.');
                    }
                    
                    if (navigator.serviceWorker.controller) {
                        console.log("Seems the service worker is already active");
                    }
                    
                    //if (Notification.permission !== "granted") {
                        // Ask the user permission whether it is allowed for this domain to send notifications.
                        // Remark: the popup will not be displayed by the browser if it’s already granted or denied!
                        // If this domain is already denied in the past, the user will have to remove this domain manually from the blocked domain list
                        // (in his browser settings).  When he reloads this page, we will show the popup so he can choose again ...
                        Notification.requestPermission(function(permission) {
                            switch (permission) {
                                case 'granted':
                                    console.log('Now we can send notifications, because the permission popup "allow" button has been clicked!!');

                                    //worker.postMessage = (worker.webkitPostMessage || worker.postMessage);
                                    
                                    if (config.subscribeAtLoad) {
                                        // So we have an active service worker, which was not granted and now becomes granted (again).  This is probably what has happened:
                                        // 1. The user granted this domain.
                                        // 2. Thus the service worker became active, which means it will subscribe itself in pushmanager and in the Node-RED flow 
                                        //    (via in its 'activation' event handler ...)
                                        // 3. Afterwards the user blocks our domain, which means it is not granted anymore.  The service will remain active, but
                                        //    it won't receive events anymore from the browser!
                                        // 4. Meanwhile Node-RED could have send a notification, which will fail (because the web handler isn't reachable anymore
                                        //    for the push manager.
                                        // 5. Due to that failer, the Node-RED flow will consider this device as 'gone' and UNSUBSCRIBE this endpoint automatically!
                                        // 6. Now the user removes our domain again from the blocked sites list (in his browser settings).
                                        // 7. Since the webworker was already active, its 'activation' event won't be called anymore so it won't subscribe this
                                        //    endpoint in the Node-RED flow again!  Which means Node-RED is not able to send notifications to this device anymore.
                                        // Solution is to ask the active web worker to subscribe itself again in Node-RED ...
                                        navigator.serviceWorker.getRegistrations().then(function (registrations) {
                                            // There can be a number of service worker registrations, but we will post a message to the active one
                                            for (var i = 0; i < registrations.length; i++) {
                                                var activeServiceWorker = registrations[i].active;
                                                if (activeServiceWorker) {
                                                    console.log("Request the existing (active) service worker to subscribe (again) to Node-RED");
                                                    activeServiceWorker.postMessage('subscribeToNodeRed');
                                                }
                                            }
                                        });
                                    }
                                    break;
                                case 'denied':
                                    console.log('Not allowed to send notifications, because the permission popup "deny" button has been clicked!');
                                    break;
                                case 'default':
                                    console.log('Not allowed to send notifications, because the permission popup has been closed by clicking on x!');
                            }
                        })
                    //}
                    
                    // Compose the url where the browser can fetch our service worker Javascript file.
                    // The node.id contains a '.' which is not allowed in urls, so let's replace it by a '_'
                    var serviceUrl = 'ui_web_push/' + config.id.replace(/\./g,'_') + '/nodered_push_service.js';

                    // Register a service worker that runs in background (in a separate thread), if none is active yet.
                    // The service worker will be executed in a ServiceWorkerGlobalScope, which is a worker context with no DOM access.
                    // The service.js file will contain all our service worker code.
                    // The service worker file is at the root of the domain, which means that the service worker’s scope will be the
                    // entire origin. As a result, this service worker will receive fetch events for all pages in this domain. 
                    navigator.serviceWorker.register(serviceUrl, function(registration) {
                        console.log('Service worker registration succeeded:', registration);
                    }, /*catch*/ function(error) {
                        console.log('Service worker registration failed:', error);
                    });
                }

                $scope.$watch('msg', function(msg) {
                    // Ignore undefined messages.
                    if (!msg) {
                        return;
                    }
                    
                    debugger;
// TODO geen reply messages !!!!!!!!!!!!!!!!
                    
                    // As soon as we have a new version of the nodered_push_service.js on the server, that should be loaded by the browser. 
                    // However that isn't the case, since navigator.serviceWorker.register doesn't load the file again when loaded previously already...
                    // There are some workarounds (See more details on https://developers.google.com/web/updates/2019/09/fresher-sw) :
                    // - We could set updateViaCache to 'none' (in navigator.serviceWorker.register), to avoid that the nodered_push_service.js is 
                    //   being stored in the http cache.  
                    // - Or we could (in the http endpoint) do "res.set('Cache-Control', 'max-age=0');" to make sure the browser will not store 
                    //   the nodered_push_service.js in the http cache.  Same as previous point, but now for older browsers.
                    // But in both solutions we would fetch it every time from the server to get the latest version, which would result in more traffic ...  
                    // Therefore we will update it manually ...
                    // Remark: within 24 hours your service worker will update (they will check every 24 hours to see if there is a newer version available).
                    if (msg.payload && msg.payload === "reload_service_worker") {
                        if (!('serviceWorker' in navigator)) {
                            console.log('Cannot reload service worker, because service workers are NOT supported by this browser!');
                            return;
                        }
                        
                        navigator.serviceWorker.getRegistrations(function (registrations) {
                            for (var i = 0; i < registrations.length; i++) {
                                var registration = registrations[i];
                                //if (registration.active) {
                                    // Fetch the worker's script URL.  If the new worker is not byte-by-byte identical to the current worker, it installs the new worker.
                                    // The fetch of the worker bypasses any browser caches if the previous fetch occurred over 24 hours ago.
                                    registration.update();
                                    
                                    console.log("The registration has been updated");
                                //}
                            }
                        });
                        
                        // TODO resultaat terugsturen ...
                    }
                    
                    if (msg.payload && msg.payload === "unregister_service_worker") {
                        if (!('serviceWorker' in navigator)) {
                            console.log('Cannot unregister service worker, because service workers are NOT supported by this browser!');
                            return;
                        }
                        
                        
                        navigator.serviceWorker.getRegistrations(function (registrations) {
                            for (var i = 0; i < registrations.length; i++) {
                                var registration = registrations[i];
                                //if (registration.active) {
                                    // Unregister the service worker.  Caution: this does not purge the Cache!
                                    // Refreshing the page will start the service worker life cycle from scratch.
                                    registration.unregister();
                                    
                                    console.log("The registration has been unregistered");
                                //}
                            }
                        });
                        
                        // TODO het resultaat terugsturen ...
                    }
                });                        
            }
        });

        node.on("close", function() {
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("ui_web_push_client", WebPushClientNode);
    
    // By default the UI path in the settings.js file will be in comment:
    //     //ui: { path: "ui" },
    // But as soon as the user has specified a custom UI path there, we will need to use that path:
    //     ui: { path: "mypath" },
    var uiPath = ((RED.settings.ui || {}).path) || 'ui';
	
    // Create the complete server-side path
    uiPath = '/' + uiPath + '/ui_web_push/:node_id/nodered_push_service.js';
    
    // Replace a sequence of multiple slashes (e.g. // or ///) by a single one
    uiPath = uiPath.replace(/\/+/g, '/');
	
    // Make all the static resources from this node public available (i.e. Service worker javascript file).
    RED.httpNode.get(uiPath, function(req, res){
        var nodeId = req.params.node_id;
        
        // In the client we had to replace the '.' by a '_', so lets restore it ...
        nodeId = nodeId.replace('_','.');
        
        var webPushClientNode = RED.nodes.getNode(nodeId);
        
        if (!webPushClientNode) {
            node.error("Cannot return service worker file for unexisting web-push-client node id = " + nodeId);
            res.status(404).json({error: 'No service worker file for unknown node id'});
            return;
        }
        
        var options = {
            root: __dirname /*+ '/lib/'*/,
            dotfiles: 'deny'
        };
        
        const filePath = path.join(__dirname, '/service_worker.js')

        var fileContent = fs.readFileSync(filePath).toString();
        if(!fileContent) {
            node.error("Cannot read service worker file from filesystem");
            res.status(404).json({error: 'Cannot read service worker file'});
            return;
        }
            
        var publicVapidKey = webPushClientNode.getVapidPublicKey();
        var nodeRedUrl = req.protocol + '://' + req.get('host'); // E.g. https://somehostname:1880/webpush
        var dashboardPath = ((RED.settings.ui || {}).path) || 'ui'; // Same way of working as above
        
        // At the start of the service.js file, 3 placeholders need to be replaced by their real value.
        // This is required because the service worker will run in the browser background, so it needs to be able to communicate with the Node-RED server ...
        fileContent = fileContent.replace("#public-vapid-key#", publicVapidKey);
        fileContent = fileContent.replace("#node-red-url#"    , nodeRedUrl);
        fileContent = fileContent.replace("#dashboard-path#"  , dashboardPath);
        // TODO we could define the '/webpush' path inside the config screen, and inject it as a 4th parameter into the file ...
        
        // Send the requested file to the client
        res.type("js").send(fileContent);
    });
}