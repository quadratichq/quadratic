export const workosMock = (
  workosUsers: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePictureUrl?: string;
  }>
) => ({
  WorkOS: jest.fn().mockImplementation(() => ({
    userManagement: {
      listUsers: jest.fn().mockImplementation(({ email }: { email: string }) => {
        return {
          data: workosUsers.filter(({ email: workosEmail }) => workosEmail.toLowerCase() === email.toLowerCase()),
        };
      }),
    },
  })),
});
