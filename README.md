Looking for a maintainer for this project, email me if you are interested.

# serverless-offline-sns
A serverless plugin to listen to offline SNS and call lambda fns with events.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
![build status](https://github.com/mj1618/serverless-offline-sns/actions/workflows/build.yml/badge.svg)
[![npm version](https://badge.fury.io/js/serverless-offline-sns.svg)](https://badge.fury.io/js/serverless-offline-sns)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![All Contributors](https://img.shields.io/badge/all_contributors-33-orange.svg?style=flat-square)](#contributors)

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
    # sns-endpoint: http://127.0.0.1:4567 # Optional. Only if you want to use a custom SNS provider endpoint
    # sns-subscribe-endpoint: http://127.0.0.1:3000 # Optional. Only if you want to use a custom subscribe endpoint from SNS to send messages back to
    # accountId: 123456789012 # Optional
    # location: .build # Optional if the location of your handler.js is not in ./ (useful for typescript)
```

For example, if you would like to connect to AWS and have callbacks coming via ngrok, use:

```YAML
serverless-offline-sns:
    sns-endpoint: sns.${self:provider.region}.amazonaws.com
    sns-subscribe-endpoint: <ngrok_url>
    remotePort: 80
    localPort: <ngrok_port>
    accountId: ${self:provider.accountId}
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
  Message: "{content: \"hello!\"}",
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
    sns-endpoint: ${env:SNS_ENDPOINT}
```

If you want to unsubscribe when you stop your server, then call `sls offline-sns cleanup` when the script exits.

## Multiple serverless services configuration

If you have multiple serverless services, please specify a root directory:
```YAML
custom:
  serverless-offline-sns:
    servicesDirectory: "/path/to/directory"
```

The root directory must contain directories with serverless.yaml files inside.

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
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/mj1618"><img src="https://avatars0.githubusercontent.com/u/6138817?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Matthew James</b></sub></a><br /><a href="#question-mj1618" title="Answering Questions">💬</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618" title="Code">💻</a> <a href="#design-mj1618" title="Design">🎨</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mj1618" title="Documentation">📖</a> <a href="#example-mj1618" title="Examples">💡</a></td>
    <td align="center"><a href="https://github.com/darbio"><img src="https://avatars0.githubusercontent.com/u/517620?v=4?s=100" width="100px;" alt=""/><br /><sub><b>darbio</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Adarbio" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=darbio" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/TiVoMaker"><img src="https://avatars2.githubusercontent.com/u/5116271?v=4?s=100" width="100px;" alt=""/><br /><sub><b>TiVoMaker</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ATiVoMaker" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker" title="Code">💻</a> <a href="#design-TiVoMaker" title="Design">🎨</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=TiVoMaker" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/jadehwangsonos"><img src="https://avatars3.githubusercontent.com/u/32281536?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jade Hwang</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Ajadehwangsonos" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/bennettrogers"><img src="https://avatars1.githubusercontent.com/u/933251?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Bennett Rogers</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Abennettrogers" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=bennettrogers" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jbreckel"><img src="https://avatars2.githubusercontent.com/u/9253219?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Julius Breckel</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jbreckel" title="Code">💻</a> <a href="#example-jbreckel" title="Examples">💡</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jbreckel" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/RainaWLK"><img src="https://avatars1.githubusercontent.com/u/29059474?v=4?s=100" width="100px;" alt=""/><br /><sub><b>RainaWLK</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ARainaWLK" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=RainaWLK" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://www.boxlightmedia.com"><img src="https://avatars2.githubusercontent.com/u/33498?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jamie Learmonth</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Ajamiel" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/gevorggalstyan"><img src="https://avatars2.githubusercontent.com/u/2598355?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Gevorg A. Galstyan</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Agevorggalstyan" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=gevorggalstyan" title="Code">💻</a></td>
    <td align="center"><a href="https://idmontie.github.io"><img src="https://avatars3.githubusercontent.com/u/412382?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ivan Montiel</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aidmontie" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=idmontie" title="Code">💻</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=idmontie" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/mledom"><img src="https://avatars0.githubusercontent.com/u/205515?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Matt Ledom</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mledom" title="Code">💻</a> <a href="#design-mledom" title="Design">🎨</a></td>
    <td align="center"><a href="http://kmfk.io"><img src="https://avatars3.githubusercontent.com/u/2430033?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Keith Kirk</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=kmfk" title="Code">💻</a> <a href="#design-kmfk" title="Design">🎨</a></td>
    <td align="center"><a href="https://github.com/kobim"><img src="https://avatars1.githubusercontent.com/u/679761?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Kobi Meirson</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=kobim" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/lagnat"><img src="https://avatars2.githubusercontent.com/u/2048655?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Steve Green</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=lagnat" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://dandoes.net"><img src="https://avatars1.githubusercontent.com/u/334487?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Daniel</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3ADanielSchaffer" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=DanielSchaffer" title="Code">💻</a> <a href="#design-DanielSchaffer" title="Design">🎨</a></td>
    <td align="center"><a href="https://zdenekfarana.com/"><img src="https://avatars2.githubusercontent.com/u/592682?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Zdenek Farana</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=byF" title="Code">💻</a></td>
    <td align="center"><a href="https://woss.io"><img src="https://avatars3.githubusercontent.com/u/80440?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Daniel Maricic</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=woss" title="Code">💻</a></td>
    <td align="center"><a href="http://www.brandonmevans.com"><img src="https://avatars1.githubusercontent.com/u/542245?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Brandon Evans</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=BrandonE" title="Code">💻</a></td>
    <td align="center"><a href="https://aaronstuyvenberg.com"><img src="https://avatars0.githubusercontent.com/u/1598537?v=4?s=100" width="100px;" alt=""/><br /><sub><b>AJ Stuyvenberg</b></sub></a><br /><a href="#question-astuyve" title="Answering Questions">💬</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=astuyve" title="Code">💻</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=astuyve" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/jkruse14"><img src="https://avatars1.githubusercontent.com/u/16331726?v=4?s=100" width="100px;" alt=""/><br /><sub><b>justin.kruse</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jkruse14" title="Tests">⚠️</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jkruse14" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Clement134"><img src="https://avatars2.githubusercontent.com/u/6473775?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Clement134</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3AClement134" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=Clement134" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/pjcav"><img src="https://avatars3.githubusercontent.com/u/33069039?v=4?s=100" width="100px;" alt=""/><br /><sub><b>PJ Cavanaugh</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Apjcav" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=pjcav" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/victorsferreira"><img src="https://avatars3.githubusercontent.com/u/25830138?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Victor Ferreira</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Avictorsferreira" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=victorsferreira" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/shierro"><img src="https://avatars2.githubusercontent.com/u/12129589?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Theo</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=shierro" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/mteleskycmp"><img src="https://avatars0.githubusercontent.com/u/47985584?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Matt Telesky</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Amteleskycmp" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mteleskycmp" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/perkyguy"><img src="https://avatars3.githubusercontent.com/u/4624648?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Garrett Scott</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aperkyguy" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=perkyguy" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Pat-rice"><img src="https://avatars3.githubusercontent.com/u/428113?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Patrice Gargiolo</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=Pat-rice" title="Documentation">📖</a></td>
    <td align="center"><a href="https://games.crossfit.com/athlete/110515"><img src="https://avatars3.githubusercontent.com/u/5074290?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Michael W. Martin</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aanaerobic" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=anaerobic" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/mr-black-8"><img src="https://avatars0.githubusercontent.com/u/18377620?v=4?s=100" width="100px;" alt=""/><br /><sub><b>mr-black-8</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Amr-black-8" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=mr-black-8" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/brocksamson"><img src="https://avatars1.githubusercontent.com/u/314629?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Matthew Miller</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Abrocksamson" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=brocksamson" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jason-adnuntius"><img src="https://avatars0.githubusercontent.com/u/52263930?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jason Pell</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jason-adnuntius" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ziktar"><img src="https://avatars2.githubusercontent.com/u/1040751?v=4?s=100" width="100px;" alt=""/><br /><sub><b>ziktar</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Aziktar" title="Bug reports">🐛</a> <a href="https://github.com/mj1618/serverless-offline-sns/commits?author=ziktar" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/stevencsf"><img src="https://avatars1.githubusercontent.com/u/7518762?v=4?s=100" width="100px;" alt=""/><br /><sub><b>stevencsf</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/issues?q=author%3Astevencsf" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/Alexandre-io"><img src="https://avatars.githubusercontent.com/u/8135542?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alexandre</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=Alexandre-io" title="Code">💻</a></td>
    <td align="center"><a href="http://kmfk.io/"><img src="https://avatars.githubusercontent.com/u/2430033?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Keith Kirk</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=k-k" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/crash7"><img src="https://avatars.githubusercontent.com/u/1450075?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Christian Musa</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=crash7" title="Code">💻</a></td>
    <td align="center"><a href="https://codepass.ca/"><img src="https://avatars.githubusercontent.com/u/1885333?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Glavin Wiechert</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=Glavin001" title="Code">💻</a></td>
    <td align="center"><a href="https://www.jagregory.com/"><img src="https://avatars.githubusercontent.com/u/10828?v=4?s=100" width="100px;" alt=""/><br /><sub><b>James Gregory</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jagregory" title="Code">💻</a></td>
    <td align="center"><a href="https://www.atheneum.ai/"><img src="https://avatars.githubusercontent.com/u/8024768?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Richard</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=richlloydmiles" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/alex-vance"><img src="https://avatars.githubusercontent.com/u/50587352?v=4?s=100" width="100px;" alt=""/><br /><sub><b>alex-vance</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=alex-vance" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/christiangoltz"><img src="https://avatars.githubusercontent.com/u/2478085?v=4?s=100" width="100px;" alt=""/><br /><sub><b>christiangoltz</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=christiangoltz" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/artem7902"><img src="https://avatars.githubusercontent.com/u/26010756?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Artem Yefimenko</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=artem7902" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/jhackshaw"><img src="https://avatars.githubusercontent.com/u/36460150?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jeff Hackshaw</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=jhackshaw" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/dsarlo"><img src="https://avatars.githubusercontent.com/u/16106087?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Daniel Sarlo</b></sub></a><br /><a href="https://github.com/mj1618/serverless-offline-sns/commits?author=dsarlo" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind welcome!
