export const auth0Mock = (
  auth0Users: Array<{
    user_id: string;
    email: string;
  }>
) => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    getUsers: jest.fn().mockImplementation(({ q }: { q: string }) => {
      // example value for `q`: "user_id:(user1 OR user2)"
      return auth0Users.filter(({ user_id }) => user_id && q.includes(user_id));
    }),
    // auth0 doesn't match on case sensitivty, so we won't either
    getUsersByEmail: jest.fn().mockImplementation((email: string) => {
      return auth0Users.filter(({ email: userEmail }) => email.toLowerCase() === userEmail.toLowerCase());
    }),
  })),
});
