// Run only through authenticated Railway SSH, never expose as an HTTP route.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createDb, instanceUserRoles } from '/app/packages/db/src/index.ts';
import { createBetterAuthInstance } from '/app/server/src/auth/better-auth.ts';
import { loadConfig } from '/app/server/src/config.ts';
const email = process.argv[2];
if (!email || !email.includes('@')) throw new Error('Supply owner email');
const db = createDb(process.env.DATABASE_URL);
if ((await db.select().from(instanceUserRoles)).length) {
  console.log('Owner already provisioned; no change.');
  process.exit(0);
}
const config = loadConfig();
// Only this private in-process auth instance permits creation. Live HTTP remains closed.
const auth = createBetterAuthInstance(db, {...config, authDisableSignUp: false}, [process.env.PAPERCLIP_PUBLIC_URL]);
const password = randomBytes(32).toString('base64url');
const result = await auth.api.signUpEmail({body: {email, password, name: 'Emilio Esposito'}});
await db.insert(instanceUserRoles).values({userId: result.user.id, role: 'instance_admin'});
mkdirSync('/paperclip/private', {recursive: true, mode: 0o700});
writeFileSync('/paperclip/private/owner.json', JSON.stringify({email,password}), {mode: 0o600, flag:'wx'});
console.log('Owner provisioned. Recovery credential stored privately; value suppressed.');
process.exit(0);
