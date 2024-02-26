const DiscordManager = require('../managers/DiscordManager');
const logger = require('../utils/logger');
const OpenAiManager = require('../managers/OpenAiManager');
const messageResponseManager = require('../managers/messageResponseManager');
const constants = require('../config/constants'); // Ensure this is correctly imported

let isResponding = false;

async function messageHandler(originalMessage) {
    if (isResponding) {
        logger.debug("Skipping new messages until the current one is processed.");
        return;
    }
    isResponding = true;

    try {
        if (!messageResponseManager.shouldReplyToMessage(originalMessage).shouldReply) {
            logger.debug("Chose not to respond.");
            return;
        }

        // Prepare and send the initial response
        const {channelTopic, requestBody} = await prepareRequestBody(originalMessage);
        const responseContent = await new OpenAiManager().sendRequest(requestBody);

        // Send the initial response
        await sendResponse(originalMessage, responseContent);

        // Prepare and send the follow-up response if enabled
        if (constants.FOLLOW_UP_ENABLED) {
            await sendFollowUpResponse(originalMessage, channelTopic);
        }
    } catch (error) {
        logger.error(`Failed to process message: ${error}`, { errorDetail: error });
    } finally {
        isResponding = false;
    }
}

async function prepareRequestBody(originalMessage) {
    const history = await DiscordManager.getInstance().fetchMessages(originalMessage.getChannelId(), 20);
    const channel = await DiscordManager.getInstance().client.channels.fetch(originalMessage.getChannelId());
    const channelTopic = channel.topic || 'No topic set';
    const requestBody = new OpenAiManager().buildRequestBody(history, channelTopic);

    return {channelTopic, requestBody};
}

async function sendResponse(originalMessage, responseContent) {
    const messageToSend = responseContent.choices[0].message.content;
    await DiscordManager.getInstance().sendResponse(originalMessage.getChannelId(), messageToSend);
    logger.info(`Response sent: "${messageToSend}"`);
}

async function sendFollowUpResponse(originalMessage, channelTopic) {
    // Calculate follow-up delay
    const followUpDelay = Math.random() * (constants.FOLLOW_UP_MAX_DELAY - constants.FOLLOW_UP_MIN_DELAY) + constants.FOLLOW_UP_MIN_DELAY;
    await new Promise(resolve => setTimeout(resolve, followUpDelay));

    const commandSuggestions = await getCommandSuggestions();
    const followUpMessageContent = `For more interaction, try: ${commandSuggestions}.`;

    await DiscordManager.getInstance().sendResponse(originalMessage.getChannelId(), followUpMessageContent);
    logger.info(`Follow-up message sent: "${followUpMessageContent}"`);
}

async function getCommandSuggestions() {
    const commands = require('../commands/inline');
    const commandDescriptions = Object.values(commands).map(cmd => cmd.description).join('. ');
    const analysisRequestBody = {
        prompt: `Given these commands: ${commandDescriptions}, suggest one for further engagement.`,
        max_tokens: 100,
    };

    const suggestedCommandResponse = await new OpenAiManager().sendRequest(analysisRequestBody);
    return suggestedCommandResponse; // Process this as needed to extract the suggested command
}

module.exports = { messageHandler };
