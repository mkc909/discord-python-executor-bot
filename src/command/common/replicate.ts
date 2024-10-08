import axios from 'axios';
import ConfigurationManager from '@common/configurationManager';
import Logger from '@utils/logger';
import { getRandomErrorMessage } from '@common/errors/errorMessages';

export async function analyzeImage(imageUrl: string, prompt: string): Promise<{ success: boolean, message: string, url?: string, error?: string }> {
    try {
        const response = await axios.post(
            ConfigurationManager.getConfig<string>('replicate.apiUrl'),
            {
                version: ConfigurationManager.getConfig<string>('replicate.modelVersion'),
                input: { image: imageUrl, prompt: prompt },
                webhook: ConfigurationManager.getConfig<string>('replicate.webhookUrl'),
                webhook_events_filter: ['start', 'completed']
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Token ' + ConfigurationManager.getConfig<string>('replicate.apiToken')
                }
            }
        );

        if (response.status === 200 && response.data.success) {
            Logger.info('Image analysis successful for ' + imageUrl + '. Prediction ID: ' + response.data.id);
            return { success: true, message: 'Image analysis successful. Prediction ID: ' + response.data.id, url: response.data.urls.show };
        } else {
            Logger.error('Failed API call with status ' + response.status);
            return { success: false, message: 'Failed to initiate image analysis.' };
        }
    } catch (error: any) {
        Logger.error('Error during API call - ' + error.message);
        return { success: false, message: getRandomErrorMessage(), error: error.message };
    }
}
