# serverless-offline-sns
A serverless plugin to listen to offline SNS and call lambda fns with events.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/mj1618/serverless-offline-sns.svg?branch=master)](https://travis-ci.org/mj1618/serverless-offline-sns)
[![npm version](https://badge.fury.io/js/serverless-offline-sns.svg)](https://badge.fury.io/js/serverless-offline-sns)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![All Contributors](https://img.shields.io/badge/all_contributors-20-orange.svg?style=flat-square)](#contributors)


## Docs
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configure](#configure)
- [Usage](#usage)
- [Contributors](#contributors)

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

Note that ordering matters when used with serverless-offline and serverless-webpack. serverless-webpack must be specified at the start of the list of plugins.

Configure the plugin with your offline SNS endpoint, host to listen on, and a free port the plugin can use.

```YAML
custom:
  serverless-offline-sns:
    port: 4002 # a free port for the sns server to run on
    debug: false
    # host: 0.0.0.0 # Optional, defaults to 127.0.0.1 if not provided to serverless-offline
    # sns-endpoint: http://127.0.0.1:4567 # Optional. Only if you want to use a custom endpoint
    # accountId: 123456789012 # Optional
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

## Localstack docker configuration
In order to listen to localstack SNS event, if localstack is started with docker, you need the following:
```YAML
custom:
  serverless-offline-sns:
    host: 0.0.0.0 # Enable plugin to listen on every local address
    sns-subscribe-endpoint: 192.168.1.225 #Host ip address
    sns-endpoint: http://localhost:4575 # Default localstack sns endpoint
```
What happens is that the container running localstack will execute a POST request to the plugin, but to reach outside the container, it needs to use the host ip address.

## Hosted AWS SNS configuration

In order to listen to a hosted SNS on AWS, you need the following:
```YAML
custom:
  serverless-offline-sns:
    localPort: ${env:LOCAL_PORT}
    remotePort: ${env:SNS_SUBSCRIBE_REMOTE_PORT}
    host: 0.0.0.0
    sns-subscribe-endpoint: ${env:SNS_SUBSCRIBE_ENDPOINT}
    sns-endpoint: ${env:SNS_ENDPOINT}```
```

If you want to unsubscribe when you stop your server, then call `sls offline-sns cleanup` when the script exits.

## Usage

If you use [serverless-offline](https://github.com/dherault/serverless-offline) this plugin will start automatically.

However if you don't use serverless-offline you can start this plugin manually with -
```bash
serverless offline-sns start
```

### Subscribing

`serverless-offline-sns` supports `http`, `https`, and `sqs` subscriptions. `email`, `email-json`,
`sms`, `application`, and `lambda` protocols are not supported at this time.

When using `sqs` the `Endpoint` for the subscription must be the full `QueueUrl` returned from
the SQS service when creating the queue or listing with `ListQueues`:

```javascript
// async
const queue = await sqs.createQueue({ QueueName: 'my-queue' }).promise();
const subscription = await sns.subscribe({
    TopicArn: myTopicArn,
    Protocol: 'sqs',
    Endpoint: queue.QueueUrl,
}).promise();
```

## Contributors

Happy to accept contributions, [feature requests](https://github.com/mj1618/serverless-offline-sns/issues) and [issues](https://github.com/mj1618/serverless-offline-sns/issues).

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
| [<img src="https://avatars0.githubusercontent.com/u/6138817?v=4" width="100px;" alt="Matthew James"/><br /><sub><b>Matthew James</b></sub>](https://github.com/mj1618)<br />[💬](#question-mj1618 "Answering Questions") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618 "Code") [🎨](#design-mj1618 "Design") [📖](https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618 "Documentation") [💡](#example-mj1618 "Examples") | [<img src="https://avatars0.githubusercontent.com/u/517620?v=4" width="100px;" alt="darbio"/><br /><sub><b>darbio</b></sub>](https://github.com/darbio)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Adarbio "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=darbio "Code") | [<img src="https://avatars2.githubusercontent.com/u/5116271?v=4" width="100px;" alt="TiVoMaker"/><br /><sub><b>TiVoMaker</b></sub>](https://github.com/TiVoMaker)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ATiVoMaker "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker "Code") [🎨](#design-TiVoMaker "Design") [📖](https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker "Documentation") | [<img src="https://avatars3.githubusercontent.com/u/32281536?v=4" width="100px;" alt="Jade Hwang"/><br /><sub><b>Jade Hwang</b></sub>](https://github.com/jadehwangsonos)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Ajadehwangsonos "Bug reports") | [<img src="https://avatars1.githubusercontent.com/u/933251?v=4" width="100px;" alt="Bennett Rogers"/><br /><sub><b>Bennett Rogers</b></sub>](https://github.com/bennettrogers)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Abennettrogers "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=bennettrogers "Code") | [<img src="https://avatars2.githubusercontent.com/u/9253219?v=4" width="100px;" alt="Julius Breckel"/><br /><sub><b>Julius Breckel</b></sub>](https://github.com/jbreckel)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=jbreckel "Code") [💡](#example-jbreckel "Examples") [⚠️](https://github.com/mj1618/serverless-offline-sns/commits?author=jbreckel "Tests") | [<img src="https://avatars1.githubusercontent.com/u/29059474?v=4" width="100px;" alt="RainaWLK"/><br /><sub><b>RainaWLK</b></sub>](https://github.com/RainaWLK)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ARainaWLK "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=RainaWLK "Code") |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [<img src="https://avatars2.githubusercontent.com/u/33498?v=4" width="100px;" alt="Jamie Learmonth"/><br /><sub><b>Jamie Learmonth</b></sub>](http://www.boxlightmedia.com)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Ajamiel "Bug reports") | [<img src="https://avatars2.githubusercontent.com/u/2598355?v=4" width="100px;" alt="Gevorg A. Galstyan"/><br /><sub><b>Gevorg A. Galstyan</b></sub>](https://github.com/gevorggalstyan)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Agevorggalstyan "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=gevorggalstyan "Code") | [<img src="https://avatars3.githubusercontent.com/u/412382?v=4" width="100px;" alt="Ivan Montiel"/><br /><sub><b>Ivan Montiel</b></sub>](https://idmontie.github.io)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aidmontie "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=idmontie "Code") [⚠️](https://github.com/mj1618/serverless-offline-sns/commits?author=idmontie "Tests") | [<img src="https://avatars0.githubusercontent.com/u/205515?v=4" width="100px;" alt="Matt Ledom"/><br /><sub><b>Matt Ledom</b></sub>](https://github.com/mledom)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=mledom "Code") [🎨](#design-mledom "Design") | [<img src="https://avatars3.githubusercontent.com/u/2430033?v=4" width="100px;" alt="Keith Kirk"/><br /><sub><b>Keith Kirk</b></sub>](http://kmfk.io)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=kmfk "Code") [🎨](#design-kmfk "Design") | [<img src="https://avatars1.githubusercontent.com/u/679761?v=4" width="100px;" alt="Kobi Meirson"/><br /><sub><b>Kobi Meirson</b></sub>](https://github.com/kobim)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=kobim "Code") | [<img src="https://avatars2.githubusercontent.com/u/2048655?v=4" width="100px;" alt="Steve Green"/><br /><sub><b>Steve Green</b></sub>](https://github.com/lagnat)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=lagnat "Code") |
| [<img src="https://avatars1.githubusercontent.com/u/334487?v=4" width="100px;" alt="Daniel"/><br /><sub><b>Daniel</b></sub>](http://dandoes.net)<br />[🐛](https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ADanielSchaffer "Bug reports") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=DanielSchaffer "Code") [🎨](#design-DanielSchaffer "Design") | [<img src="https://avatars2.githubusercontent.com/u/592682?v=4" width="100px;" alt="Zdenek Farana"/><br /><sub><b>Zdenek Farana</b></sub>](https://zdenekfarana.com/)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=byF "Code") | [<img src="https://avatars3.githubusercontent.com/u/80440?v=4" width="100px;" alt="Daniel Maricic"/><br /><sub><b>Daniel Maricic</b></sub>](https://woss.io)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=woss "Code") | [<img src="https://avatars1.githubusercontent.com/u/542245?v=4" width="100px;" alt="Brandon Evans"/><br /><sub><b>Brandon Evans</b></sub>](http://www.brandonmevans.com)<br />[💻](https://github.com/mj1618/serverless-offline-sns/commits?author=BrandonE "Code") | [<img src="https://avatars0.githubusercontent.com/u/1598537?v=4" width="100px;" alt="AJ Stuyvenberg"/><br /><sub><b>AJ Stuyvenberg</b></sub>](https://aaronstuyvenberg.com)<br />[💬](#question-astuyve "Answering Questions") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=astuyve "Code") [⚠️](https://github.com/mj1618/serverless-offline-sns/commits?author=astuyve "Tests") | [<img src="https://avatars1.githubusercontent.com/u/16331726?v=4" width="100px;" alt="justin.kruse"/><br /><sub><b>justin.kruse</b></sub>](https://github.com/jkruse14)<br />[⚠️](https://github.com/mj1618/serverless-offline-sns/commits?author=jkruse14 "Tests") [💻](https://github.com/mj1618/serverless-offline-sns/commits?author=jkruse14 "Code") |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind welcome!
