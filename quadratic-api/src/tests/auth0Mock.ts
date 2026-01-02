export const auth0Mock = (
  auth0Users: Array<{
    user_id: string;
    email: string;
    name?: string;
    picture?: string;
  }>
) => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    getUsers: jest.fn().mockImplementation(({ q }: { q: string }) => {
      // example value for `q`: "user_id:(user1 OR user2)"
      return auth0Users.filter(({ user_id }) => user_id && q.includes(user_id));
    }),
    // auth0 doesn't match on case sensitivity, so we won't either
    getUsersByEmail: jest.fn().mockImplementation((email: string) => {
      return auth0Users.filter(({ email: userEmail }) => email.toLowerCase() === userEmail.toLowerCase());
    }),
  })),
});

// This mock is used for tests that need to handle any user ID pattern
export const genericAuth0Mock = () => {
  return {
    ManagementClient: jest.fn().mockImplementation(() => ({
      getUsers: jest.fn().mockImplementation(({ q }: { q: string }) => {
        // Extract user IDs from the query and return mock users
        const userIds = q.match(/test-user-\w+|other-user-\w+/g) || [];
        return userIds.map((user_id) => ({
          user_id,
          email: `${user_id}@example.com`,
          name: user_id.includes('test-user') ? 'Test User' : 'Other User',
        }));
      }),
      getUsersByEmail: jest.fn().mockImplementation((email: string) => {
        // Mock user lookup by email
        const user_id = email.split('@')[0];
        return [
          {
            user_id,
            email,
            name: user_id.includes('test-user') ? 'Test User' : 'Other User',
          },
        ];
      }),
    })),
  };
};
