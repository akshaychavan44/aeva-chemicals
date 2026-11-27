# Aeva Admin setup on Vercel

The editor at `/admin/index.html` manages products and careers. Vercel hosts the API and Neon stores saved edits. Until the first save, each section uses its built-in content.

## Connect production

1. In the Neon SQL Editor, select the database and branch used by the production connection string. Run [neon/setup.sql](neon/setup.sql). This creates two empty tables and preserves existing rows if run again.
2. In the Aeva Vercel project, open **Settings → Environment Variables**. Set these for **Production**:
   - `DATABASE_URL`: keep the existing pooled Neon connection URL.
   - `CMS_ADMIN_EMAIL`: the client's admin email.
   - `CMS_ADMIN_PASSWORD`: a unique, randomly generated password of 10 to 20 characters. Use 20 characters when possible and store the value as a Vercel secret.
3. Deploy the code containing `api/cms.mjs` on Vercel. The project uses the repository root and the **Other** framework preset. Redeploy whenever the server-side settings change.
4. Open [the admin panel](https://aeva-chemicals.vercel.app/admin/index.html), sign in and save an edit. Reload the matching public page on the same Vercel domain to check it.

The login supports one administrator. The admin can change the password under Settings in the admin panel: the new password is stored as an scrypt hash in the `aeva_admin_auth` table and replaces `CMS_ADMIN_PASSWORD` for signing in, and every other session is signed out. If that password is forgotten, delete the row in `aeva_admin_auth` and sign in with `CMS_ADMIN_PASSWORD` again. `CMS_ADMIN_PASSWORD` is still required: it also signs the session cookies, so changing it in Vercel and redeploying signs everyone out. The admin session expires after eight hours.

The GitHub Pages copy serves the built-in content. Test saved edits on the Vercel domain, where the API runs. Keep the database and admin password out of the repository.

### Website inquiries

Open **Website inquiries** in the signed-in admin panel to read submissions, newest first. The form saves to the same Neon database as the CMS. The first submission or inbox visit creates the inquiries table if needed. If your runtime database role has no permission to create tables, run the inquiries table definition in `neon/setup.sql` as the database owner. Submission confirmation means the database accepted the inquiry. Replies can be sent to the email supplied by the visitor.
