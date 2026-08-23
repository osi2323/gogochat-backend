import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import * as path from 'path';

const tenantArg = process.argv[2];
if (!tenantArg) {
  console.error('Kullanım: npm run tenant:create -- <tenant-adı>');
  console.error('Örnek:    npm run tenant:create -- master');
  process.exit(1);
}

const schema = `tenant_${tenantArg}`;

const host = process.env.POSTGRES_HOST || 'localhost';
const port = Number(process.env.POSTGRES_PORT) || 5432;
const username = process.env.POSTGRES_USER || 'postgres';
const password = process.env.POSTGRES_PASSWORD || 'postgres';
const database = process.env.POSTGRES_DB || 'kingmobile';
const entitiesGlob = path.join(process.cwd(), 'src', '**', '*.entity{.ts,.js}');

(async () => {
  // Step 1: Şemayı oluştur (schema olmadan bağlan)
  const rootDs = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
  });

  await rootDs.initialize();

  const rows = await rootDs.query<{ exists: string }[]>(
    `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS "exists"`,
    [schema],
  );

  if (String(rows[0].exists) === 'true') {
    console.log(`→ Şema zaten mevcut: ${schema}`);
  } else {
    await rootDs.query(`CREATE SCHEMA "${schema}"`);
    console.log(`✓ Şema oluşturuldu: ${schema}`);
  }

  await rootDs.destroy();

  // Step 2: Entity tablolarını senkronize et
  const tenantDs = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    schema,
    entities: [entitiesGlob],
    synchronize: true,
  });

  await tenantDs.initialize();
  console.log(`✓ Tablolar senkronize edildi: ${schema}`);
  await tenantDs.destroy();

  process.exit(0);
})().catch((err: Error) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
