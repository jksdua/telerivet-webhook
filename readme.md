Telerivet Webhook
=================

Node.js webhook for the Telerivet SMS gateway service


Installation
------------

```bash
$ npm install telerivet-webhook
```


Usage
-----

### Get a webhook instance

```js
var WEBHOOK_SECRET = '...';

// returns an express app instance
var webhook = require('telerivet-webhook')({
	webhookSecret: WEBHOOK_SECRET
});
```

### Listen for events

```js
var EVENT_INCOMING_MESSAGE = 'incoming_message';

// parameters and event names are exactly the same as the documentation at https://telerivet.com/api/webhook
webhook.on(EVENT_INCOMING_MESSAGE, function(message) {
	console.log(message.id);
	console.log(message.type);
});
```

### Run the app

`webhook` is an express app so you can either run the app directly or mount it in another express app or http server.

```js
// option 1 - run the app
webhook.listen(3000);

// option 2 - mount the app
var app = express();
app.use('/telerivet/webhook', webhook);
app.listen(3000);
```

### Sending auto replies

Optionally, you can set `autoReply` in the options hash to send  autoreplies.

*Note:* You need to manually set the `status_secret` and `status_url` properties on the messages. Use the below code as a template. It is really important that you set `status_secret` in order to verify incoming requests.

```js
var WEBHOOK_SECRET = '...';
var STATUS_URL = '...'; // public facing webhook url

// returns an express app instance
var webhook = require('telerivet-webhook')({
	webhookSecret: WEBHOOK_SECRET,
	autoReply: function(req, res) {
		// mock mongo query
		db.messages.find({}, function(err, messages) {
			res.json({
				messages: messages.map(function(message) {
					return {
						status_secret: WEBHOOK_SECRET,
						status_url: STATUS_URL,
						to_number: message.to,
						content: message.content
					};
				});
			});
		});
	}
});
```

The above example works quite well but it would be difficult to track the message for which the Telerivet server sends the status notification. The below example shows how to handle this situation by using a custom webhook secret verifier.

```js
var EVENT_INCOMING_MESSAGE = 'incoming_message';
var WEBHOOK_SECRET = '...'; // as setup in the telerivet dashboard
var STATUS_URL = '...'; // public facing webhook url

// returns an express app instance
var webhook = require('telerivet-webhook')({
	// passed as express middleware
		// handles both incoming messages and status notifications
	webhookSecret: function(req, res, next) {
		var secret = req.body.secret || '';
		var event = req.body.event;

		// message status notification
		if (EVENT_INCOMING_MESSAGE !== event) {
			var split = secret.split(':');
			secret = split[0];
			// add the server identifier on the message for convenience
			req.body.__id = split[1];
		}

		// assert secret is correct
		if (WEBHOOK_SECRET === secret) {
			next();
		} else {
			// send Forbidden
			res.status(403).end();
		}
	},
	autoReply: function(req, res) {
		// mock
		db.messages.find({}, function(err, messages) {
			res.json({
				messages: messages.map(function(message) {
					return {
						// append the message id to the secret
							// it is very important that we use the webhook secret as well as the message id here. if we only use the message id, an attacker simply needs to know a valid database identifier which may be weak (incremental - mysql, time based - mongo etc)
						status_secret: WEBHOOK_SECRET + ':' + message._id,
						status_url: STATUS_URL,
						to_number: message.to,
						content: message.content
					};
				});
			});
		});
	}
});
```



Testing
-------

A test account has been created on the production Telerivet service. This can be used for testing this library.

Tests can be run with the following commands:

```bash
# clone the repo
$ git clone git@github.com:jksdua/telerivet-webhook.git
$ cd telerivet-webhook

# install dependencies
$ npm install

# run tests
$ npm test
```

*Note:* Credentials for the service are located in `test/config.json` file. Login and modify the webhook service to point to your public facing server.