import { ManagementClient } from 'auth0';


const auth0 = new ManagementClient({
    domain: process.env.AUTH0_DOMAIN as string,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    scope: 'read:users',
  });
  
async function getUsersPage(page: number) {
    return await auth0.getUsers({
        per_page: 100,
        page,
    });
}

async function listDuplicateUserEmails() {

    const seen_emails = [] as string[];
    const duplicate_emails = [] as string[];

    let page = 0;
    let users = await getUsersPage(page);
    while (users.length > 0) {
        users.forEach((user) => {
            console.log(user.email);
            if (user.email === undefined) {
                return;
            }

            if (seen_emails.includes(user.email)) {
                duplicate_emails.push(user.email);
            }
            seen_emails.push(user.email);

        });
        page += 1;
        users = await getUsersPage(page);
    }
    

    console.log('Duplicate emails:');
    console.log(duplicate_emails);

}

listDuplicateUserEmails()
  .catch((error) => {
    console.error('Error listing users:', error);
  })
