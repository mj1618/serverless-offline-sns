# serverless-offline-sns
A serverless plugin to listen to offline SNS and call lambda fns with events.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/mj1618/serverless-offline-sns.svg?branch=master)](https://travis-ci.org/mj1618/serverless-offline-sns)
[![npm version](https://badge.fury.io/js/serverless-offline-sns.svg)](https://badge.fury.io/js/serverless-offline-sns)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![All Contributors](https://img.shields.io/badge/all_contributors-5-orange.svg?style=flat-square)](#contributors)


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

Configure the plugin with your offline SNS endpoint, host to listen on, and a free port the plugin can use.

```YAML
custom:
  serverless-offline-sns:
    port: 4002 # a free port for the sns server to run on
    debug: false
    # host: 0.0.0.0 # Optional, defaults to 127.0.0.1 if not provided to serverless-offline
    # sns-endpoint: http://127.0.0.1:4567 # Optional. Only if you want to use a custom endpoint
```

In normal operation, the plugin will use the same *--host* option as provided to serverless-offline. The *host* parameter as shown above overrides this setting.

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
var AWS = require("aws-sdk"); // must be npm installed to use
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

Note the region that offline-sns will listen on is what is configured in your serverless.yml provider.

## Usage

If you use [serverless-offline](https://github.com/dherault/serverless-offline) this plugin will start automatically.

However if you don't use serverless-offline you can start this plugin manually with -
```bash
serverless offline-sns start
```

## Contributors

Happy to accept contributions, [feature requests](https://github.com/mj1618/serverless-offline-sns/issues) and [issues](https://github.com/mj1618/serverless-offline-sns/issues).

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars0.githubusercontent.com/u/6138817?v=4" width="100px;"/><br /><sub><b>Matthew James</b></sub>](https://github.com/mj1618)<br />[💬](#question-mj1618 "Answering Questions") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618 "Code") [🎨](#design-mj1618 "Design") [📖](https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618 "Documentation") [💡](#example-mj1618 "Examples") | [<img src="https://avatars0.githubusercontent.com/u/517620?v=4" width="100px;"/><br /><sub><b>darbio</b></sub>](https://github.com/darbio)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Adarbio "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=darbio "Code") | [<img src="https://avatars2.githubusercontent.com/u/5116271?v=4" width="100px;"/><br /><sub><b>TiVoMaker</b></sub>](https://github.com/TiVoMaker)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ATiVoMaker "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker "Code") [🎨](#design-TiVoMaker "Design") [📖](https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker "Documentation") | [<img src="https://avatars3.githubusercontent.com/u/32281536?v=4" width="100px;"/><br /><sub><b>Jade Hwang</b></sub>](https://github.com/jadehwangsonos)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Ajadehwangsonos "Bug reports") | [<img src="https://avatars1.githubusercontent.com/u/933251?v=4" width="100px;"/><br /><sub><b>Bennett Rogers</b></sub>](https://github.com/bennettrogers)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Abennettrogers "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=bennettrogers "Code") |
| :---: | :---: | :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind welcome!
