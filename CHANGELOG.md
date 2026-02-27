# [1.0.0](https://github.com/BANCS-Norway/serverless-offline-sns/compare/v0.81.0...v1.0.0) (2026-02-27)


* feat!: drop Node 18/20, require Node 22+, support Serverless v4 ([36f274e](https://github.com/BANCS-Norway/serverless-offline-sns/commit/36f274ee3372028e6ee1bfbbb35cc58f57df86d3))
* feat!: drop servicesDirectory multi-service autoSubscribe support ([5e58ce3](https://github.com/BANCS-Norway/serverless-offline-sns/commit/5e58ce3889e03eb1206a30768727e19c055ae86e))


### Bug Fixes

* use type import for Message and --no-config for integration tests ([2609c58](https://github.com/BANCS-Norway/serverless-offline-sns/commit/2609c582816bf45088e13fab3718f22655f6a788))


### BREAKING CHANGES

* Node.js 18 and 20 are no longer supported. Minimum
required version is Node.js 22. Serverless Framework v4 is now the
supported version.

- Add engines: { node: ">=22" } to package.json
- Add .nvmrc pointing to Node 22
- Bump serverless dependency to ^4.0.0
- Update CI to use Node 22.x
- Replace body-parser with Express 5 built-in parsers
- Upgrade all dependencies to latest versions (Express 5, AWS SDK
  3.998.0, uuid 13, mocha 11, typescript 5.9, etc.)
- Remove resolutions block (no longer needed on Node 22)
- Fix integration test process cleanup using detached process group kill
- Add guard for undefined req.body in SNS server route handler
- Update integration test to use Node 22 runtime and Serverless v4

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
* The servicesDirectory config option and the ability to
auto-subscribe functions from multiple service subdirectories has been
removed. Use the Serverless Framework's built-in service configuration
instead — the full serverless object is available to the plugin at
startup. Also removes shelljs dependency.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

# [0.81.0](https://github.com/BANCS-Norway/serverless-offline-sns/compare/v0.80.0...v0.81.0) (2026-02-26)


### Bug Fixes

* deliver SNS envelope as MessageBody to SQS in non-raw mode ([#134](https://github.com/BANCS-Norway/serverless-offline-sns/issues/134)) ([ca99a2c](https://github.com/BANCS-Norway/serverless-offline-sns/commit/ca99a2c6c42a8e974825b62b0a8234f9adfaa359))
* route CloudFormation Protocol:sqs subscriptions through subscribeQueue ([#179](https://github.com/BANCS-Norway/serverless-offline-sns/issues/179)) ([88990a3](https://github.com/BANCS-Norway/serverless-offline-sns/commit/88990a386b334bd38d2c70ce0956de91174daedf))


### Features

* add HTTP delivery retry with configurable attempts and interval ([#87](https://github.com/BANCS-Norway/serverless-offline-sns/issues/87)) ([e44cb86](https://github.com/BANCS-Norway/serverless-offline-sns/commit/e44cb860499ee238a3881f91943af585707a16ea))
* support FilterPolicyScope MessageBody for subscription filter policies ([#170](https://github.com/BANCS-Norway/serverless-offline-sns/issues/170)) ([a1ee670](https://github.com/BANCS-Norway/serverless-offline-sns/commit/a1ee6709cc8e5f0dc4621b9795fd83a7a9d0ab35))
* support PublishBatch / PublishBatchCommand ([#215](https://github.com/BANCS-Norway/serverless-offline-sns/issues/215)) ([299722d](https://github.com/BANCS-Norway/serverless-offline-sns/commit/299722d3c710a8f4bb0aac774bbd402bb79cf892))

# [0.80.0](https://github.com/BANCS-Norway/serverless-offline-sns/compare/v0.79.0...v0.80.0) (2026-02-26)


### Features

* support lambda SNS subscription protocol (closes [#233](https://github.com/BANCS-Norway/serverless-offline-sns/issues/233)) ([d68de0c](https://github.com/BANCS-Norway/serverless-offline-sns/commit/d68de0cfa10ff9473d158733aa94f6c89a85e026))

# [0.79.0](https://github.com/BANCS-Norway/serverless-offline-sns/compare/v0.78.2...v0.79.0) (2026-02-26)


### Features

* use LambdaClient InvokeCommand to invoke handlers (closes [#210](https://github.com/BANCS-Norway/serverless-offline-sns/issues/210)) ([c4220e7](https://github.com/BANCS-Norway/serverless-offline-sns/commit/c4220e7c705c3eb130c6e6215ed0264bcd72520a))

## [0.78.2](https://github.com/BANCS-Norway/serverless-offline-sns/compare/v0.78.1...v0.78.2) (2026-02-25)


### Bug Fixes

* correct package.json version to 0.78.1 (closes [#239](https://github.com/BANCS-Norway/serverless-offline-sns/issues/239)) ([1e684f8](https://github.com/BANCS-Norway/serverless-offline-sns/commit/1e684f83414d1db8f0f611552455814b45683830))
* pass queueName through CloudFormation resource subscriptions to enable SNS→SQS routing ([#222](https://github.com/BANCS-Norway/serverless-offline-sns/issues/222)) ([7b4cbcc](https://github.com/BANCS-Norway/serverless-offline-sns/commit/7b4cbcc483a6e8be513364a23abe399f625d631a)), closes [#135](https://github.com/BANCS-Norway/serverless-offline-sns/issues/135) [#173](https://github.com/BANCS-Norway/serverless-offline-sns/issues/173)
* set valid version placeholder and update repo URLs to BANCS-Norway ([edc7003](https://github.com/BANCS-Norway/serverless-offline-sns/commit/edc7003e5e4196d2258263fa655ede8bf9edc9cf)), closes [#236](https://github.com/BANCS-Norway/serverless-offline-sns/issues/236)
