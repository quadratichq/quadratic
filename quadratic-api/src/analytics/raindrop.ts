import Raindrop from 'raindrop-ai';
import { RAINDROP_API_KEY } from '../env-vars';

export let raindrop: Raindrop | null = null;
if (RAINDROP_API_KEY) {
  raindrop = new Raindrop({ writeKey: RAINDROP_API_KEY });
}
