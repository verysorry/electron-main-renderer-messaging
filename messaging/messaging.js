/*!
 * Copyright (c) 2021, Andrew Petrov <code@sun.click>
 * This source code is licensed under the MIT license.
 * See LICENSE.txt file in the root directory of this source tree.
 */

let seed = 1;
let emitterObj = null;
let listenerObj = null;

/**
 * Initialization
 * @param {EventEmitter}   listener - Event listener
 * @param {EventEmitter?}  emitter  - Optional event emitter (listener will be used otherwise)
 * @param {Function}       callback - Callback function (action, optionalData, event, receivedMessageId)
 */
export function initMessaging(listener, emitter, callback) {
    if (emitterObj) {
        throw new Error('Already initialized');
    }
    emitter = emitter || listener;
    if (!listener || !callback) {
        throw new Error('Invalid parameters');
    }

    listenerObj = listener;
    emitterObj = emitter;
    listenerObj.on('message-request', (event, message) => {
        callback(message.action, message.data, event, message.id);
    });
}

/**
 * Sends a message one-way (does not expect any reply)
 * @param {string}   action - Message signature ("action" name)
 * @param {Any}      data   - Extra data if required
 */
export function sendMessageOneWay(action, data) {
    return sendMessageRequest(action, data, 0);
}

/**
 * Sends a reply to the message received from the opposite side
 * @param {string}   messageId - Incoming message signature
 * @param {Any}      data      - Any data to reply with
 * @param {Event}    event     - Incoming event
 */
export function sendMessageReply(messageId, data, event) {
    if (event && event.reply) {
        // console.debug('Sending reply (via event)', data);
        event.reply(messageId, data);
    }
    else {
        // console.debug('Sending reply (via emitter)', data);
        emitterObj.send(messageId, data);
    }
}

/**
 * Sends a message, optionally waiting for reply
 * @param {string}   action  - Message name ("action")
 * @param {Any}      data    - Extra data for the message if required
 * @param {number?}  timeout - '-1' (or any negative) - wait forever, 0 - do not expect reply (one way), positive - timeout, ms. Default = 2000
 * @returns {Promise<any>} - Reply
 */

export function sendMessageRequest(action, data, timeout) {
    const oneWay = timeout === 0;
    const infinite = timeout && timeout < 0;

    if (!oneWay && !infinite && !timeout) {
        timeout = timeout || 2000;
    }

    const message = {
        id: `msg-${seed++}-${Date.now()}`,
        action,
        data
    };

    return new Promise((resolve, reject) => {

        let timer = null;
        if (!oneWay && !infinite) {
            timer = setTimeout(() => {
                timer = null;
                listenerObj.removeAllListeners(message.id);
                console.warn(`[${message.id}] '${action}' Time out`);
                reject('Timed out');
            }, timeout);
        }

        if (!oneWay) {
            listenerObj.once(message.id, (_, reply) => {

                if (!infinite && !timer) { // Should never happen
                    console.warn(`[${message.id}] '${action}' Timed out reply [${reply.id}]`);
                    return; // Already timed out
                }

                if (timer) {
                    clearTimeout(timer);
                }

                resolve(reply);
            });
        }

        emitterObj.send('message-request', message);
    });
}
