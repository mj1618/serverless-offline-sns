"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var uuid_1 = require("uuid");
function createAttr() {
    return {
        _attr: {
            xmlns: "http://sns.amazonaws.com/doc/2010-03-31/",
        },
    };
}
exports.createAttr = createAttr;
function createMetadata() {
    return {
        ResponseMetadata: [{
                RequestId: uuid_1.v4(),
            }],
    };
}
exports.createMetadata = createMetadata;
function arrayify(obj) {
    return Object.keys(obj).map(function (key) {
        var x = {};
        x[key] = obj[key];
        return x;
    });
}
exports.arrayify = arrayify;
function parseMessageAttributes(body) {
    if (body.MessageStructure === "json") {
        return {};
    }
    var entries = Object.keys(body)
        .filter(function (key) { return key.startsWith("MessageAttributes.entry"); })
        .reduce(function (prev, key) {
        var index = key.replace("MessageAttributes.entry.", "").match(/.*?(?=\.|$)/i)[0];
        return prev.includes(index) ? prev : prev.concat([index]);
    }, []);
    return entries
        .map(function (index) { return "MessageAttributes.entry." + index; })
        .reduce(function (prev, baseKey) {
        var _a;
        return (__assign({}, prev, (_a = {}, _a["" + body[baseKey + ".Name"]] = {
            Type: body[baseKey + ".Value.DataType"],
            Value: body[baseKey + ".Value.BinaryValue"] || body[baseKey + ".Value.StringValue"],
        }, _a)));
    }, {});
}
exports.parseMessageAttributes = parseMessageAttributes;
function parseAttributes(body) {
    var indices = Object.keys(body)
        .filter(function (key) { return key.startsWith("Attributes.entry"); })
        .reduce(function (prev, key) {
        var index = key.replace("Attributes.entry.", "").match(/.*?(?=\.|$)/i)[0];
        return prev.includes(index) ? prev : prev.concat([index]);
    }, []);
    var attrs = {};
    for (var _i = 0, _a = indices.map(function (index) { return "Attributes.entry." + index; }); _i < _a.length; _i++) {
        var key = _a[_i];
        attrs[body[key + ".key"]] = body[key + ".value"];
    }
    return attrs;
}
exports.parseAttributes = parseAttributes;
function createSnsEvent(topicArn, subscriptionArn, subject, message, messageId, messageAttributes) {
    return {
        Records: [
            {
                EventVersion: "1.0",
                EventSubscriptionArn: subscriptionArn,
                EventSource: "aws:sns",
                Sns: {
                    SignatureVersion: "1",
                    Timestamp: new Date().toISOString(),
                    Signature: "EXAMPLE",
                    SigningCertUrl: "EXAMPLE",
                    MessageId: messageId,
                    Message: message,
                    MessageAttributes: messageAttributes || {},
                    Type: "Notification",
                    UnsubscribeUrl: "EXAMPLE",
                    TopicArn: topicArn,
                    Subject: subject,
                },
            },
        ],
    };
}
exports.createSnsEvent = createSnsEvent;
function createMessageId() {
    return uuid_1.v4();
}
exports.createMessageId = createMessageId;
var phoneNumberValidator = /^\++?[1-9]\d{1,14}$/;
function validatePhoneNumber(phoneNumber) {
    if (!phoneNumberValidator.test(phoneNumber)) {
        throw new Error("PhoneNumber " + phoneNumber + " is not valid to publish");
    }
    return phoneNumber;
}
exports.validatePhoneNumber = validatePhoneNumber;
