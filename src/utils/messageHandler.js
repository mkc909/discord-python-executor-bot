const axios = require('axios');
const fetchConversationHistory = require('./fetchConversationHistory');
const { DecideToRespond } = require('./responseDecider');
const getRandomErrorMessage = require('./errorMessages');
const logger = require('./logger');

// Constants
const MODEL_TO_USE = process.env.LLM_MODEL || 'mistral-7b-instruct';
const LLM_ENDPOINT_URL = process.env.LLM_ENDPOINT_URL;
const SYSTEM_PROMPT = process.env.LLM_SYSTEM_PROMPT || 'You are a helpful assistant.';
const BOT_TO_BOT_MODE = process.env.BOT_TO_BOT_MODE !== 'false';
const API_KEY = process.env.LLM_API_KEY;
const MAX_CONTENT_LENGTH = parseInt(process.env.LLM_MAX_CONTEXT_SIZE || '4096', 10);

// Response Decider Singleton
const responseDecider = new DecideToRespond({
    disableUnsolicitedReplies: false,
    unsolicitedChannelCap: 5,
    ignore_dms: true
});

// Validate Request Body
function validateRequestBody(requestBody) {
    if (!requestBody || !Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
        logger.debug("Validation failed for requestBody:", JSON.stringify(requestBody));
        return false;
    }
    logger.debug("Validation passed for requestBody.");
    return true;
}

// Process LLM Response
function processResponse(data) {
    if (data && data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
    }
    return 'No response from the server.';
}

// Build Request Body
function buildRequestBody(historyMessages, userMessage, message) {
    let requestBody = { model: MODEL_TO_USE, messages: [{ role: 'system', content: SYSTEM_PROMPT }] };      
    let currentSize = JSON.stringify(requestBody).length;

    historyMessages.slice().reverse().forEach(msg => {
        const authorId = msg.author ? msg.author.id : 'unknown-author';
        const formattedMessage = `<@${authorId}>: ${msg.content}`;
        const messageObj = { role: 'user', content: formattedMessage };
        currentSize += JSON.stringify(messageObj).length;

        if (currentSize <= MAX_CONTENT_LENGTH) {
            requestBody.messages.push(messageObj);
        }
    });

    requestBody.messages.push({ role: 'user', content: userMessage });

    logger.debug("Constructed request body:", JSON.stringify(requestBody));
    return requestBody;
}

// Send LLM Request
async function sendLlmRequest(message) {
    try {
        const historyMessages = await fetchConversationHistory(message.channel);
        const requestBody = buildRequestBody(historyMessages, message.content, message);

        if (!validateRequestBody(requestBody)) {
            throw new Error('Invalid request body');
        }

        const response = await axios.post(LLM_ENDPOINT_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` })
            }
        });

        const replyContent = (response.status === 200 && response.data) ? processResponse(response.data) : 'No response from the server.';
        if (replyContent && replyContent.trim() !== '') {
            await message.reply(replyContent);
            responseDecider.logMention(message.channel.id, Date.now());
        } else {
            logger.debug("LLM returned an empty or invalid response.");
        }
    } catch (error) {
        logger.error(`Error in sendLlmRequest: ${error.message}`);
        await message.reply(getRandomErrorMessage());
    }
}

// Message Handler
async function messageHandler(message) {
    if (message.author.bot && !BOT_TO_BOT_MODE) {
        logger.debug("Ignoring bot message as BOT_TO_BOT_MODE is disabled.");
        return;
    }

    // Decide whether to respond to the message
    const { shouldReply } = responseDecider.shouldReplyToMessage(message.client.user.id, message);
    if (shouldReply) {
        logger.info("Decided to respond to the message.");
        await sendLlmRequest(message);
    } else {
        logger.info("Decided not to respond to the message.");
    }
}

module.exports = messageHandler;
