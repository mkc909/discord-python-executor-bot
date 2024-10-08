import logger from '@utils/logger';
import fetchConversationHistory from './fetchConversationHistory';
import { getRandomAliasCommand } from './aliasUtils';
import { sendLlmRequest } from './sendLlmRequest';

/**
 * Determines if a follow-up should be sent based on recent conversation history.
 * @param {any} message - The message object.
 * @param {number} threshold - The threshold for deciding if a follow-up is needed.
 * @returns {Promise<boolean>} - True if a follow-up should be sent, otherwise false.
 */
export async function shouldSendFollowUp(message: any, threshold: number): Promise<boolean> {
    try {
        const recentMessages = await fetchConversationHistory(message.channel);
        return recentMessages.length <= threshold;
    } catch (error: any) {
        logger.error(`Error in shouldSendFollowUp: ${error.message}`);
        return false;
    }
}

/**
 * Schedules a follow-up request by generating a reflective prompt and sending it.
 * @param {any} message - The message object.
 * @returns {Promise<void>} - Resolves when the follow-up request is scheduled.
 */
export async function scheduleFollowUpRequest(message: any): Promise<void> {
    try {
        const aliasCommand = getRandomAliasCommand();
        const reflectivePrompt = 'Reflecting on the recent conversation, how might the command ' + aliasCommand + ' provide further insights?';
        await sendLlmRequest(message, reflectivePrompt);
    } catch (error: any) {
        logger.error(`Error in scheduleFollowUpRequest: ${error.message}`);
    }
}
