"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var aws_sdk_1 = require("aws-sdk");
var node_fetch_1 = require("node-fetch");
var url_1 = require("url");
var bodyParser = require("body-parser");
var _ = require("lodash");
var xml = require("xml");
var helpers_1 = require("./helpers");
var SNSServer = /** @class */ (function () {
    function SNSServer(debug, app, region, accountId) {
        this.pluginDebug = debug;
        this.topics = [];
        this.subscriptions = [];
        this.app = app;
        this.region = region;
        this.routes();
        this.accountId = accountId;
    }
    SNSServer.prototype.routes = function () {
        var _this = this;
        this.debug("configuring route");
        this.app.use(bodyParser.json()); // for parsing application/json
        this.app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
        this.app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
        this.app.all("/", function (req, res) {
            _this.debug("hello request");
            _this.debug(JSON.stringify(req.body));
            _this.debug(JSON.stringify(_this.subscriptions));
            if (req.body.Action === "ListSubscriptions") {
                _this.debug("sending: " + xml(_this.listSubscriptions(), { indent: "\t" }));
                res.send(xml(_this.listSubscriptions()));
            }
            else if (req.body.Action === "CreateTopic") {
                res.send(xml(_this.createTopic(req.body.Name)));
            }
            else if (req.body.Action === "Subscribe") {
                res.send(xml(_this.subscribe(req.body.Endpoint, req.body.Protocol, req.body.TopicArn, req.body)));
            }
            else if (req.body.Action === "Publish") {
                var target = _this.extractTarget(req.body);
                res.send(xml(_this.publish(target, req.body.subject, req.body.Message, req.body.MessageStructure, helpers_1.parseMessageAttributes(req.body))));
            }
            else if (req.body.Action === "Unsubscribe") {
                res.send(xml(_this.unsubscribe(req.body.SubscriptionArn)));
            }
            else {
                res.send(xml({
                    NotImplementedResponse: [
                        helpers_1.createAttr(),
                        helpers_1.createMetadata(),
                    ],
                }));
            }
            _this.debug(JSON.stringify(_this.subscriptions));
        });
    };
    SNSServer.prototype.listSubscriptions = function () {
        this.debug(this.subscriptions.map(function (sub) {
            return {
                member: [sub],
            };
        }));
        return {
            ListSubscriptionsResponse: [
                helpers_1.createAttr(),
                helpers_1.createMetadata(),
                {
                    ListSubscriptionsResult: [{
                            Subscriptions: this.subscriptions.map(function (sub) {
                                return {
                                    member: helpers_1.arrayify({
                                        Endpoint: sub.Endpoint,
                                        TopicArn: sub.TopicArn,
                                        Owner: sub.Owner,
                                        Protocol: sub.Protocol,
                                        SubscriptionArn: sub.SubscriptionArn,
                                    }),
                                };
                            }),
                        }],
                },
            ],
        };
    };
    SNSServer.prototype.unsubscribe = function (arn) {
        this.debug(JSON.stringify(this.subscriptions));
        this.debug("unsubscribing: " + arn);
        this.subscriptions = this.subscriptions.filter(function (sub) { return sub.SubscriptionArn !== arn; });
        return {
            UnsubscribeResponse: [
                helpers_1.createAttr(),
                helpers_1.createMetadata(),
            ],
        };
    };
    SNSServer.prototype.createTopic = function (topicName) {
        var topic = {
            TopicArn: "arn:aws:sns:" + this.region + ":" + this.accountId + ":" + topicName,
        };
        this.topics.push(topic);
        return {
            CreateTopicResponse: [
                helpers_1.createAttr(),
                helpers_1.createMetadata(),
                {
                    CreateTopicResult: [
                        {
                            TopicArn: topic.TopicArn,
                        },
                    ],
                },
            ],
        };
    };
    SNSServer.prototype.subscribe = function (endpoint, protocol, arn, body) {
        var attributes = helpers_1.parseAttributes(body);
        var filterPolicies = attributes["FilterPolicy"] && JSON.parse(attributes["FilterPolicy"]);
        arn = this.convertPseudoParams(arn);
        var sub = {
            SubscriptionArn: arn + ":" + Math.floor(Math.random() * (1000000 - 1)),
            Protocol: protocol,
            TopicArn: arn,
            Endpoint: endpoint,
            Owner: "",
            Attributes: attributes,
            Policies: filterPolicies,
        };
        this.subscriptions.push(sub);
        return {
            SubscribeResponse: [
                helpers_1.createAttr(),
                helpers_1.createMetadata(),
                {
                    SubscribeResult: [
                        {
                            SubscriptionArn: sub.SubscriptionArn,
                        },
                    ],
                },
            ],
        };
    };
    SNSServer.prototype.evaluatePolicies = function (policies, messageAttrs) {
        var shouldSend = false;
        for (var _i = 0, _a = Object.entries(policies); _i < _a.length; _i++) {
            var _b = _a[_i], k = _b[0], v = _b[1];
            if (!messageAttrs[k]) {
                shouldSend = false;
                break;
            }
            var attrs = void 0;
            if (messageAttrs[k].Type.endsWith(".Array")) {
                attrs = JSON.parse(messageAttrs[k].Value);
            }
            else {
                attrs = [messageAttrs[k].Value];
            }
            if (_.intersection(v, attrs).length > 0) {
                this.debug("filterPolicy Passed: " + v + " matched message attrs: " + JSON.stringify(attrs));
                shouldSend = true;
            }
        }
        if (!shouldSend) {
            this.debug("filterPolicy Failed: " + JSON.stringify(policies) + " did not match message attrs: " + JSON.stringify(messageAttrs));
        }
        return shouldSend;
    };
    SNSServer.prototype.publishHttp = function (event, sub) {
        var _this = this;
        return node_fetch_1.default(sub.Endpoint, {
            method: "POST",
            body: event,
            timeout: 0,
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(event),
            },
        }).then(function (res) { return _this.debug(res); });
    };
    SNSServer.prototype.publishSqs = function (event, sub) {
        var subEndpointUrl = new url_1.URL(sub.Endpoint);
        var sqsEndpoint = subEndpointUrl.protocol + "//" + subEndpointUrl.host + "/";
        var sqs = new aws_sdk_1.SQS({ endpoint: sqsEndpoint, region: this.region });
        var records = JSON.parse(event).Records;
        var messagePromises = records.map(function (record) {
            return sqs
                .sendMessage({
                QueueUrl: sub.Endpoint,
                MessageBody: JSON.stringify(record.Sns),
            })
                .promise();
        });
        return Promise.all(messagePromises);
    };
    SNSServer.prototype.publish = function (topicArn, subject, message, messageType, messageAttributes) {
        var _this = this;
        var messageId = helpers_1.createMessageId();
        Promise.all(this.subscriptions.filter(function (sub) { return sub.TopicArn === topicArn; }).map(function (sub) {
            if (sub["Policies"] && !_this.evaluatePolicies(sub["Policies"], messageAttributes)) {
                _this.debug("Filter policies failed. Skipping subscription: " + sub.Endpoint);
                return;
            }
            _this.debug("fetching: " + sub.Endpoint);
            var event;
            if (sub["Attributes"]["RawMessageDelivery"] === "true") {
                event = message;
            }
            else {
                event = JSON.stringify(helpers_1.createSnsEvent(topicArn, sub.SubscriptionArn, subject, message, messageId, messageAttributes));
            }
            _this.debug("event: " + event);
            if (!sub.Protocol) {
                sub.Protocol = "http";
            }
            var protocol = sub.Protocol.toLowerCase();
            if (protocol === "http") {
                return _this.publishHttp(event, sub);
            }
            if (protocol === "sqs") {
                return _this.publishSqs(event, sub);
            }
            throw new Error("Protocol '" + protocol + "' is not supported by serverless-offline-sns");
        }));
        return {
            PublishResponse: [
                helpers_1.createAttr(),
                {
                    PublishResult: [
                        {
                            MessageId: messageId,
                        },
                    ],
                },
                helpers_1.createMetadata(),
            ],
        };
    };
    SNSServer.prototype.extractTarget = function (body) {
        if (!body.PhoneNumber) {
            var target = body.TopicArn || body.TargetArn;
            if (!target) {
                throw new Error("TopicArn or TargetArn is missing");
            }
            return this.convertPseudoParams(target);
        }
        else {
            return helpers_1.validatePhoneNumber(body.PhoneNumber);
        }
    };
    SNSServer.prototype.convertPseudoParams = function (topicArn) {
        var awsRegex = /#{AWS::([a-zA-Z]+)}/g;
        return topicArn.replace(awsRegex, this.accountId);
    };
    SNSServer.prototype.debug = function (msg) {
        this.pluginDebug(msg, "server");
    };
    return SNSServer;
}());
exports.SNSServer = SNSServer;
