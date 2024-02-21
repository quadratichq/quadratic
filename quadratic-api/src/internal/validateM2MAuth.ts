import { header } from 'express-validator';
import { M2M_AUTH_TOKEN } from '../env-vars';

export const validateM2MAuth = () => header('Authorization').equals(`Bearer ${M2M_AUTH_TOKEN}`);
