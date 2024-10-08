import express, { Request, Response, NextFunction } from 'express';
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { predictionImageMap } from '../utils/handleImageMessage';
import OpenAiManager from '../managers/OpenAiManager';
import DiscordManager from '../managers/DiscordManager';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

if (!process.env.DISCORD_TOKEN || !process.env.CHANNEL_ID) {
    console.error('Missing required environment variables: DISCORD_TOKEN and/or CHANNEL_ID');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Failed to login to Discord:', error.message);
    process.exit(1);
});

/**
 * Starts the webhook server and defines its routes and handlers.
 * 
 * @param port - The port on which the server will listen.
 */
export const startWebhookServer = (port: number): void => {
    const app = express();
    app.use(express.json());

    app.post('/webhook', async (req: Request, res: Response) => {
        console.log('Received webhook:', req.body);

        const predictionId = req.body.id;
        const predictionResult = req.body;
        const imageUrl = predictionImageMap.get(predictionId);
        console.debug('Image URL: ' + imageUrl);

        const channelId = process.env.CHANNEL_ID!;
        const channel = client.channels?.cache.get(channelId) as TextChannel;

        if (channel) {
            let resultMessage: string;
            if (predictionResult.status === 'succeeded') {
                const resultArray = predictionResult.output;
                const resultText = resultArray.join(' ');
                resultMessage = resultText + '\nImage URL: ' + imageUrl;
            } else if (predictionResult.status === 'processing') {
                console.debug('Processing: ' + predictionId);
                return res.sendStatus(200);
            } else {
                resultMessage = 'Prediction ID: ' + predictionId + '\nStatus: ' + predictionResult.status;
            }

            await channel.send(resultMessage).catch(error => {
                console.error('Failed to send message to channel:', error.message);
            });

            predictionImageMap.delete(predictionId);
        } else {
            console.error('Channel not found');
        }

        res.setHeader('Content-Type', 'application/json');
        res.sendStatus(200);
    });

    app.get('/health', (req: Request, res: Response) => {
        console.debug('Received health probe');
        res.sendStatus(200);
    });

    app.get('/uptime', (req: Request, res: Response) => {
        console.debug('Received uptime probe');
        res.sendStatus(200);
    });

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('Unhandled Error:', err.message);
        console.debug('Next middleware function: ' + next);
        res.status(500).send({ error: 'Server Error' });
    });

    app.listen(port, () => {
        console.log('HTTP server listening at http://localhost:' + port);
    });

    app.post('/post', async (req: Request, res: Response) => {
        const { message } = req.body;
        const discordManager = DiscordManager.getInstance();

        if (!message) {
            console.error('No message provided in request body');
            return res.status(400).send({ error: 'Message is required' });
        }

        try {
            await discordManager.sendResponse(process.env.CHANNEL_ID!, message);
            console.debug('Message sent to Discord: ' + message);
            res.status(200).send({ message: 'Message sent to Discord.' });
        } catch (error: any) {
            console.error('Failed to send the message:', error);
            res.status(500).send({ error: 'Failed to send the message' });
        }
    });

    app.post('/summarise-then-post', async (req: Request, res: Response) => {
        const { message } = req.body;
        const openAiManager = OpenAiManager.getInstance();

        if (!message) {
            console.error('No message provided in request body');
            return res.status(400).send({ error: 'Message is required' });
        }

        try {
            console.debug('Received message for summarization: ' + message);
            const summarizedTexts = await openAiManager.summarizeText(message);
            const summarizedMessage = summarizedTexts.length > 0 ? summarizedTexts[0] : '';

            if (!summarizedMessage) {
                console.warn('Summarized message is empty');
                return res.status(500).send({ error: 'Failed to summarize the message' });
            }

            const discordManager = DiscordManager.getInstance();
            await discordManager.sendResponse(process.env.CHANNEL_ID!, summarizedMessage);
            console.debug('Summarized message sent to Discord: ' + summarizedMessage);
            res.status(200).send({ message: 'Message summarized and sent to Discord.' });
        } catch (error: any) {
            console.error('Failed to summarize or send the message:', error);
            res.status(500).send({ error: 'Failed to summarize or send the message' });
        }
    });
};

client.once('ready', () => {
    console.log('Logged in as ' + client.user!.tag);

    const port = Number(process.env.WEB_SERVER_PORT) || 3001;
    startWebhookServer(port);
});
