import { getAuth0User } from '../src/auth0/profile';
import dbClient from '../src/dbClient';

dbClient.user.findMany().then((users) => {
  console.log('Started UPDATE AUTH0 USERS - count ', users.length);
  users.forEach(async (user) => {
    const auth0User = await getAuth0User(user.auth0_id);

    console.log('updating ', user);

    await dbClient.user.update({
      where: {
        id: user.id,
      },
      data: {
        auth0_data: auth0User as any,
        auth0_data_last_updated: new Date(),
      },
    });
  });
});
