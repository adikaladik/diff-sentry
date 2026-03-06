const { analyzeDiff } = require('./src/analyzer');
const { buildPRComment } = require('./src/reporter');

// Simulate an AI that rewrote auth + a normal component file
const testDiff = `
diff --git a/src/auth/jwt.js b/src/auth/jwt.js
index abc123..def456 100644
--- a/src/auth/jwt.js
+++ b/src/auth/jwt.js
@@ -1,10 +1,12 @@
-const JWT_SECRET = process.env.JWT_SECRET;
+const JWT_SECRET = 'hardcoded-secret-do-not-use';
 
 function verifyToken(token) {
-  return jwt.verify(token, JWT_SECRET);
+  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
 }
 
diff --git a/.env.production b/.env.production
index 000000..111111 100644
--- /dev/null
+++ b/.env.production
@@ -0,0 +1,3 @@
+DATABASE_URL=postgres://prod:pass@db.example.com/app
+STRIPE_SECRET_KEY=sk_live_abc123
+JWT_SECRET=my-prod-secret
diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index aaa..bbb 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,5 +1,6 @@
 import React from 'react';
+import { cn } from '../utils/cn';
 
 export function Button({ children, onClick }) {
-  return <button onClick={onClick}>{children}</button>;
+  return <button className={cn('btn')} onClick={onClick}>{children}</button>;
 }
`;

const result = analyzeDiff(testDiff);
console.log('=== Analysis ===');
console.log('Total files:', result.summary.total);
console.log('Risky files:', result.summary.riskyFiles);
console.log('HIGH:', result.summary.high, '| MEDIUM:', result.summary.medium);
console.log('Safe:', result.safe);
console.log('\n=== PR Comment Preview ===\n');
console.log(buildPRComment(result));
