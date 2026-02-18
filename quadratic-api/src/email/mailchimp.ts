import client from '@mailchimp/mailchimp_marketing';
import crypto from 'crypto';
import { getUsers } from '../auth/providers/auth';
import type dbClient from '../dbClient';
import { MAILCHIMP_API_KEY } from '../env-vars';
import logger from '../utils/logger';

// These correspond to specific setups in our Mailchimp production instance
const MAILCHIMP_SERVER_PREFIX = 'us18';
const MAILCHIMP_AUDIENCE_ID = 'e4959f7aa7';

// Signup Journey Drip Campaign
const MAILCHIMP_SIGNUP_JOURNEY_ID = 3921;
const MAILCHIMP_SIGNUP_STEP_ID = 32287;

// Team Invite Drip Campaign
const MAILCHIMP_TEAM_INVITE_JOURNEY_ID = 3940;
const MAILCHIMP_TEAM_INVITE_STEP_ID = 32408;

if (MAILCHIMP_API_KEY) {
  client.setConfig({
    apiKey: MAILCHIMP_API_KEY,
    server: MAILCHIMP_SERVER_PREFIX,
  });
}

/**
 * Triggers the signup journey for new users
 */
export const triggerJourney = async (user: Awaited<ReturnType<typeof dbClient.user.create>>) => {
  try {
    if (!MAILCHIMP_API_KEY) {
      logger.info('[mailchimp.triggerJourney] MAILCHIMP_API_KEY is not set, skipping journey');
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
    await client.customerJourneys.trigger(MAILCHIMP_SIGNUP_JOURNEY_ID, MAILCHIMP_SIGNUP_STEP_ID, {
      email_address: email,
    });
  } catch (error) {
    logger.error('Error triggering journey', error);
  }
};

/**
 * Adds an invited user to Mailchimp and triggers the team invite drip campaign.
 * This is called when a user is invited to a team but doesn't have a Quadratic account yet.
 */
export const addTeamInviteToMailchimp = async ({
  email,
  teamName,
  teamUuid,
  inviterName,
  inviterEmail,
}: {
  email: string;
  teamName: string;
  teamUuid: string;
  inviterName: string | undefined;
  inviterEmail: string;
}) => {
  try {
    if (!MAILCHIMP_API_KEY) {
      logger.info('[mailchimp.addTeamInviteToMailchimp] MAILCHIMP_API_KEY not set, skipping');
      return;
    }

    const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');

    // Try to add new member, or update existing
    try {
      await client.lists.addListMember(MAILCHIMP_AUDIENCE_ID, {
        email_address: email,
        status: 'subscribed',
        tags: ['team-invite-pending'],
        merge_fields: {
          TEAM_NAME: teamName,
          TEAM_UUID: teamUuid,
          INVITER: inviterName || inviterEmail,
        },
      });
    } catch (error: any) {
      // If member already exists, update their info
      if (error?.status === 400 && error?.response?.body?.title === 'Member Exists') {
        await client.lists.updateListMemberTags(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
          tags: [{ name: 'team-invite-pending', status: 'active' }],
        });

        await client.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
          merge_fields: {
            TEAM_NAME: teamName,
            TEAM_UUID: teamUuid,
            INVITER: inviterName || inviterEmail,
          },
        });
      } else {
        throw error;
      }
    }

    // Trigger the team invite drip journey
    await client.customerJourneys.trigger(MAILCHIMP_TEAM_INVITE_JOURNEY_ID, MAILCHIMP_TEAM_INVITE_STEP_ID, {
      email_address: email,
    });

    logger.info('[mailchimp.addTeamInviteToMailchimp] Added to team invite journey', { email, teamName });
  } catch (error) {
    logger.error('[mailchimp.addTeamInviteToMailchimp] Error', error);
  }
};

/**
 * Removes the team-invite-pending tag from a user when they sign up.
 * This will trigger the exit condition in Mailchimp and stop the drip campaign.
 */
export const removeTeamInviteFromMailchimp = async (email: string) => {
  try {
    if (!MAILCHIMP_API_KEY) {
      return;
    }

    const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');

    // Remove the pending tag - this triggers the journey exit condition
    await client.lists.updateListMemberTags(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
      tags: [{ name: 'team-invite-pending', status: 'inactive' }],
    });

    logger.info('[mailchimp.removeTeamInviteFromMailchimp] Removed team-invite-pending tag', { email });
  } catch (error) {
    // Don't throw - this is a best-effort cleanup
    logger.error('[mailchimp.removeTeamInviteFromMailchimp] Error', error);
  }
};
