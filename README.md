# serverless-offline-sns
A serverless plugin to listen to offline SNS and call lambda fns with events.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/mj1618/serverless-offline-sns.svg?branch=master)](https://travis-ci.org/mj1618/serverless-offline-sns)
[![npm version](https://badge.fury.io/js/serverless-offline-sns.svg)](https://badge.fury.io/js/serverless-offline-sns)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


## Docs
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configure](#configure)
- [Usage](#usage)
- [Contributions and Issues](#contributions-and-issues)

For an example of a working application please see [serverless-offline-sns-example](https://github.com/mj1618/serverless-offline-sns-example)

## Prerequisites

This plugin provides an SNS server configured automatically without you specifying an endpoint.

If you'd rather use your own endpoint, e.g. from your AWS account or a [localstack](https://github.com/localstack/localstack) SNS server endpoint, you can put it in the custom config. See below for details.

## Installation

Install the plugin
```bash
npm install serverless-offline-sns --save
```

Let serverless know about the plugin
```YAML
plugins:
  - serverless-offline-sns
```

Configure the plugin with your offline SNS endpoint and a free port the plugin can use.
```YAML
custom:
  serverless-offline-sns:
    port: 4002 # a free port for the sns server to run on
    debug: false
    # sns-endpoint: http://127.0.0.1:4567 # Optional. Only if you want to use a custom endpoint
```

If you are using the [serverless-offline](https://github.com/dherault/serverless-offline) plugin serverless-offline-sns will start automatically. If you are not using this plugin you can run the following command instead:
```bash
serverless offline-sns start
```

## Configure

Configure your function handlers with events as described in the [Serverless SNS Documentation](https://serverless.com/framework/docs/providers/aws/events/sns/)

Here's an example `serverless.yml` config which calls a function on an SNS notifcation. Note that the offline-sns plugin will automatically pick up this config, subscribe to the topic and call the handler on an SNS notification.

```YAML
functions:
  pong:
    handler: handler.pong
    events:
      - sns: test-topic
```

Or you can use the exact ARN of the topic:
```YAML
functions:
  pong:
    handler: handler.pong
    events:
      - sns:
        arn: "arn:aws:sns:us-east-1:123456789012:test-topic"
```

Here's a demo of some code that will trigger this handler:

```javascript
var sns = new AWS.SNS({
  endpoint: "http://127.0.0.1:4002",
  region: "us-east-1",
});
sns.publish({
  Message: "hello!",
  MessageStructure: "json",
  TopicArn: "arn:aws:sns:us-east-1:123456789012:test-topic",
}, () => {
  console.log("ping");
});
```

## Usage



If you use [serverless-offline](https://github.com/dherault/serverless-offline) this plugin will start automatically.

However if you don't use serverless-offline you can start this plugin manually with -
```bash
serverless offline-sns start
```

## Contributions and Issues

Happy to accept contributions, [feature requests](https://github.com/mj1618/serverless-offline-sns/issues) and [issues](https://github.com/mj1618/serverless-offline-sns/issues).