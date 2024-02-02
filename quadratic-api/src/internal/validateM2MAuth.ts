import { header } from 'express-validator';

export const validateM2MAuth = () => header('Authorization').equals(`Bearer ${process.env.M2M_AUTH_TOKEN}`);
