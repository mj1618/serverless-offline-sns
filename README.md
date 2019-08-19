# serverless-offline-sns
A serverless plugin to listen to offline SNS and call lambda fns with events.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/mj1618/serverless-offline-sns.svg?branch=master)](https://travis-ci.org/mj1618/serverless-offline-sns)
[![npm version](https://badge.fury.io/js/serverless-offline-sns.svg)](https://badge.fury.io/js/serverless-offline-sns)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![All Contributors](https://img.shields.io/badge/all_contributors-31-orange.svg?style=flat-square)](#contributors)


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

Or you can use the exact ARN of the topic, in 2 ways:
```YAML
functions:
  pong:
    handler: handler.pong
    events:
      - sns:
         arn: "arn:aws:sns:us-east-1:123456789012:test-topic" # 1st way
      - sns: "arn:aws:sns:us-east-1:123456789012:test-topic-two" # 2nd way
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
<table>
  <tr>
    <td align="center"><a href="https://github.com/mj1618"><img src="https://avatars0.githubusercontent.com/u/6138817?v=4" width="100px;" alt="Matthew James"/><br /><sub><b>Matthew James</b></sub></a><br /><a href="#question-mj1618" title="Answering Questions">💬</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618" title="Code">💻</a> <a href="#design-mj1618" title="Design">🎨</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618" title="Documentation">📖</a> <a href="#example-mj1618" title="Examples">💡</a></td>
    <td align="center"><a href="https://github.com/darbio"><img src="https://avatars0.githubusercontent.com/u/517620?v=4" width="100px;" alt="darbio"/><br /><sub><b>darbio</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Adarbio" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=darbio" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/TiVoMaker"><img src="https://avatars2.githubusercontent.com/u/5116271?v=4" width="100px;" alt="TiVoMaker"/><br /><sub><b>TiVoMaker</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ATiVoMaker" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker" title="Code">💻</a> <a href="#design-TiVoMaker" title="Design">🎨</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/jadehwangsonos"><img src="https://avatars3.githubusercontent.com/u/32281536?v=4" width="100px;" alt="Jade Hwang"/><br /><sub><b>Jade Hwang</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Ajadehwangsonos" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/bennettrogers"><img src="https://avatars1.githubusercontent.com/u/933251?v=4" width="100px;" alt="Bennett Rogers"/><br /><sub><b>Bennett Rogers</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Abennettrogers" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=bennettrogers" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jbreckel"><img src="https://avatars2.githubusercontent.com/u/9253219?v=4" width="100px;" alt="Julius Breckel"/><br /><sub><b>Julius Breckel</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jbreckel" title="Code">💻</a> <a href="#example-jbreckel" title="Examples">💡</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jbreckel" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/RainaWLK"><img src="https://avatars1.githubusercontent.com/u/29059474?v=4" width="100px;" alt="RainaWLK"/><br /><sub><b>RainaWLK</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ARainaWLK" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=RainaWLK" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://www.boxlightmedia.com"><img src="https://avatars2.githubusercontent.com/u/33498?v=4" width="100px;" alt="Jamie Learmonth"/><br /><sub><b>Jamie Learmonth</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Ajamiel" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/gevorggalstyan"><img src="https://avatars2.githubusercontent.com/u/2598355?v=4" width="100px;" alt="Gevorg A. Galstyan"/><br /><sub><b>Gevorg A. Galstyan</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Agevorggalstyan" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=gevorggalstyan" title="Code">💻</a></td>
    <td align="center"><a href="https://idmontie.github.io"><img src="https://avatars3.githubusercontent.com/u/412382?v=4" width="100px;" alt="Ivan Montiel"/><br /><sub><b>Ivan Montiel</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aidmontie" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=idmontie" title="Code">💻</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=idmontie" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/mledom"><img src="https://avatars0.githubusercontent.com/u/205515?v=4" width="100px;" alt="Matt Ledom"/><br /><sub><b>Matt Ledom</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mledom" title="Code">💻</a> <a href="#design-mledom" title="Design">🎨</a></td>
    <td align="center"><a href="http://kmfk.io"><img src="https://avatars3.githubusercontent.com/u/2430033?v=4" width="100px;" alt="Keith Kirk"/><br /><sub><b>Keith Kirk</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=kmfk" title="Code">💻</a> <a href="#design-kmfk" title="Design">🎨</a></td>
    <td align="center"><a href="https://github.com/kobim"><img src="https://avatars1.githubusercontent.com/u/679761?v=4" width="100px;" alt="Kobi Meirson"/><br /><sub><b>Kobi Meirson</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=kobim" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/lagnat"><img src="https://avatars2.githubusercontent.com/u/2048655?v=4" width="100px;" alt="Steve Green"/><br /><sub><b>Steve Green</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=lagnat" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://dandoes.net"><img src="https://avatars1.githubusercontent.com/u/334487?v=4" width="100px;" alt="Daniel"/><br /><sub><b>Daniel</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ADanielSchaffer" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=DanielSchaffer" title="Code">💻</a> <a href="#design-DanielSchaffer" title="Design">🎨</a></td>
    <td align="center"><a href="https://zdenekfarana.com/"><img src="https://avatars2.githubusercontent.com/u/592682?v=4" width="100px;" alt="Zdenek Farana"/><br /><sub><b>Zdenek Farana</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=byF" title="Code">💻</a></td>
    <td align="center"><a href="https://woss.io"><img src="https://avatars3.githubusercontent.com/u/80440?v=4" width="100px;" alt="Daniel Maricic"/><br /><sub><b>Daniel Maricic</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=woss" title="Code">💻</a></td>
    <td align="center"><a href="http://www.brandonmevans.com"><img src="https://avatars1.githubusercontent.com/u/542245?v=4" width="100px;" alt="Brandon Evans"/><br /><sub><b>Brandon Evans</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=BrandonE" title="Code">💻</a></td>
    <td align="center"><a href="https://aaronstuyvenberg.com"><img src="https://avatars0.githubusercontent.com/u/1598537?v=4" width="100px;" alt="AJ Stuyvenberg"/><br /><sub><b>AJ Stuyvenberg</b></sub></a><br /><a href="#question-astuyve" title="Answering Questions">💬</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=astuyve" title="Code">💻</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=astuyve" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/jkruse14"><img src="https://avatars1.githubusercontent.com/u/16331726?v=4" width="100px;" alt="justin.kruse"/><br /><sub><b>justin.kruse</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jkruse14" title="Tests">⚠️</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jkruse14" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Clement134"><img src="https://avatars2.githubusercontent.com/u/6473775?v=4" width="100px;" alt="Clement134"/><br /><sub><b>Clement134</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3AClement134" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=Clement134" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/pjcav"><img src="https://avatars3.githubusercontent.com/u/33069039?v=4" width="100px;" alt="PJ Cavanaugh"/><br /><sub><b>PJ Cavanaugh</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Apjcav" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=pjcav" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/victorsferreira"><img src="https://avatars3.githubusercontent.com/u/25830138?v=4" width="100px;" alt="Victor Ferreira"/><br /><sub><b>Victor Ferreira</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Avictorsferreira" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=victorsferreira" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/shierro"><img src="https://avatars2.githubusercontent.com/u/12129589?v=4" width="100px;" alt="Theo"/><br /><sub><b>Theo</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=shierro" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/mteleskycmp"><img src="https://avatars0.githubusercontent.com/u/47985584?v=4" width="100px;" alt="Matt Telesky"/><br /><sub><b>Matt Telesky</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Amteleskycmp" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mteleskycmp" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/perkyguy"><img src="https://avatars3.githubusercontent.com/u/4624648?v=4" width="100px;" alt="Garrett Scott"/><br /><sub><b>Garrett Scott</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aperkyguy" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=perkyguy" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Pat-rice"><img src="https://avatars3.githubusercontent.com/u/428113?v=4" width="100px;" alt="Patrice Gargiolo"/><br /><sub><b>Patrice Gargiolo</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=Pat-rice" title="Documentation">📖</a></td>
    <td align="center"><a href="https://games.crossfit.com/athlete/110515"><img src="https://avatars3.githubusercontent.com/u/5074290?v=4" width="100px;" alt="Michael W. Martin"/><br /><sub><b>Michael W. Martin</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aanaerobic" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=anaerobic" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/mr-black-8"><img src="https://avatars0.githubusercontent.com/u/18377620?v=4" width="100px;" alt="mr-black-8"/><br /><sub><b>mr-black-8</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Amr-black-8" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mr-black-8" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/brocksamson"><img src="https://avatars1.githubusercontent.com/u/314629?v=4" width="100px;" alt="Matthew Miller"/><br /><sub><b>Matthew Miller</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Abrocksamson" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=brocksamson" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jason-adnuntius"><img src="https://avatars0.githubusercontent.com/u/52263930?v=4" width="100px;" alt="Jason Pell"/><br /><sub><b>Jason Pell</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jason-adnuntius" title="Code">💻</a></td>
  </tr>
</table>

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind welcome!
