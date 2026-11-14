import { purgeE2EData } from './helpers/api';

/** Al terminar la suite: borra por API todo lo "E2E-" que la API deje borrar. Nunca falla la corrida. */
export default async function globalTeardown(): Promise<void> {
  try {
    const n = await purgeE2EData();
    console.log(`[e2e] teardown: ${n} registros E2E- borrados`);
  } catch (e) {
    console.warn('[e2e] teardown: no se pudo purgar', e);
  }
}
