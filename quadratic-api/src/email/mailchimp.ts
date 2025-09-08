import client from '@mailchimp/mailchimp_marketing';
import { getUsers } from '../auth/providers/auth';
import type dbClient from '../dbClient';
import { MAILCHIMP_API_KEY } from '../env-vars';
import logger from '../utils/logger';

// These correspond to specific setups in our Mailchimp production instance
const MAILCHIMP_AUDIENCE_ID = 'e4959f7aa7';
const MAILCHIMP_JOURNEY_ID = 3921;
const MAILCHIMP_STEP_ID = 32287;

if (MAILCHIMP_API_KEY) {
  client.setConfig({
    apiKey: MAILCHIMP_API_KEY,
    server: 'us18',
  });
}

export const triggerJourney = async (user: Awaited<ReturnType<typeof dbClient.user.create>>) => {
  try {
    if (!MAILCHIMP_API_KEY) {
      return;
    }

    const authUser = (await getUsers([{ id: user.id, auth0Id: user.auth0Id, email: user.email }]))[user.id];
    if (!authUser) {
      throw new Error('[mailchimp.triggerJourney] User not found in auth');
    }

    const { email, firstName, lastName } = authUser;
    await client.lists.addListMember(MAILCHIMP_AUDIENCE_ID, {
      email_address: email,
      status: 'subscribed',
      ...(!!firstName &&
        !!lastName && {
          merge_fields: { FNAME: firstName, LNAME: lastName },
        }),
    });
    await client.customerJourneys.trigger(MAILCHIMP_JOURNEY_ID, MAILCHIMP_STEP_ID, { email_address: email });
  } catch (error) {
    logger.error('Error triggering journey', error);
  }
};
