import { getDuplicateUsers } from './getDuplicateUsers';

async function listDuplicateUserEmails() {
  const duplicate_users = await getDuplicateUsers();

  console.log('Duplicate users:');
  console.log(duplicate_users);
}

listDuplicateUserEmails().catch((error) => {
  console.error('Error listing users:', error);
});
