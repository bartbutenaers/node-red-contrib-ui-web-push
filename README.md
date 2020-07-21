# node-red-contrib-ui-web-push
A Node-RED widget node to send web push notifications via the Node-RED dashboard.

This node allows notifications to be send to devices (running Windows, Android, Linux, OSX), entirely integrated into Node-RED.  This way no third-party messaging tools (like Telegram, PushBullet ...) are required anymore.  A typical use case is sending notifications from a Node-RED flow to an Android smartphone:

![Android notification](https://user-images.githubusercontent.com/14224149/79164690-d69dc980-7de1-11ea-8b81-44d28a65dc74.png)

Really would like to thank Maxim Salnikov ([@webmaxru](https://twitter.com/webmaxru)) - PWA speaker/trainer, organizer of [PWA Slack](https://aka.ms/pwa-slack) and [PWACon](https://twitter.com/pwaconf)!
By reviewing this node and sharing his knowledge about web push notifications, the user friendliness of this UI node has been improved heavily!  Lots of the practical tips on this page are provided by Maxim ...

## Install

Run the following NPM command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-ui-web-push
```

Make sure to read these prerequisites:
+ The [node-red-contrib-web-push](https://github.com/webmaxru/node-red-contrib-web-push) nodes (developed by Maxim) also will be installed automatically as a dependency!!
   + The *node-red-contrib-web-push* nodes can be used to send web push notifications to the device.
   + The *node-red-contrib-ui-web-push* node can be used to receive those web push notifications on the device.
   
   Both node suites will *share* the same VAPID configuration nodes, so you only have to generate the keypair (see below) once.

+ Use a ***browser that supports*** service workers and push notifications.  

   **CAUTION:** Apple still doesn't allow web push notifications in iOS (see [article](https://www.wonderpush.com/blog/when-will-ios-implement-web-push-notifications/)).  Although Safari supports web push notification in OSX, it doesn't support them in iOS.  And since other browsers (like e.g. Chrome) on iOS are just wrappers around Safari, those browsers also won't be able to support it on these devices!  But you can sign a [petition](https://www.wonderpush.com/blog/when-will-ios-implement-web-push-notifications) to try to convince Apple ...

+ Some browsers (e.g. Chrome) only support web push via an ***SSL connection***, so make sure the Node-RED dashboard is available via https.

+ Some browsers (e.g. Chrome) don't support web push with self-signed certificates, so make sure to use ***trusted certificates*** (e.g. using LetsEncrypt).  Otherwise an error like *"An SSL certificate error occurred when fetching the script"* will appear in the browser's console log...

   + Install my [node-red-contrib-letsencrypt](https://github.com/bartbutenaers/node-red-contrib-letsencrypt) node, which completely integrates the automatic generation of LetsEncrypt certificates into Node-RED.  Remark: that node is not published on NPM yet, but some users are already using it in production via duckdns.org.
   + I created a [pull request](https://github.com/node-red/node-red/pull/2551) to allow you to load those renewed (LetsEncrypt) certificates automatically into Node-RED, without restarting Node-RED.  See the official Node-RED [documentation](https://nodered.org/docs/user-guide/runtime/securing-node-red) how you can use the `https` and `httpsRefreshInterval` properties to activate this mechanism.

+ The Node-RED ***context should be persistent***!!  Indeed the example subscription manager (Function node) will store all subscriptions on flow memory, which need to be remembered even after a system restart.  Otherwise the subscriptions will be lost, thus it would become impossible to send notifications to those devices!  Read this [discussion](https://discourse.nodered.org/t/a-guide-to-understanding-persistent-context/4115) how to setup persistency:

   ![persistency](https://user-images.githubusercontent.com/14224149/82137540-7c958700-9819-11ea-8de0-c5c5bf30e85f.png)

## Support my Node-RED developments

Please buy my wife a coffee to keep her happy, while I am busy developing Node-RED stuff for you ...

<a href="https://www.buymeacoffee.com/bartbutenaers" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy my wife a coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Web push quick intro

Web push notifications are messages that are sent by a website or by a web app to your device.  Those web push notifications are rather similar to native push notifications (i.e. APN for iOS and FCM for Android), because web push notifications can also be delivered to your device, mobile or desktop.  And the web push notifications will also arrive on your device, even when the browser app is not open at that moment.

The Node-RED dashboard is a web app, and no native (Windows, Android, iOS, ...) app.  That is the reason why we will need to send web push notifications, instead of native notifications.  That is the big difference with native messaging apps (like Telegram, PushBullet, ...): they offer a native app on all platforms, to be able to send native notifications on all those platforms.

***The main target of this node-red-contrib-ui-web-push is to integrate notifications 100% into Node-RED, without needing any of those third-party apps ...***

Remark: if the dashboard is being used in multiple browsers (Chrome, Firefox, ...) on the same device, then a user can subscribe to receive notifications in EACH browser.  But of course then the user will get ***duplicate notifications*** on that device, since each browser uses its own cloud service solution.

## Basic example flow

The following example flow allows you to send a predefined *"Hello Node-RED"* notification to the device where your dashboard is running:

![Basic flow](https://user-images.githubusercontent.com/14224149/78833212-c5714900-79ec-11ea-981e-dbacc6c1a1ae.png)
```
[{"id":"45b24539.0c250c","type":"function","z":"4142483e.06fca8","name":"Subscription Manager","func":"let pushSubscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n  \nlet result = ''\nlet foundSubscriptionItems = [];\n\n// Determine on which subscriptions the action should be executed\nif (msg.payload.action === 'reset') {\n    // Reset has impact on all subscriptions\n    foundSubscriptionItems = pushSubscriptions;\n}\nelse {\n    // Find all subscriptions for the specified endpoint\n    foundSubscriptionItems = pushSubscriptions.filter( subscriptionItem => {\n        return subscriptionItem.endpoint == msg.payload.endpoint;\n    })\n}\n\nlet totalSubscriptionLength = pushSubscriptions.length;\n  \nswitch (msg.topic) {\n    case 'subscribe':\n        var subscription = msg.payload;\n        if (foundSubscriptionItems.length === 0) {\n            pushSubscriptions.push(subscription);\n            result = 'Subscription registered: ' + subscription.endpoint\n        } else {\n            result = 'Subscription was already registered: ' + subscription.endpoint\n        }\n\n        msg.statusCode = 200;\n        break;\n    \n    case 'unsubscribe':\n        var unsubscription = msg.payload;\n        if(foundSubscriptionItems.length === 0) {\n            result = 'Subscription was not found: ' + unsubscription.endpoint\n        } else {\n            pushSubscriptions = pushSubscriptions.filter(subscriptionItem => {\n                return subscriptionItem.endpoint !== unsubscription.endpoint\n            })\n            result = 'Subscription unregistered: ' + unsubscription.endpoint\n        }\n    \n        msg.statusCode = 200;\n        break;\n    case 'reset':\n        // All push subscriptions will be removed!!!!!!!!!\n        // Make sure you know what you are doing, because you cannot send notifications to these endpoints anymore!!!!!!!!!\n        pushSubscriptions = [];\n        break;\n    default:\n        result = 'Unsupported action';\n        msg.statusCode = 400;\n}\n\nmsg.payload = { result: result }\n\n// Show the evolution in number of subscriptions\nnode.status({fill:\"green\",shape:\"dot\",text: pushSubscriptions.length + \" subscription (previously \" + totalSubscriptionLength + \")\"});\n\n// Make sure this flow variable in stored in a file, because we still need the subscriptions \n// after a flow restart (otherwise there is no way anymore to push notifications to those clients!!)\nflow.set('pushSubscriptions', pushSubscriptions, \"storeInFile\")\n  \nreturn msg;","outputs":1,"noerr":0,"x":880,"y":1180,"wires":[[]]},{"id":"4dff8120.bfde","type":"function","z":"4142483e.06fca8","name":"Get subscriptions","func":"// Use the flow variable that has been set in Demo Web Push Manager API (\"storeInFile\" context)\nmsg.subscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n\nreturn msg;","outputs":1,"noerr":0,"x":870,"y":1240,"wires":[["19e3e14.a65e31f"]]},{"id":"19e3e14.a65e31f","type":"web-push","z":"4142483e.06fca8","name":"Send notification to the subscribers","vapidConfiguration":"1da91b89.be0054","x":1140,"y":1240,"wires":[[]]},{"id":"33564eff.3c59a2","type":"web-push-notification","z":"4142483e.06fca8","name":"web push notification","title":"Hello Node-RED user!!!","body":"Click me to open your dashboard","sound":"default","payload":"[{\"key\":\"icon\",\"value\":\"https://nodered.org/about/resources/media/node-red-icon-2.png\",\"type\":\"str\"}]","x":620,"y":1240,"wires":[["4dff8120.bfde"]]},{"id":"5b1f28d4.536378","type":"inject","z":"4142483e.06fca8","name":"Send predefined notification","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":360,"y":1240,"wires":[["33564eff.3c59a2"]]},{"id":"76325193.197f5","type":"ui_web_push_client","z":"4142483e.06fca8","group":"22787703.a0e968","order":3,"width":0,"height":0,"webPushConfig":"1da91b89.be0054","sendSubscription":true,"showConfirmations":true,"disableButton":false,"subscribeLabel":"Subscribe","unsubscribeLabel":"Unsubscribe","name":"","x":640,"y":1180,"wires":[["45b24539.0c250c"]]},{"id":"1da91b89.be0054","type":"vapid-configuration","z":"","subject":"mailto:<enter_your_email_address_here>","publicKey":"","privateKey":"","gcmApiKey":"","name":""},{"id":"22787703.a0e968","type":"ui_group","z":"","name":"Web push notifications","tab":"80f0e178.bbf4a","disp":true,"width":"6","collapse":false},{"id":"80f0e178.bbf4a","type":"ui_tab","z":"","name":"Home","icon":"dashboard","order":1,"disabled":false,"hidden":false}]
```

1. The node-red-contrib-ui-web-push node will setup all required components (in the browser) on the device where you want to receive your notifications (i.e. the device where you are displaying your dashboard).  This node will also display a "(un)subscribe" button in the dashboard, to send (un)subscribe output messages to your Node-RED flow.

1. A function node that implements a basic subscription manager, that stores a list of subscriptions on the flow memory.  It will maintain that list of subscriptions, based on the (un)subscribe messages which are send by the the node-red-contrib-ui-web-push node.

1. Press the Inject node button to trigger sending a new notification to the (browser on the) device.  In a real-life flow anything can trigger a notification, for example an alarm triggered by a smoke detector ...

1. The node-red-contrib-web-push node contains all the (predefined) information that needs to be sent inside the notification.

1. A function node can be used to get the available subscriptions from the flow memory, to determine which devices should get the notification.  When 'all' subscribed devices need to get a notification, a simple [Change-node](https://nodered.org/docs/user-guide/context#using-context-in-a-flow) could be to fetch the list from the context flow memory:

   ![Switch node](https://user-images.githubusercontent.com/14224149/88015332-3adad280-cb21-11ea-849a-ec93b6126f80.png)

   But a function node might be handy, for example to filter (based on the trigger source) which subscriptions need to get the notification.

1. The node-red-contrib-web-push node will send the notification to the device where the dashboard is running.

## Node usage

This section explains step-by-step how to use this node.

### Subscribe process

The following steps need to be taken to subscribe a browser, in order to start receiving notifications on this device:

1. Make sure the above example flow is up and running, and that your dashboard is secured with https and a trusted certificate!

1. Create a new configuration (node), where you need to enter a (valid) email address.  And generate a new key pair once, via the button in the config node screen:

   ![image](https://user-images.githubusercontent.com/14224149/78873922-e452f800-7a4b-11ea-889a-a496514a678b.png)
  
   ***CAUTION:*** it is ***NOT*** advised to renew the VAPID keypair afterwards by a new key pair, because the existing subscriptions (which have been generated via the old keypair) won't be usable anymore!  Which means the subscriptions are still available in the list on the flow memory, but an error will occur when sending notifications (based on the new VAPID keypair) to those descriptions.
   
1. Make sure the same configuration is being used in ALL the web push related nodes!

1. Navigate in the browser to your dashboard.

1. Press the *"Subscribe"* button, which is being displayed by this UI node.

   ![Subscribe button](https://user-images.githubusercontent.com/14224149/78837560-9fe83d80-79f4-11ea-95d6-a54a72fbb3eb.png)
   
   Remark: this way the user needs to ask ***explicit*** to subscribe for receiving notifications, because it is very annoying for users if the notification popup appears automatically when they visit the web app (without any context why these notifications can be of any use to them ...)!

1. Your browser will ask whether the Node-RED dashboard web application is allowed to send push notifications to your device, so press the *'Allow'* button:

   ![Permission dialog](https://user-images.githubusercontent.com/14224149/74588971-84b70e00-5001-11ea-89cc-47f87ad0b760.png)

1. Now you should be able to send a notification to your device, via the inject buttons in the above Node-RED flow...

1. A notification should appear on your device.  For example on Windows 10:

   ![Windows 10](https://user-images.githubusercontent.com/14224149/74591382-dd91a100-5017-11ea-8ecb-2306d9fb834c.png)
   
   *Since the operating system on your device will handle the push notifications, you should also get those notifications when the Node-RED dashboard is not open currently.  Note that even the browser app should not be started yet, in order to get notifications!*
   
1. After clicking on the notification, a browser session should open automatically to show a Node-RED dashboard page.  
   Some remarks about this:
   + When a Node-RED dashboard tab sheet is already available in the browser, then that tab sheet will be displayed (instead of opening a second new tab sheet).  This way it is avoided that you end up with large series of Node-RED dashboard tab sheets being open after a while.
   + Depending on your browser settings, the Node-RED dashboard will be opened in a new tab sheet or in a entirely new window.
   
1. As soon as the browser has subscribed successfully to receive notifications, the label on the button will switch automatically from *"Subscribe"* to *"Unsubscribe"*.  This indicates that it is from now on possible to unsubscribe from receiving notifications: see next section...

### Unsubscribe process

The following steps need to be taken to unsubscribe a browser, in order to stop receiving notifications on this device:

1. When clicking the *"Unsubscribe"* button, an unsubscribe message will be send to the subscription manager (function) node.

   ![Unsubscribe button](https://user-images.githubusercontent.com/14224149/79165537-9f301c80-7de3-11ea-94f5-ef719e492162.png)

1. The subscription manager will remove the subscription from the subscription list on flow memory.

1. The label on the button will switch automatically from *"Unsubscribe"* to *"Subscribe"*.

1. When a new notification is triggered afterwards in the Node-RED flow, it won't be send anymore to this device.

## Node properties

### Subscribe label

Specify which text needs to be displayed on the *"Subscribe"* button.  This can be used to override the default label, for example to support another language.

### Unsubscribe label

Specify which text needs to be displayed on the *"Unsubscribe"* button.  This can be used to override the default label, for example to support another language.

### Send subscription at every page load

When activated, then the dashboard client will send the current existing subscription (when available) automatically to the server, every time the Node-RED dashboard web app is started on this device.  

+ In normal circumstances the subscription is already available on the server (since it has been stored in the subscription manager as soon as the "Subscribe" button has been clicked), so it will be ignored as duplicate by the subscription manager.  So in those cases it has no use to activate this option, because it will only result in more network traffic and unneeded processing in the Node-RED flow.

+ But in exceptional cases this might be activated e.g. when the current subscriptions got lost to a technical failure.  That way you can rebuild the list of current subscriptions.  Although the list will only be updated gradually, i.e. only as soon as dashboards are restarted on the devices.

### Show confirmations at successful (un)subscriptions

When activated, a confirmation popup will appear when a subscription or un-subscription is successful (after the button has been clicked).  But this is deactivated by default since the button label is also automatically changed, as soon as the (un)subscription was successful...

### Disable button when no browser support

When activated, the 'Subscribe' button will be disabled when the browser doesn't support service workers or push notifications.  
When not activated the button would always be enabled, but an error popup will occur (about the lack of support) as soon as the button is clicked on a device that doesn't support web pushing.

## More advanced examples

### Create custom notification (with embedded image)

:warning: Not all browsers [support](https://developer.mozilla.org/en-US/docs/Web/API/notification/image) images inside notifications!  Those browsers will show the notification without the image...

The above basic example shows how to deal with ***predefined*** notifications, which means that all notification information is entered manually once into the node-red-contrib-web-push nodes.  However it is also possible to create a ***custom*** notification from scratch (in JSON format).  Once you have become familiar with the syntax of custom notifications, those custom notifications have some advantages compared to predefined notifications:
+ They offer advanced features, like e.g. embedded images.
+ They can be created dynamically based on the trigger source, which allows us to show information (e.g. "Smoke detected in the kitchen") without the user having to open the Node-RED dashboard to figure out what is going on ...

The following example flow will show an image inside the notification:

![Custom notification flow](https://user-images.githubusercontent.com/14224149/78837989-81367680-79f5-11ea-8892-3dc7454b5adf.png)
```
[{"id":"8b685850.ce1428","type":"function","z":"4142483e.06fca8","name":"Get subscriptions","func":"// Use the flow variable that has been set in Demo Web Push Manager API (\"storeInFile\" context)\nmsg.subscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n\nreturn msg;","outputs":1,"noerr":0,"x":890,"y":1180,"wires":[["e45925bf.a85bb8"]]},{"id":"e45925bf.a85bb8","type":"web-push","z":"4142483e.06fca8","name":"Send notification to the subscribers","vapidConfiguration":"1da91b89.be0054","x":1160,"y":1180,"wires":[[]]},{"id":"362b4b30.09d254","type":"inject","z":"4142483e.06fca8","name":"Send custom notifcation","topic":"","payload":"{\"notification\":{\"title\":\"Hello Node-RED user !\",\"body\":\"Click me to open your dashboard\"},\"data\":{\"silent\":true,\"requireInteraction \":true,\"icon\":\"https://nodered.org/about/resources/media/node-red-icon-2.png\",\"image\":\"https://user-images.githubusercontent.com/14224149/73395580-19bac700-42e0-11ea-90c2-71cb4f496637.png\"}}","payloadType":"json","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":420,"y":1180,"wires":[["180914ab.2b6e8b"]]},{"id":"180914ab.2b6e8b","type":"change","z":"4142483e.06fca8","name":"payload => notification","rules":[{"t":"move","p":"payload","pt":"msg","to":"notification","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":660,"y":1180,"wires":[["8b685850.ce1428"]]},{"id":"1da91b89.be0054","type":"vapid-configuration","z":"","subject":"mailto:<enter_your_email_address_here>","publicKey":"","privateKey":"","gcmApiKey":"","name":""}]
```

The result of this flow is a notification containing an embedded image, which can look a bit differently on the supported platforms:

+ On Windows 10 the image will be displayed automatically inside the notification:

   ![Notification image Windows](https://user-images.githubusercontent.com/14224149/74590860-bdabae80-5012-11ea-96f5-b2949e52cbfc.png)

+ On an Android smartphone, the image will only appear after the small arrow inside the notification has been clicked:

   ![Notification image Android](https://user-images.githubusercontent.com/14224149/79164759-fd5c0000-7de1-11ea-9f5f-37ebb5aafcac.png)

***CAUTION:*** make sure the image size and aspect ratio follows the [guidelines](https://documentation.onesignal.com/docs/web-push-notification-icons#section-image).

A typical use case of this flow is sending an snapshot image captured by an IP camera, when an intruder has been detected.  By including the image inside the notification, you can quickly determine whether there is a real alarm or not (without having to search all the stored video footage inside your system).  

*Rule of thumb: Make sure useful information about the event is being send inside the message.  This way the information of the event will also be pushed to the client, to avoid that the user needs to collect the information manually inside the Node-RED dashboard web app.*

Thanks to Shutterstock for this royalty free [image](https://www.shutterstock.com/image-photo/funny-childlike-burglar-bandit-puts-hands-330700175)!

### Show button(s) inside the notification

:warning: Probably only Chrome [supports](https://developer.mozilla.org/en-US/docs/Web/API/notification/actions) buttons (i.e. actions) inside notifications!  Those browsers will show the notification without the buttons...

It is possible to show *buttons* inside a web push notification, to allow the user to trigger specific *actions* in your Node-RED flow.

![Two button flow](https://user-images.githubusercontent.com/14224149/78867143-e9f71080-7a40-11ea-88a0-d145be0b788c.png)
```
[{"id":"d204f19d.432d6","type":"function","z":"4142483e.06fca8","name":"Subscription Manager","func":"let pushSubscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n  \nlet result = ''\nlet foundSubscriptionItems = [];\n\n// Determine on which subscriptions the action should be executed\nif (msg.payload.action === 'reset') {\n    // Reset has impact on all subscriptions\n    foundSubscriptionItems = pushSubscriptions;\n}\nelse {\n    // Find all subscriptions for the specified endpoint\n    foundSubscriptionItems = pushSubscriptions.filter( subscriptionItem => {\n        return subscriptionItem.endpoint == msg.payload.endpoint;\n    })\n}\n\nlet totalSubscriptionLength = pushSubscriptions.length;\n  \nswitch (msg.topic) {\n    case 'subscribe':\n        var subscription = msg.payload;\n        if (foundSubscriptionItems.length === 0) {\n            pushSubscriptions.push(subscription);\n            result = 'Subscription registered: ' + subscription.endpoint\n        } else {\n            result = 'Subscription was already registered: ' + subscription.endpoint\n        }\n\n        msg.statusCode = 200;\n        break;\n    \n    case 'unsubscribe':\n        var unsubscription = msg.payload;\n        if(foundSubscriptionItems.length === 0) {\n            result = 'Subscription was not found: ' + unsubscription.endpoint\n        } else {\n            pushSubscriptions = pushSubscriptions.filter(subscriptionItem => {\n                return subscriptionItem.endpoint !== unsubscription.endpoint\n            })\n            result = 'Subscription unregistered: ' + unsubscription.endpoint\n        }\n    \n        msg.statusCode = 200;\n        break;\n    case 'reset':\n        // All push subscriptions will be removed!!!!!!!!!\n        // Make sure you know what you are doing, because you cannot send notifications to these endpoints anymore!!!!!!!!!\n        pushSubscriptions = [];\n        break;\n    default:\n        result = 'Unsupported action';\n        msg.statusCode = 400;\n}\n\nmsg.payload = { result: result }\n\n// Show the evolution in number of subscriptions\nnode.status({fill:\"green\",shape:\"dot\",text: pushSubscriptions.length + \" subscription (previously \" + totalSubscriptionLength + \")\"});\n\n// Make sure this flow variable in stored in a file, because we still need the subscriptions \n// after a flow restart (otherwise there is no way anymore to push notifications to those clients!!)\nflow.set('pushSubscriptions', pushSubscriptions, \"storeInFile\")\n  \nreturn msg;","outputs":1,"noerr":0,"x":840,"y":1540,"wires":[[]]},{"id":"b7d9d75b.f115d8","type":"function","z":"4142483e.06fca8","name":"Get subscriptions","func":"// Use the flow variable that has been set in Demo Web Push Manager API (\"storeInFile\" context)\nmsg.subscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n\nreturn msg;","outputs":1,"noerr":0,"x":830,"y":1600,"wires":[["60cd4c0c.db8574"]]},{"id":"d10a8169.de205","type":"inject","z":"4142483e.06fca8","name":"Send notifcation with buttons","topic":"","payload":"{\"notification\":{\"title\":\"Hello Node-RED user !\",\"body\":\"Click me to open your dashboard\"},\"data\":{\"icon\":\"https://nodered.org/about/resources/media/node-red-icon-2.png\",\"actions\":[{\"action\":\"open_garage_cindy\",\"title\":\"Open garage Cindy\"},{\"action\":\"open_garage_bart\",\"title\":\"Open garage Bart\"}]}}","payloadType":"json","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":340,"y":1600,"wires":[["a4341d6c.2d81"]]},{"id":"60cd4c0c.db8574","type":"web-push","z":"4142483e.06fca8","name":"Send notification to the subscribers","vapidConfiguration":"1da91b89.be0054","x":1100,"y":1600,"wires":[[]]},{"id":"6c5cd120.d3a1f","type":"http in","z":"4142483e.06fca8","name":"","url":"/open_garage_bart","method":"get","upload":false,"swaggerDoc":"","x":300,"y":1680,"wires":[["3c830a3f.582436","39cf13aa.bf90cc"]]},{"id":"3c830a3f.582436","type":"debug","z":"4142483e.06fca8","name":"Notification action to open garage bart","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","x":630,"y":1720,"wires":[]},{"id":"e0d5e160.334e5","type":"http in","z":"4142483e.06fca8","name":"","url":"/open_garage_cindy","method":"get","upload":false,"swaggerDoc":"","x":310,"y":1800,"wires":[["de62ba4.5377a48","868cc565.c54218"]]},{"id":"de62ba4.5377a48","type":"debug","z":"4142483e.06fca8","name":"Notification action to open garage cindy","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","x":640,"y":1840,"wires":[]},{"id":"39cf13aa.bf90cc","type":"http response","z":"4142483e.06fca8","name":"Answer 'ok'","statusCode":"200","headers":{},"x":550,"y":1680,"wires":[]},{"id":"868cc565.c54218","type":"http response","z":"4142483e.06fca8","name":"Answer 'ok'","statusCode":"200","headers":{},"x":550,"y":1800,"wires":[]},{"id":"a4341d6c.2d81","type":"change","z":"4142483e.06fca8","name":"payload => notification","rules":[{"t":"move","p":"payload","pt":"msg","to":"notification","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":600,"y":1600,"wires":[["b7d9d75b.f115d8"]]},{"id":"47d1771a.fd95d8","type":"ui_web_push_client","z":"4142483e.06fca8","group":"22787703.a0e968","order":3,"width":0,"height":0,"webPushConfig":"1da91b89.be0054","sendSubscription":true,"showConfirmations":true,"disableButton":false,"subscribeLabel":"Subscribe","unsubscribeLabel":"Unsubscribe","name":"","x":600,"y":1540,"wires":[["d204f19d.432d6"]]},{"id":"1da91b89.be0054","type":"vapid-configuration","z":"","subject":"mailto:<enter_your_email_address_here>","publicKey":"","privateKey":"","gcmApiKey":"","name":""},{"id":"22787703.a0e968","type":"ui_group","z":"","name":"Web push notifications","tab":"80f0e178.bbf4a","disp":true,"width":"6","collapse":false},{"id":"80f0e178.bbf4a","type":"ui_tab","z":"","name":"Home","icon":"dashboard","order":1,"disabled":false,"hidden":false}]
```
By clicking the Inject node's button, a notification will appear that contains two buttons:

![Buttons](https://user-images.githubusercontent.com/14224149/74591081-1bd99100-5015-11ea-9043-0fdf51936f1c.png)

Some information about how this flow works:
1. Via the Inject node, the following custom JSON notification definition will be triggered:
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
   Which means that the buttons are linked to the actions ```open_garage_cindy``` and ```open_garage_bart```.
   
2. As soon as a button is clicked, a http request will be send to your Node-RED flow.

3. Those requests will be handled by the Http-In nodes (one node for each button).  This example flow only shows the request in the debug side panel, but of course you can use it to trigger ANY kind of action to control your smart home ...

Those buttons allow to trigger actions inside a Node-RED flow very easily, without having to open the Node-RED dashboard web app.

### Other examples

Much more other examples of web push notifications can be found on the internet.  If you have implemented an interesting use case, please let me know and I will share it here!

## The web push mechanism in depth

To be able to understand the Node-RED flow for web-push (see further below), a basic understand of the web-push flow is advised:

![Overview](https://user-images.githubusercontent.com/14224149/74592165-e9349600-501e-11ea-8108-5f06f5564bed.png)

0. In the config node (of the node-red-contrib-web-push nodes), it is required once to generate a *key pair* (both a private key and a public key)!

1. As soon as the Node-RED dashboard is opened in the browser on a device, the node-red-contrib-ui-web-push node will start a ***service worker***.  
   Remark: service workers are background processes that run in a browser, which allow us to handle notifications even when the browser app is currently not open...
   
2. The service worker will get the *public* VAPID key from the Node-RED server.

3. The service worker will pass the *public* VAPID key to an online push service.  This way the push service can link this device to the specified public key.  The push service will return a *subscription*, which is in fact an URL (to the device via this push service).
   
   Remark: The browser will determine on its own which online push service will be used, since almost each browser vendor will offer his own push service.  There exist cloud web push services from Microsoft, Google, Apple, Mozilla ...
   
4. The service worker will pass the subscription to the Node-RED flow, which will arrive as a http request via a Http-in node.

5. The subscription manager will store the credentials in a list.  In the example flow below, the credential list is a flow variable.

6. When the Node-RED flow wants to send a notification, all subscriptions will be loaded (e.g. from the flow variable).

7. The notification is send to all subscriptions.  Which means that all the subscription URLs will be called, so a request will be send to (one or more) online push services.  This request will contain the key pair, to allow the push service to check whether we are authorized to send a notification to the specified subscription.

8. The push service will forward our request to the device, where the browser app will call our background service worker.  *The advantage is that the dashboard doesn't has to be open, in order to be able to receive notifications!*  
   
   Remark: at this point the service worker is not allowed to do lots of things, because first a user gesture is required...
   
9. Our service worker will show a notification in the device's notification list.

10. As soon as the user clicks on the notification, our service worker is called again.  Due to the user interaction, the service worker is now allowed to do more (so it can now open the dashboard page) ...

## Advanced stuff

This section contains information that will not be needed in normal circumstances.

## Force reload of service worker

The service worker Javascript file should be downloaded - by the browser - from the Node-RED server, as soon as the file has changed (e.g. when a new version of this node will be released).  All modern browsers should behave like that, but I experienced that sometimes an old cached version is used...

In such rare circumstances, an input message can be injected to force the service worker Javascript file to be reloaded:

![Force reload](https://user-images.githubusercontent.com/14224149/78935931-eea5de00-7aad-11ea-905b-2657551e099d.png)
```
[{"id":"218acb09.624d54","type":"ui_web_push_client","z":"4142483e.06fca8","group":"22787703.a0e968","order":3,"width":0,"height":0,"webPushConfig":"1da91b89.be0054","sendSubscription":true,"showConfirmations":true,"disableButton":false,"subscribeLabel":"Subscribe","unsubscribeLabel":"Unsubscribe","name":"","x":1320,"y":500,"wires":[[]]},{"id":"39984194.b6179e","type":"inject","z":"4142483e.06fca8","name":"Reload service worker","topic":"","payload":"reload_service_worker","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":1080,"y":500,"wires":[["218acb09.624d54"]]},{"id":"22787703.a0e968","type":"ui_group","z":"","name":"Web push notifications","tab":"80f0e178.bbf4a","disp":true,"width":"6","collapse":false},{"id":"1da91b89.be0054","type":"vapid-configuration","z":"","subject":"mailto:<your_email_address>","publicKey":"","privateKey":"","gcmApiKey":"","name":""},{"id":"80f0e178.bbf4a","type":"ui_tab","z":"","name":"Home","icon":"dashboard","order":1,"disabled":false,"hidden":false}]
```

## Automatic un-subscriptions

In some exceptional cases it might be required to remove subscriptions automatically, although this is NOT advised!

Use case:
1. A user subscribes to receive notifications via the 'Subscribe' button.

2. Afterwards he changes his mind and - instead of using the 'Unsubscribe' button - he blocks the Node-RED dashboard url from sending notifications via his browser settings.

3. Since the Node-RED flow is not aware about this, it will keep sending notifications to that subscription.  And these attempts will fail over and over again.

4. To avoid that the number of obsolete subscriptions will continue to grow in time, you might remove subscriptions that have failed.

The following example flow creates unsubscribe messages automatically, when the notification sending fails for a subscription:

![Automatic remove](https://user-images.githubusercontent.com/14224149/78936474-edc17c00-7aae-11ea-9ff2-5e9d097b10a1.png)

```
[{"id":"a07ca405.68cb78","type":"function","z":"4142483e.06fca8","name":"Subscription Manager","func":"let pushSubscriptions = flow.get('pushSubscriptions', \"storeInFile\") || []\n  \nlet result = ''\nlet foundSubscriptionItems = [];\n\n// Determine on which subscriptions the action should be executed\nif (msg.payload.action === 'reset') {\n    // Reset has impact on all subscriptions\n    foundSubscriptionItems = pushSubscriptions;\n}\nelse {\n    // Find all subscriptions for the specified endpoint\n    foundSubscriptionItems = pushSubscriptions.filter( subscriptionItem => {\n        return subscriptionItem.endpoint == msg.payload.endpoint;\n    })\n}\n\nlet totalSubscriptionLength = pushSubscriptions.length;\n  \nswitch (msg.topic) {\n    case 'subscribe':\n        var subscription = msg.payload;\n        if (foundSubscriptionItems.length === 0) {\n            pushSubscriptions.push(subscription);\n            result = 'Subscription registered: ' + subscription.endpoint\n        } else {\n            result = 'Subscription was already registered: ' + subscription.endpoint\n        }\n\n        msg.statusCode = 200;\n        break;\n    \n    case 'unsubscribe':\n        var unsubscription = msg.payload;\n        if(foundSubscriptionItems.length === 0) {\n            result = 'Subscription was not found: ' + unsubscription.endpoint\n        } else {\n            pushSubscriptions = pushSubscriptions.filter(subscriptionItem => {\n                return subscriptionItem.endpoint !== unsubscription.endpoint\n            })\n            result = 'Subscription unregistered: ' + unsubscription.endpoint\n        }\n    \n        msg.statusCode = 200;\n        break;\n    case 'reset':\n        // All push subscriptions will be removed!!!!!!!!!\n        // Make sure you know what you are doing, because you cannot send notifications to these endpoints anymore!!!!!!!!!\n        pushSubscriptions = [];\n        break;\n    default:\n        result = 'Unsupported action';\n        msg.statusCode = 400;\n}\n\nmsg.payload = { result: result }\n\n// Show the evolution in number of subscriptions\nnode.status({fill:\"green\",shape:\"dot\",text: pushSubscriptions.length + \" subscription (previously \" + totalSubscriptionLength + \")\"});\n\n// Make sure this flow variable in stored in a file, because we still need the subscriptions \n// after a flow restart (otherwise there is no way anymore to push notifications to those clients!!)\nflow.set('pushSubscriptions', pushSubscriptions, \"storeInFile\")\n  \nreturn msg;","outputs":1,"noerr":0,"x":1460,"y":220,"wires":[[]]},{"id":"80f35e5a.19337","type":"web-push","z":"4142483e.06fca8","name":"Send notification to the subscribers","vapidConfiguration":"1da91b89.be0054","x":940,"y":220,"wires":[["15d435e7.40bdea"]]},{"id":"15d435e7.40bdea","type":"function","z":"4142483e.06fca8","name":"Detect unsubscriptions","func":"for (var i = 0; i < msg.payload.failed.length; i++) {\n    var failedItem = msg.payload.failed[i];\n    \n    // When we receive HTTP status codes 404 ('Not Found') or 410 ('Gone'), this means the subscription\n    // has expired or is no longer valid.  So we have to unscribe the endpoint, to make sure we don't\n    // send notifications to that subscriber anymore, since he won't get them anyway ...\n    if (failedItem.statusCode === 410) {\n        var outputMsg = {\n            payload: {\n                action: \"unsubscribe\",\n                subscription: {\n                    endpoint: failedItem.endpoint\n                }\n            }\n        };\n\n        node.send(outputMsg);\n    }\n}","outputs":1,"noerr":0,"x":1220,"y":220,"wires":[["a07ca405.68cb78"]]},{"id":"1da91b89.be0054","type":"vapid-configuration","z":"","subject":"mailto:<your_email_address>","publicKey":"","privateKey":"","gcmApiKey":"","name":""}]
```

Although it might seem obvious to activate this option, there are major disadvantages: when a device is not reachable temporarily (battery low, poor signal, ...), it will automatically be unsubscribed.  As a result no notifications will be send to this device anymore, even when it is back online!

Therefore this is ***bad practice***, but it is added here for completeness!
