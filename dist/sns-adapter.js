"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var AWS = require("aws-sdk");
var _ = require("lodash");
var helpers_1 = require("./helpers");
var SNSAdapter = /** @class */ (function () {
    function SNSAdapter(port, region, snsEndpoint, debug, app, serviceName, stage, accountId, host, subscribeEndpoint) {
        var _this = this;
        this.Deferred = new Promise(function (res) { return _this.sent = res; });
        this.pluginDebug = debug;
        this.port = port;
        this.app = app;
        this.serviceName = serviceName;
        this.stage = stage;
        this.adapterEndpoint = "http://" + (host || "127.0.0.1") + ":" + port;
        this.baseSubscribeEndpoint = subscribeEndpoint ? "http://" + subscribeEndpoint + ":" + port : this.adapterEndpoint;
        this.endpoint = snsEndpoint || "http://127.0.0.1:" + port;
        this.debug("using endpoint: " + this.endpoint);
        this.accountId = accountId;
        if (!AWS.config.credentials) {
            AWS.config.update({
                accessKeyId: "AKID",
                secretAccessKey: "SECRET",
                region: region,
            });
        }
        this.sns = new AWS.SNS({
            endpoint: this.endpoint,
            region: region,
        });
    }
    SNSAdapter.prototype.listSubscriptions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var req;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.debug("listing subs");
                        req = this.sns.listSubscriptions({});
                        this.debug(JSON.stringify(req.httpRequest));
                        return [4 /*yield*/, new Promise(function (res) {
                                _this.sns.listSubscriptions({}, function (err, subs) {
                                    if (err) {
                                        _this.debug(err, err.stack);
                                    }
                                    else {
                                        _this.debug(JSON.stringify(subs));
                                    }
                                    res(subs);
                                });
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SNSAdapter.prototype.unsubscribe = function (arn) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.debug("unsubscribing: " + arn);
                        return [4 /*yield*/, new Promise(function (res) {
                                _this.sns.unsubscribe({
                                    SubscriptionArn: arn,
                                }, function (err, data) {
                                    if (err) {
                                        _this.debug(err, err.stack);
                                    }
                                    else {
                                        _this.debug("unsubscribed: " + JSON.stringify(data));
                                    }
                                    res();
                                });
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SNSAdapter.prototype.createTopic = function (topicName) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (res) { return _this.sns.createTopic({ Name: topicName }, function (err, data) {
                        if (err) {
                            _this.debug(err, err.stack);
                        }
                        else {
                            _this.debug("arn: " + JSON.stringify(data));
                        }
                        res(data);
                    }); })];
            });
        });
    };
    SNSAdapter.prototype.subscribe = function (fn, getHandler, arn, snsConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var subscribeEndpoint, params;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        arn = this.convertPseudoParams(arn);
                        subscribeEndpoint = this.baseSubscribeEndpoint + "/" + fn.name;
                        this.debug("subscribe: " + fn.name + " " + arn);
                        this.debug("subscribeEndpoint: " + subscribeEndpoint);
                        this.app.post("/" + fn.name, function (req, res) {
                            _this.debug("calling fn: " + fn.name + " 1");
                            var oldEnv = _.extend({}, process.env);
                            process.env = _.extend({}, process.env, fn.environment);
                            var event = req.body;
                            if (req.is("text/plain")) {
                                event = helpers_1.createSnsEvent(event.TopicArn, "EXAMPLE", event.Subject || "", event.Message, helpers_1.createMessageId(), event.MessageAttributes || {});
                            }
                            var sendIt = function (data) {
                                res.send(data);
                                process.env = oldEnv;
                                _this.sent(data);
                            };
                            var maybePromise = getHandler()(event, _this.createLambdaContext(fn), sendIt);
                            if (maybePromise && maybePromise.then) {
                                maybePromise.then(sendIt);
                            }
                        });
                        params = {
                            Protocol: "http",
                            TopicArn: arn,
                            Endpoint: subscribeEndpoint,
                            Attributes: {},
                        };
                        if (snsConfig.rawMessageDelivery === "true") {
                            params.Attributes["RawMessageDelivery"] = "true";
                        }
                        if (snsConfig.filterPolicy) {
                            params.Attributes["FilterPolicy"] = JSON.stringify(snsConfig.filterPolicy);
                        }
                        return [4 /*yield*/, new Promise(function (res) {
                                _this.sns.subscribe(params, function (err, data) {
                                    if (err) {
                                        _this.debug(err, err.stack);
                                    }
                                    else {
                                        _this.debug("successfully subscribed fn \"" + fn.name + "\" to topic: \"" + arn + "\"");
                                    }
                                    res();
                                });
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SNSAdapter.prototype.convertPseudoParams = function (topicArn) {
        var awsRegex = /#{AWS::([a-zA-Z]+)}/g;
        return topicArn.replace(awsRegex, this.accountId);
    };
    SNSAdapter.prototype.publish = function (topicArn, message, type, messageAttributes) {
        if (type === void 0) { type = "json"; }
        if (messageAttributes === void 0) { messageAttributes = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        topicArn = this.convertPseudoParams(topicArn);
                        return [4 /*yield*/, new Promise(function (resolve, reject) { return _this.sns.publish({
                                Message: message,
                                MessageStructure: type,
                                TopicArn: topicArn,
                                MessageAttributes: messageAttributes,
                            }, function (err, result) {
                                resolve(result);
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SNSAdapter.prototype.publishToTargetArn = function (targetArn, message, type, messageAttributes) {
        if (type === void 0) { type = "json"; }
        if (messageAttributes === void 0) { messageAttributes = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        targetArn = this.convertPseudoParams(targetArn);
                        return [4 /*yield*/, new Promise(function (resolve, reject) { return _this.sns.publish({
                                Message: message,
                                MessageStructure: type,
                                TargetArn: targetArn,
                                MessageAttributes: messageAttributes,
                            }, function (err, result) {
                                resolve(result);
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SNSAdapter.prototype.publishToPhoneNumber = function (phoneNumber, message, type, messageAttributes) {
        if (type === void 0) { type = "json"; }
        if (messageAttributes === void 0) { messageAttributes = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve, reject) { return _this.sns.publish({
                            Message: message,
                            MessageStructure: type,
                            PhoneNumber: phoneNumber,
                            MessageAttributes: messageAttributes,
                        }, function (err, result) {
                            resolve(result);
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SNSAdapter.prototype.debug = function (msg, stack) {
        this.pluginDebug(msg, "adapter");
    };
    SNSAdapter.prototype.createLambdaContext = function (fun, cb) {
        var functionName = this.serviceName + "-" + this.stage + "-" + fun.name;
        var endTime = new Date().getTime() + (fun.timeout ? fun.timeout * 1000 : 6000);
        var done = typeof cb === "function" ? cb : (function (x, y) { return x || y; }); // eslint-disable-line no-extra-parens
        return {
            /* Methods */
            done: done,
            succeed: function (res) { return done(null, res); },
            fail: function (err) { return done(err, null); },
            getRemainingTimeInMillis: function () { return endTime - new Date().getTime(); },
            /* Properties */
            functionName: functionName,
            memoryLimitInMB: fun.memorySize || 1536,
            functionVersion: "offline_functionVersion_for_" + functionName,
            invokedFunctionArn: "offline_invokedFunctionArn_for_" + functionName,
            awsRequestId: "offline_awsRequestId_" + Math.random().toString(10).slice(2),
            logGroupName: "offline_logGroupName_for_" + functionName,
            logStreamName: "offline_logStreamName_for_" + functionName,
            identity: {},
            clientContext: {},
        };
    };
    return SNSAdapter;
}());
exports.SNSAdapter = SNSAdapter;
