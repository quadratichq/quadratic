import { z } from 'zod';

/*

This schema was used when we recorded the information on the User table.
Keeping this around for now, as the data remains in the database and we can
continue to analyze it until its not useful anymore.

const OnboardingResponseV1Schema = z.object({
  __version: z.literal(1),
  __createdAt: z.string().datetime(),
  use: z.enum(['work', 'personal', 'education']),
  'work-role': z.string().optional(),
  'work-role-other': z.string().optional(),
  'personal-uses[]': z.array(z.string()).optional(),
  'personal-uses[]-other': z.string().optional(),
  'education-identity': z.string().optional(),
  'education-identity-other': z.string().optional(),
  'education-subjects[]': z.array(z.string()).optional(),
  'education-subjects[]-other': z.string().optional(),
  'languages[]': z.array(z.string()).optional(),
  'goals[]': z.array(z.string()),
  'goals[]-other': z.string().optional(),
});
*/

export const OnboardingResponseV2Schema = z.object({
  __version: z.literal(2),
  __createdAt: z.string().datetime(),
  use: z.enum(['work', 'personal', 'education']),

  // Only for work/education
  'team-size': z.string().optional(),
  role: z.string().optional(),
  'role-other': z.string().optional(),

  'connections[]': z.array(z.string()).optional(),
  'connections[]-other': z.string().optional(),
  'team-name': z.string(),
  'team-invites[]': z.array(z.string()).optional(),
  'team-plan': z.literal('free').or(z.literal('pro')),
  'referral-source': z.string().optional(),
  'referral-source-other': z.string().optional(),
});
export type OnboardingResponseV2 = z.infer<typeof OnboardingResponseV2Schema>;
