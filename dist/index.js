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
var sns_adapter_1 = require("./sns-adapter");
var express = require("express");
var cors = require("cors");
var bodyParser = require("body-parser");
var sns_server_1 = require("./sns-server");
var _ = require("lodash");
var AWS = require("aws-sdk");
var path_1 = require("path");
var ServerlessOfflineSns = /** @class */ (function () {
    function ServerlessOfflineSns(serverless, options) {
        var _this = this;
        this.app = express();
        this.app.use(cors());
        this.app.use(bodyParser.json({ type: ["application/json", "text/plain"] }));
        this.options = options;
        this.serverless = serverless;
        this.commands = {
            "offline-sns": {
                usage: "Listens to offline SNS events and passes them to configured Lambda fns",
                lifecycleEvents: [
                    "start",
                ],
                commands: {
                    start: {
                        lifecycleEvents: [
                            "init",
                            "end",
                        ],
                    },
                },
            },
        };
        this.hooks = {
            "before:offline:start:init": function () { return _this.start(); },
            "after:offline:start:end": function () { return _this.stop(); },
            "offline-sns:start:init": function () {
                _this.start();
                return _this.waitForSigint();
            },
            "offline-sns:start:end": function () { return _this.stop(); },
        };
    }
    ServerlessOfflineSns.prototype.init = function () {
        process.env = _.extend({}, this.serverless.service.provider.environment, process.env);
        this.config = this.serverless.service.custom["serverless-offline-sns"] || {};
        this.port = this.config.port || 4002;
        this.accountId = this.config.accountId || "123456789012";
        var offlineConfig = this.serverless.service.custom["serverless-offline"] || {};
        this.location = process.cwd();
        var locationRelativeToCwd = this.options.location || offlineConfig.location;
        if (locationRelativeToCwd) {
            this.location = process.cwd() + "/" + locationRelativeToCwd;
        }
        else if (this.serverless.config.servicePath) {
            this.location = this.serverless.config.servicePath;
        }
        if (this.serverless.service.provider.region) {
            this.region = this.serverless.service.provider.region;
        }
        else {
            this.region = "us-east-1";
        }
        // Congure SNS client to be able to find us.
        AWS.config.sns = {
            endpoint: "http://127.0.0.1:" + this.port,
            region: this.region,
        };
    };
    ServerlessOfflineSns.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.init();
                        return [4 /*yield*/, this.listen()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.serve()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.subscribeAll()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, this.snsAdapter];
                }
            });
        });
    };
    ServerlessOfflineSns.prototype.waitForSigint = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (res) {
                        process.on("SIGINT", function () {
                            _this.log("Halting offline-sns server");
                            res();
                        });
                    })];
            });
        });
    };
    ServerlessOfflineSns.prototype.serve = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.snsServer = new sns_server_1.SNSServer(function (msg, ctx) { return _this.debug(msg, ctx); }, this.app, this.region, this.accountId);
                return [2 /*return*/];
            });
        });
    };
    ServerlessOfflineSns.prototype.subscribeAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.snsAdapter = new sns_adapter_1.SNSAdapter(this.port, this.serverless.service.provider.region, this.config["sns-endpoint"], function (msg, ctx) { return _this.debug(msg, ctx); }, this.app, this.serverless.service.service, this.serverless.service.provider.stage, this.accountId, this.config.host, this.config["sns-subscribe-endpoint"]);
                        return [4 /*yield*/, this.unsubscribeAll()];
                    case 1:
                        _a.sent();
                        this.debug("subscribing");
                        return [4 /*yield*/, Promise.all(Object.keys(this.serverless.service.functions).map(function (fnName) {
                                var fn = _this.serverless.service.functions[fnName];
                                return Promise.all(fn.events.filter(function (event) { return event.sns != null; }).map(function (event) {
                                    return _this.subscribe(fnName, event.sns);
                                }));
                            }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ServerlessOfflineSns.prototype.unsubscribeAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var subs;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.snsAdapter.listSubscriptions()];
                    case 1:
                        subs = _a.sent();
                        this.debug("subs!: " + JSON.stringify(subs));
                        return [4 /*yield*/, Promise.all(subs.Subscriptions
                                .filter(function (sub) { return sub.Endpoint.indexOf(":" + _this.port) > -1; })
                                .map(function (sub) { return _this.snsAdapter.unsubscribe(sub.SubscriptionArn); }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ServerlessOfflineSns.prototype.subscribe = function (fnName, snsConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var fn, topicName, snsConfigParts, data;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.debug("subscribe: " + fnName);
                        fn = this.serverless.service.functions[fnName];
                        if (!(typeof snsConfig === "string" || typeof snsConfig.topicName === "string")) return [3 /*break*/, 3];
                        topicName = "";
                        // According to Serverless docs, if the sns config is a string,
                        // that string must be the topic ARN:
                        // https://serverless.com/framework/docs/providers/aws/events/sns#using-a-pre-existing-topic
                        if (typeof snsConfig === "string" && snsConfig.indexOf("arn:aws:sns") === 0) {
                            snsConfigParts = snsConfig.split(":");
                            // the topics name is that last part of the ARN:
                            // arn:aws:sns:<REGION>:<ACCOUNT_ID>:<TOPIC_NAME>
                            topicName = snsConfigParts[snsConfigParts.length - 1];
                        }
                        else if (snsConfig.topicName && typeof snsConfig.topicName === "string") {
                            topicName = snsConfig.topicName;
                        }
                        if (!topicName) {
                            return [2 /*return*/, Promise.resolve("Unable to create topic for \"" + fnName + "\". Please ensure the sns configuration is correct.")];
                        }
                        this.log("Creating topic: \"" + topicName + "\" for fn \"" + fnName + "\"");
                        return [4 /*yield*/, this.snsAdapter.createTopic(topicName)];
                    case 1:
                        data = _a.sent();
                        this.debug("topic: " + JSON.stringify(data));
                        return [4 /*yield*/, this.snsAdapter.subscribe(fn, function () { return _this.createHandler(fn); }, data.TopicArn, snsConfig)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 3:
                        if (!(typeof snsConfig.arn === "string")) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.snsAdapter.subscribe(fn, function () { return _this.createHandler(fn); }, snsConfig.arn, snsConfig)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        this.log("unsupported config: " + snsConfig);
                        return [2 /*return*/, Promise.resolve("unsupported config: " + snsConfig)];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    ServerlessOfflineSns.prototype.createHandler = function (fn) {
        // use the main serverless config since this behavior is already supported there
        if (!this.options.skipCacheInvalidation || Array.isArray(this.options.skipCacheInvalidation)) {
            var _loop_1 = function (key) {
                // don't invalidate cached modules from node_modules ...
                if (key.match(/node_modules/)) {
                    return "continue";
                }
                // if an array is provided to the serverless config, check the entries there too
                if (Array.isArray(this_1.options.skipCacheInvalidation) &&
                    this_1.options.skipCacheInvalidation.find(function (pattern) { return new RegExp(pattern).test(key); })) {
                    return "continue";
                }
                delete require.cache[key];
            };
            var this_1 = this;
            for (var key in require.cache) {
                _loop_1(key);
            }
        }
        this.debug(process.cwd());
        var handlerFnNameIndex = fn.handler.lastIndexOf(".");
        var handlerPath = fn.handler.substring(0, handlerFnNameIndex);
        var handlerFnName = fn.handler.substring(handlerFnNameIndex + 1);
        var fullHandlerPath = path_1.resolve(this.location, handlerPath);
        this.debug("require(" + fullHandlerPath + ")[" + handlerFnName + "]");
        var handler = require(fullHandlerPath)[handlerFnName];
        return handler;
    };
    ServerlessOfflineSns.prototype.log = function (msg, prefix) {
        if (prefix === void 0) { prefix = "INFO[serverless-offline-sns]: "; }
        this.serverless.cli.log.call(this.serverless.cli, prefix + msg);
    };
    ServerlessOfflineSns.prototype.debug = function (msg, context) {
        if (this.config.debug) {
            if (context) {
                this.log(msg, "DEBUG[serverless-offline-sns][" + context + "]: ");
            }
            else {
                this.log(msg, "DEBUG[serverless-offline-sns]: ");
            }
        }
    };
    ServerlessOfflineSns.prototype.listen = function () {
        return __awaiter(this, void 0, void 0, function () {
            var host;
            var _this = this;
            return __generator(this, function (_a) {
                this.debug("starting plugin");
                host = "127.0.0.1";
                if (this.config.host) {
                    this.debug("using specified host " + this.config.host);
                    host = this.config.host;
                }
                else if (this.options.host) {
                    this.debug("using offline specified host " + this.options.host);
                    host = this.options.host;
                }
                return [2 /*return*/, new Promise(function (res) {
                        _this.server = _this.app.listen(_this.port, host, function () {
                            _this.debug("listening on " + host + ":" + _this.port);
                            res();
                        });
                    })];
            });
        });
    };
    ServerlessOfflineSns.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.init();
                this.debug("stopping plugin");
                if (this.server) {
                    this.server.close();
                }
                return [2 /*return*/];
            });
        });
    };
    return ServerlessOfflineSns;
}());
module.exports = ServerlessOfflineSns;
