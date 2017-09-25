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

## Prerequisites

To use this plugin you will need an SNS endpoint. You can use your AWS account for SNS or you can use the built in SNS offline server -
```bash
serverless offline-sns serve
```

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
    port: 4002 # port for the sns server to run on
    serve: true # should start an offline SNS server? only need one of these
    debug: false
    sns-endpoint: http://127.0.0.1:4567 # optional if you want to point at a different SNS endpoint
```

## Configure

Configure your function handlers with events as described in the [Serverless SNS Documentation](https://serverless.com/framework/docs/providers/aws/events/sns/)

Here's an example `serverless.yml` config which calls a function on an SNS notifcation. Note that the offline-sns plugin will automatically pick up this config, subscribe to the topic and call the handler on an SNS notification.

```YAML
functions:
  pong:
    handler: dist/services/hello/index.pong
    events:
      - sns: test-topic
```

Or you can use the exact ARN of the topic:
```YAML
functions:
  pong:
    handler: dist/services/hello/index.pong
    events:
      - sns:
        arn: "arn:aws:sns:us-east-1:123456789012:test-topic"
```

Here's a demo of some code that will trigger this handler:

```javascript
import AWS = require("aws-sdk");
const sns = new AWS.SNS({
    endpoint: "http://127.0.0.1:4002",
    region: "us-east-1",
});
sns.publish({
    Message: "hello!",
    MessageStructure: "json",
    TopicArn: "arn:aws:sns:us-east-1:123456789012:test-topic",
});
```

## Usage

If you use [serverless-offline](https://github.com/dherault/serverless-offline) this plugin will start automatically.

However if you don't use serverless-offline you can start this plugin manually with -
```bash
serverless offline-sns start
```

## Contributions and Issues

