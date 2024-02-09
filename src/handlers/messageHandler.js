// src/handlers/messageHandler.js
const logger = require('../utils/logger');
// const { isValidCommand } = require('../utils/commandUtils');
const { commandHandler } = require('./commandHandler');
const { sendLlmRequest } = require('../utils/messageUtils');
const { DecideToRespond } = require('../managers/responseManager');
const { config } = require('../config/configUtils');

const decisionManager = new DecideToRespond();

// TODO better smarts here...
/**
 * Checks if a given message content represents a valid command.
 * @param {string} content - The content of the message to check.
 * @param {string} botId - The ID of the bot to check for mentions.
 * @returns {boolean} - Returns true if the message content is a valid command.
 */
function isValidCommand(content, botId) {
    // Basic implementation: check if the message starts with a command prefix
    // You might want to extend this to check for bot mentions or specific command formats
    const commandPrefix = '!'; // Assuming commands start with '!'
    return content.startsWith(commandPrefix);
}

async function messageHandler(message) {
    // Corrected bot-to-bot mode check and logic
    if (message.author.bot && !config.BOT_TO_BOT_MODE) {
        logger.debug('Bot-to-bot interaction is disabled. Ignoring bot message.');
        return;
    }

    logger.info(`Received message: ${message.content}`);
    const botId = message.client.user.id;

    try {
        if (isValidCommand(message.content, botId)) {
            logger.debug('Valid command identified, proceeding with commandHandler.');
            await commandHandler(message);
        } else if (decisionManager.shouldReplyToMessage(botId, message)) {
            logger.debug('Decision to respond made. Generating response.');
            // Example prompt updated for clarity
            await sendLlmRequest(message, "Response based on dynamic decision making.");
        }
    } catch (error) {
        logger.error(`Error processing message: ${error.message}`, { message: message.content, error: error.stack });
        // Corrected check for responding to bot messages based on bot-to-bot mode
        if (!message.author.bot || config.BOT_TO_BOT_MODE) {
            await message.reply('An error occurred. Please try again later.');
        }
    }
}

module.exports = { messageHandler };
