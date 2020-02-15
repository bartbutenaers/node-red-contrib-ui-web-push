# node-red-contrib-ui-web-push
A Node-RED widget node to send web push notification via the dashboard

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-ui-web-push
```

Some prerequisites:
+ This node depends works depends heavily on the [node-red-contrib-web-push](https://github.com/webmaxru/node-red-contrib-web-push), so make sure those nodes have been installed!!!  Thanks to Maxim Salnikov for reviewing my developments!
+ Safari browser still doesn't support web push notifications in iOS.  But you can sign a [petition](https://www.wonderpush.com/blog/when-will-ios-implement-web-push-notifications) to Apple.
+ Some browsers (e.g. Chrome) only support via an SSL connection, so make sure the Node-RED dashboard is available via https.
+ Some browsers (e.g. Chrome) don't support self-signed certificates, so make sure to use trusted certificates (e.g. using Letsencrypt).  Otherwise an error like *"An SSL certificate error occurred when fetching the script"* will appear in the browser's console log...

## Web push introduction
Web push notifications are messages that are sent by a website or by a web app to your device.  They are rather similar to native push notifications (i.e. APNfor iOS and FCM for Android), because web push notifications can also be delivered to your device, mobile or desktop, even when the user is not active on the platform.

Instead of using native push notifications to real apps (like Telegram, Pushbullet, ...), we will use web push notifications directly to the Node-RED dashboard.  This way we will try to have notifications 100% integrated into Node-RED, without having the need for third-party apps ...

To be able to understand the Node-RED flow for web-push (see further below), a basic understand of the web-push flow is advised:

![Overivew](https://user-images.githubusercontent.com/14224149/74592165-e9349600-501e-11ea-8108-5f06f5564bed.png)

0. In the config node (of the web-push nodes), a *key pair* (existing of a private key and a public key) is required ONCE!
1. As soon as the Node-RED dashboard is opened in the browser on a device, the web-push-client node will start a ***service worker***.  
   Remark: service workers are background processes that run in a browser, which allow us to handle notifications even when our dashboard web application is not open...
2. The service worker will get the *public* key from the Node-RED server.
3. The service worker will pass the *public* key to an online push service.  This way the push service can link this device to the specified public key.  The push service will return a *subscription*, which is in fact an URL.
   
   Remark: The browser will determine which online push service will be used, since almost each browser vendor will offer his own push service ...
4. The service worker will pass the subscription to the Node-RED flow, which will arrive as a http request via a Http-in node.
5. The subscription manager will store the credentials in a list.  In the example flow below, the credential list is a flow variable.
6. When the Node-RED flow wants to send a notification, all subscriptions will be loaded (e.g. from the flow variable).
7. The notification is send to all subscriptions.  Which means that all the subscription URLs will be called, so a request will be send to (one or more) online push services.  This request will contain the key pair, to allow the push service to check whether we are authorized to send a notification to the specified subscription.
8. The push service will forward our request to the device, where the browser app will call our background service worker.  *The advantage is that the dashboard doesn't has to be open, in order to be able to receive notifications!*  
   
   Remark: at this point the service worker is not allowed to do lots of things, because first a user gesture is required...
9. Our service worker will parse the request, and show a notification in the device's notification list.
10. As soon as the user clicks on the notification, our service worker is called again.

   Remark: due to the user interaction, the service worker is now allowed to do more (so it will now open the dashboard page) ...

## Example flow
The following example flow should be enough to get you started with web push notifications:

![Example flow](https://user-images.githubusercontent.com/14224149/74588733-53d5d980-4fff-11ea-9b7f-9950c3b71d69.png)

```
[{"id":"69305ffc.7d54","type":"http in","z":"4142483e.06fca8","name":"Demo Web Push Manager REST API","url":"webpush","method":"post","upload":false,"swaggerDoc":"","x":950,"y":440,"wires":[["a07ca405.68cb78"]]},{"id":"a07ca405.68cb78","type":"function","z":"4142483e.06fca8","name":"Subscription Manager","func":"let pushSubscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n  \nlet result = ''\nlet foundSubscriptionItems = [];\n\n// Determine on which subscriptions the action should be executed\nif (msg.payload.action === 'reset') {\n    // Reset has impact on all subscriptions\n    foundSubscriptionItems = pushSubscriptions;\n}\nelse {\n    // Find all subscriptions for the specified endpoint\n    foundSubscriptionItems = pushSubscriptions.filter( subscriptionItem => {\n        return subscriptionItem.endpoint == msg.payload.subscription.endpoint;\n    })\n}\n\nlet totalSubscriptionLength = pushSubscriptions.length;\n  \nswitch (msg.payload.action) {\n    case 'subscribe':\n        if (foundSubscriptionItems.length === 0) {\n            pushSubscriptions.push(msg.payload.subscription);\n            result = 'Subscription registered: ' + msg.payload.subscription.endpoint\n        } else {\n            result = 'Subscription was already registered: ' + msg.payload.subscription.endpoint\n        }\n\n        msg.statusCode = 200;\n        break;\n    \n    case 'unsubscribe':\n        if(foundSubscriptionItems.length === 0) {\n            result = 'Subscription was not found: ' + msg.payload.subscription.endpoint\n        } else {\n            pushSubscriptions = pushSubscriptions.filter(subscriptionItem => {\n                return subscriptionItem.endpoint !== msg.payload.subscription.endpoint\n            })\n            result = 'Subscription unregistered: ' + msg.payload.subscription.endpoint\n        }\n    \n        msg.statusCode = 200;\n        break;\n    case 'reset':\n        // All push subscriptions will be removed!!!!!!!!!\n        // Make sure you know what you are doing, because you cannot send notifications to these endpoints anymore!!!!!!!!!\n        pushSubscriptions = [];\n        break;\n    default:\n        result = 'Unsupported action';\n        msg.statusCode = 400;\n}\n\nmsg.payload = { result: result }\n\n// Show the evolution in number of subscriptions\nnode.status({fill:\"green\",shape:\"dot\",text: pushSubscriptions.length + \" subscription (previously \" + totalSubscriptionLength + \")\"});\n\n// Make sure this flow variable in stored in a file, because we still need the subscriptions \n// after a flow restart (otherwise there is no way anymore to push notifications to those clients!!)\nflow.set('pushSubscriptions', pushSubscriptions, \"storeInFile\")\n  \nreturn msg;","outputs":1,"noerr":0,"x":1260,"y":320,"wires":[["351ab1f9.77425e","461a0e4f.49a2c"]]},{"id":"351ab1f9.77425e","type":"http response","z":"4142483e.06fca8","name":"API Response","statusCode":"","headers":{},"x":1500,"y":320,"wires":[]},{"id":"1eb4d318.8663cd","type":"function","z":"4142483e.06fca8","name":"Get subscriptions","func":"// Use the flow variable that has been set in Demo Web Push Manager API (\"storeInFile\" context)\nmsg.subscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n\nreturn msg;","outputs":1,"noerr":0,"x":610,"y":320,"wires":[["80f35e5a.19337"]]},{"id":"b4e51b65.60b128","type":"inject","z":"4142483e.06fca8","name":"Send custom notifcation","topic":"","payload":"{\"notification\":{\"title\":\"Hello Node-RED user !\",\"body\":\"Click me to open your dashboard\"},\"data\":{\"icon\":\"https://nodered.org/about/resources/media/node-red-icon-2.png\",\"actions\":[{\"action\":\"open_garage_cindy\",\"title\":\"Open garage Cindy\"},{\"action\":\"open_garage_bart\",\"title\":\"Open garage Bart\"}]}}","payloadType":"json","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":140,"y":420,"wires":[["342f2d69.bf6432"]]},{"id":"80f35e5a.19337","type":"web-push","z":"4142483e.06fca8","name":"","vapidConfiguration":"1da91b89.be0054","x":800,"y":320,"wires":[["f605028c.8ff83"]]},{"id":"8f232976.dbc998","type":"web-push-notification","z":"4142483e.06fca8","name":"web push notification","title":"Hello Node-RED user!!!","body":"Click me to open your dashboard","sound":"default","payload":"[{\"key\":\"icon\",\"value\":\"https://nodered.org/about/resources/media/node-red-icon-2.png\",\"type\":\"str\"}]","x":420,"y":220,"wires":[["1eb4d318.8663cd"]]},{"id":"ee7ec9c3.6ef378","type":"inject","z":"4142483e.06fca8","name":"Send predefined notification","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":160,"y":220,"wires":[["8f232976.dbc998"]]},{"id":"461a0e4f.49a2c","type":"debug","z":"4142483e.06fca8","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":1490,"y":360,"wires":[]},{"id":"db4c6c17.946a5","type":"comment","z":"4142483e.06fca8","name":"Listen for new subscriptions (\"/webpush\")","info":"The background worker service will send a request, with body.action = \"subscribe\" or \"unsubscribe\"","x":960,"y":400,"wires":[]},{"id":"2656683c.102538","type":"comment","z":"4142483e.06fca8","name":"Manage the subscriptions","info":"","x":1250,"y":280,"wires":[]},{"id":"1264b9aa.54c8e6","type":"comment","z":"4142483e.06fca8","name":"Inform client whether successfull subscription","info":"","x":1570,"y":280,"wires":[]},{"id":"1d859454.513a1c","type":"comment","z":"4142483e.06fca8","name":"Get a list of all subscriptions","info":"","x":600,"y":360,"wires":[]},{"id":"764c12f3.e425dc","type":"comment","z":"4142483e.06fca8","name":"Compose the notification","info":"","x":410,"y":180,"wires":[]},{"id":"56bd807b.91a8c","type":"comment","z":"4142483e.06fca8","name":"Send notification to the subscribers","info":"","x":820,"y":280,"wires":[]},{"id":"c8e7d6e7.c2a1e8","type":"comment","z":"4142483e.06fca8","name":"Send notification with two buttons","info":"","x":150,"y":380,"wires":[]},{"id":"d60dab0.9949e58","type":"inject","z":"4142483e.06fca8","name":"Send custom notifcation","topic":"","payload":"{\"notification\":{\"title\":\"Hello Node-RED user !\",\"body\":\"Click me to open your dashboard\"},\"data\":{\"silent\":true,\"requireInteraction \":true,\"icon\":\"https://nodered.org/about/resources/media/node-red-icon-2.png\",\"image\":\"https://user-images.githubusercontent.com/14224149/73395580-19bac700-42e0-11ea-90c2-71cb4f496637.png\"}}","payloadType":"json","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":140,"y":320,"wires":[["342f2d69.bf6432"]]},{"id":"342f2d69.bf6432","type":"change","z":"4142483e.06fca8","name":"payload => notification","rules":[{"t":"move","p":"payload","pt":"msg","to":"notification","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":380,"y":320,"wires":[["1eb4d318.8663cd"]]},{"id":"8468897a.ca5b98","type":"comment","z":"4142483e.06fca8","name":"Send notification with image","info":"","x":140,"y":280,"wires":[]},{"id":"f605028c.8ff83","type":"function","z":"4142483e.06fca8","name":"Detect unsubscriptions","func":"for (var i = 0; i < msg.payload.failed.length; i++) {\n    var failedItem = msg.payload.failed[i];\n    \n    // When we receive HTTP status codes 404 ('Not Found') or 410 ('Gone'), this means the subscription\n    // has expired or is no longer valid.  So we have to unscribe the endpoint, to make sure we don't\n    // send notifications to that subscriber anymore, since he won't get them anyway ...\n    if (failedItem.statusCode === 410) {\n        var outputMsg = {\n            payload: {\n                action: \"unsubscribe\",\n                subscription: {\n                    endpoint: failedItem.endpoint\n                }\n            }\n        };\n\n        node.send(outputMsg);\n    }\n}","outputs":1,"noerr":0,"x":1000,"y":320,"wires":[["a07ca405.68cb78"]]},{"id":"d3903144.27774","type":"inject","z":"4142483e.06fca8","name":"Remove all subscribers !!!!!!!","topic":"","payload":"{\"action\":\"reset\"}","payloadType":"json","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":960,"y":220,"wires":[["a07ca405.68cb78"]]},{"id":"1938167a.41367a","type":"ui_web_push_client","z":"4142483e.06fca8","group":"22787703.a0e968","order":3,"width":0,"height":0,"webPushConfig":"7ce8c5d1.27b5bc","subscribeAtLoad":true,"name":"","x":1480,"y":220,"wires":[[]]},{"id":"1da91b89.be0054","type":"vapid-configuration","z":"","subject":"mailto:bart.butenaers@gmail.com","publicKey":"","privateKey":"","gcmApiKey":"","name":""},{"id":"22787703.a0e968","type":"ui_group","z":"","name":"Default","tab":"80f0e178.bbf4a","disp":true,"width":"6","collapse":false},{"id":"7ce8c5d1.27b5bc","type":"vapid-configuration","z":"","subject":"legacy_1","publicKey":"BHAWRFQMuaNn_-gU3VqQk6_bHHaWehd9Zoe5uOEH47wz_BrzaPpiLCRt0kDZAKdvElPytGDz0ymCSpsSEHDdX-k","privateKey":"cFJCNzBtHDaopN71fJlCv5Jt0Fb1lRHJ64nDVJcwRng","gcmApiKey":"","name":""},{"id":"80f0e178.bbf4a","type":"ui_tab","z":"","name":"Home","icon":"dashboard","order":1,"disabled":false,"hidden":false}]
```

1. The UI node needs to be added to install a web worker inside the browser, where the Node-RED dashboard is running.
2. A Http-in node will listen for new subscribers, i.e. devices that want to start getting notifications.
3. The subscription manager will keep track of all notifications.  Make sure the list of notifications is made persistent (i.e. stored in filesystem), to make sure the subscriber list is still available after a system restart!  See [context storage](https://nodered.org/docs/user-guide/context#saving-context-data-to-the-file-system) for more information.
4. Via a Http-out node, the subscribers will be informed whether the subscription has been completed succesfully.
5. A predefined notification can be send e.g. by pressing the inject button.
6. The notfication can be (pre)defined in the Web-Push-Notification node.  This way 'basic' notification can be defined, but for more advanced notifications you will need to create a custom notification (see step 10).
7. Get a (optionally filtered) list of subscribers to which the notifcation has to be pushed.
8. Push the notification to the specified list of subscribers (via a public push service).
9. When a device cannot be reached (i.e. status code ```410```), it will be removed from the subscriber list.  Otherwise the list will start growing due to unactive subscriptions...
10. Beside to predefined notifications, it is also possible to create a notification from scratch (in JSON format).  This allows us to create more advanced notifications, which are not possible via the predefined notifications...

## Node usage
This section explains step by step how to use this node:
1. Make sure the above flow is up and running, and that your dashboard is secured with http and a self-signed certificate!
1. Make sure you generate a new key pair, via the button in the config node screen.  
   ***CAUTION:*** it is highly disadvised to renew the keypair afterwards by a new key pair, because this might cause failures!  Indeed the service worker scripts have been setup based on the original keypair ...
1. Make sure the same configuration is being used in ALL the web push related nodes!
1. Navigate in the browser to your dashboard url (and use the same domain as specified in the common name as your certificate).
1. Your browser will aks whether the Node-RED dashboard web application is allowed to send push notifications to your device, so press the *'Allow'* button:

   ![Permission dialog](https://user-images.githubusercontent.com/14224149/74588971-84b70e00-5001-11ea-89cc-47f87ad0b760.png)

1. Now you should be able to send a notification to your device, via the inject buttons in the above Node-RED flow...
1. A notification should appear on your device (even when your Node-RED dashboard is not open at the moment!).  For example on Windows 10:

   ![Windows 10](https://user-images.githubusercontent.com/14224149/74591382-dd91a100-5017-11ea-8ecb-2306d9fb834c.png)
   
1. After clicking on the notification, a browser session should open automatically to show a Node-RED dashboard page.

## Advanced examples

### Show image inside the notification

The second inject button (in the above example flow) will show an image inside the notification:

![Show image](https://user-images.githubusercontent.com/14224149/74590860-bdabae80-5012-11ea-96f5-b2949e52cbfc.png)

Which might be convenient, for example to share some critical events immediately.

Remark: make sure the image size and aspect ratio follows the [guidelines](https://documentation.onesignal.com/docs/web-push-notification-icons#section-image).

### Show button(s) inside the notification

The third inject button (in the above example flow) will show two buttons inside the notification:

![Buttons](https://user-images.githubusercontent.com/14224149/74591081-1bd99100-5015-11ea-9043-0fdf51936f1c.png)

From the custom JSON notification definition, it becomes clear that the buttons are linked to the actions ´´´open_garage_cindy``` and ```open_garage_bart```:
```
{
    "notification": {
        "title": "Hello Node-RED user !",
        "body": "Click me to open your dashboard"
    },
    "data": {
        "icon": "https://nodered.org/about/resources/media/node-red-icon-2.png",
        "actions": [
            {
                "action": "open_garage_cindy",
                "title": "Open garage Cindy"
            },
            {
                "action": "open_garage_bart",
                "title": "Open garage Bart"
            }
        ]
    }
}
```

You can handle both actions easily in the Node-RED flow by adding two Http-in nodes:

![Http-in nodes](https://user-images.githubusercontent.com/14224149/74591010-53940900-5014-11ea-9841-a71de21ed6b0.png)

```
[{"id":"d83aebe4.654b38","type":"http in","z":"4142483e.06fca8","name":"","url":"/open_garage_bart","method":"get","upload":false,"swaggerDoc":"","x":120,"y":540,"wires":[["9d33f91c.406488","d785dcea.a1ac"]]},{"id":"9d33f91c.406488","type":"debug","z":"4142483e.06fca8","name":"Notification action to open garage bart","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","x":450,"y":580,"wires":[]},{"id":"d6a29727.80ac58","type":"http in","z":"4142483e.06fca8","name":"","url":"/open_garage_cindy","method":"get","upload":false,"swaggerDoc":"","x":130,"y":640,"wires":[["741b827f.a177ec","8d367e5d.c3abe"]]},{"id":"741b827f.a177ec","type":"debug","z":"4142483e.06fca8","name":"Notification action to open garage cindy","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","x":460,"y":680,"wires":[]},{"id":"d785dcea.a1ac","type":"http response","z":"4142483e.06fca8","name":"Answer 'ok'","statusCode":"200","headers":{},"x":370,"y":540,"wires":[]},{"id":"8d367e5d.c3abe","type":"http response","z":"4142483e.06fca8","name":"Answer 'ok'","statusCode":"200","headers":{},"x":370,"y":640,"wires":[]}]
```
As soon as a button in the notification is clicked, a debug message should appear in the Node-RED flow.  These input messages can now be used to control your smart home ...

### Other examples

Much more other examples can be found on the internet.  If you have created something mentioning here, please let me know!
