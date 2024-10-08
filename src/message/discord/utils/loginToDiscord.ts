// src/message/discord/utils/loginToDiscord.ts

import { Client } from 'discord.js';
import logger from '@utils/logger';

/**
 * Logs in the Discord client using the provided bot token.
 * 
 * @param client - The Discord client instance to log in.
 * @param token - The Discord bot token.
 * @returns A promise that resolves when the login is successful.
 * @throws Will throw an error if the token is not provided or login fails.
 */
export async function loginToDiscord(client: Client, token: string): Promise<string> {
    logger.info('Attempting to log in to Discord.');

    // Guard clause: Ensure the token is provided.
    if (!token) {
        const errorMessage = 'DISCORD_TOKEN is not defined.';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    try {
        const result = await client.login(token);
        logger.info('Successfully logged in to Discord.');
        return result;
    } catch (error: any) {
        const errorMessage = 'Failed to log in to Discord: ' + (error instanceof Error ? error.message : String(error));
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
}

