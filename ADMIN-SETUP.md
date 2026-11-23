# Aeva Admin setup on Vercel

The editor at `/admin/index.html` manages products, product pages, home page product cards and careers. Vercel hosts the API and Neon stores saved edits and uploaded photos. Until the first save, each section uses its built-in content.

## Connect production

1. In the Neon SQL Editor, select the database and branch used by the production connection string. Run [neon/setup.sql](neon/setup.sql). This creates two empty tables and preserves existing rows if run again.
2. In the Aeva Vercel project, open **Settings → Environment Variables**. Set these for **Production**:
   - `DATABASE_URL`: keep the existing pooled Neon connection URL.
   - `CMS_ADMIN_EMAIL`: the client's admin email.
   - `CMS_ADMIN_PASSWORD`: a unique, randomly generated password of at least 32 characters. Use a password manager and store the value as a Vercel secret.
3. Deploy the code containing `api/cms.mjs` on Vercel. The project uses the repository root and the **Other** framework preset. Redeploy whenever the server-side settings change.
4. Open [the admin panel](https://aeva-chemicals.vercel.app/admin/index.html), sign in and save an edit. Reload the matching public page on the same Vercel domain to check it.

The login supports one administrator. To rotate the password, change the Vercel secret and redeploy. This also invalidates cookies issued with the previous password. The admin session expires after eight hours.

The GitHub Pages copy serves the built-in content. Test saved edits on the Vercel domain, where the API runs. Keep the database and admin password out of the repository.
