import { CreateSecretCommand, GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'; // ES Modules import
import { randomUUID } from 'crypto';

const client = new SecretsManagerClient({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

const SECRET_NAME_PREFIX = 'dev/customerSecret/';

export const CreateSecret = async (secretString: string) => {
  const input = {
    // CreateSecretRequest
    Name: SECRET_NAME_PREFIX + randomUUID(), // required
    Description: 'Test secret',
    SecretString: secretString,
    Tags: [
      {
        Key: 'ENVIRONMENT',
        Value: 'DEVELOPMENT',
      },
    ],
  };
  const command = new CreateSecretCommand(input);
  const response = await client.send(command);

  return response; // CommandOutput
};

export const GetSecret = async (secretArn: string) => {
  const input = {
    SecretId: secretArn,
  };
  const command = new GetSecretValueCommand(input);
  const response = await client.send(command);

  return response; // CommandOutput
};
