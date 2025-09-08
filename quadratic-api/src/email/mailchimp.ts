import client from '@mailchimp/mailchimp_marketing';
import { getUsers } from '../auth/providers/auth';
import type dbClient from '../dbClient';
import { MAILCHIMP_API_KEY } from '../env-vars';
import logger from '../utils/logger';

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
      throw new Error('User not found in triggerJourney');
    }

    const { email, firstName, lastName } = authUser;
    await client.lists.addListMember('e4959f7aa7', {
      email_address: email,
      status: 'subscribed',
      ...(!!firstName &&
        !!lastName && {
          merge_fields: { FNAME: firstName, LNAME: lastName },
        }),
    });
    await client.customerJourneys.trigger(3921, 32287, { email_address: email });
  } catch (error) {
    logger.error('Error triggering journey', error);
  }
};
