export const workosMock = (
  workosUsers: Array<{
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    profilePictureUrl?: string;
  }>
) => ({
  WorkOS: jest.fn().mockImplementation(() => ({
    userManagement: {
      listUsers: jest.fn().mockImplementation(({ email }: { email: string }) => {
        return {
          data: workosUsers
            .map((user) => ({ ...user, email: user.email?.toLowerCase() ?? `${user.id}@test.com`.toLowerCase() }))
            .filter(({ email: workosEmail }) => workosEmail === email.toLowerCase()),
        };
      }),
    },
  })),
});
