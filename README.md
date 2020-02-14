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
+ Some browsers (e.g. Chrome) don't support self-signed certificates, so make sure to use trusted certificates (e.g. using Letsencrypt).

## Node usage
