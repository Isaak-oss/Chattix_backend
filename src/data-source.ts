import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { typeOrmConfig } from './common/configs/database.config';

dotenv.config();

export const AppDataSource = new DataSource(typeOrmConfig);

AppDataSource.initialize()
  .then(() => console.log('✅ Data Source initialized'))
  .catch((err) => console.error('❌ Data Source init error:', err));
