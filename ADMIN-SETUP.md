# Admin panel: setup and use

The admin panel at **/admin** lets the client edit, with an email and password:

- **Products**: the six industries on the What we do page, with their product groups, products and counts
- **Home page cards**: the product cards under "Our product range", including photos
- **AeSop page** and **AeKomala page**: all the text on the two product pages
- **Careers**: the introduction and the open roles

Everything else on the site stays as it is.

The content is stored in a free **Supabase** database. Until the steps below are done, the website shows the content written into its HTML, and the admin page says "Not connected yet".

## One-time setup (about 15 minutes)

1. **Create the database.** Sign up at [supabase.com](https://supabase.com) and create a new project. Use a name like *aeva-website*, the **Mumbai** region, and a strong database password (keep it safe; the admin panel doesn't use it).
2. **Run the setup script.** In the project, open **SQL Editor → New query**. Paste in everything from [`supabase/setup.sql`](supabase/setup.sql). Near the bottom, change `admin@example.com` to the client's email, then click **Run**. This creates the content table, the admin list, the photo storage and the security rules, and loads today's website content.
3. **Create the admin's login.**
   - **Authentication → Sign In / Providers → Email**: keep Email on and turn **off** "Allow new users to sign up", so nobody else can create an account.
   - **Authentication → Users → Add user → Create new user**: enter the same email as in step 2, choose a password, and tick **Auto Confirm User**.
4. **Allow password-reset links.** In **Authentication → URL Configuration**, set **Site URL** to `https://akshaychavan44.github.io/aeva-chemicals/admin/` and add the same address under **Redirect URLs**.
5. **Connect the website.** In **Project Settings → API**, copy the **Project URL** and the **anon public** key. Paste them into [`cms-config.js`](cms-config.js), then commit and push.
6. **Sign in** at https://akshaychavan44.github.io/aeva-chemicals/admin/

The anon key is meant to be public. The database only accepts changes from signed-in users whose email is in the admin list.

## Using the admin panel

- Pick a section on the left, edit the fields, then click **Save changes** (or press Ctrl/⌘ + S). The website shows the change the next time a page is opened or refreshed.
- Use **+ Add** to add a product, group, card or job opening, the arrows to change the order, and the bin to remove one.
- **Photos**: click **Upload a photo** (JPG, PNG or WebP, up to 5 MB; square photos fit the cards best), then save.
- **Undo changes** goes back to the last save. The panel warns before you leave with unsaved changes.
- **Forgot your password?** on the sign-in page sends a reset link to the admin's email.

## Adding another admin

Add their email to the admin list (**Table Editor → site_admins → Insert row**), then create their login under **Authentication → Users → Add user**, as in step 3.

## Good to know

- **The HTML copy is the backup.** If the database can't be reached, pages show the content written into their HTML. Search engines also read that copy, so after big changes it's worth updating the HTML to match the saved content.
- **Free plan pauses.** Supabase pauses free projects after about a week with no activity. Visitors to the site count as activity. If the project is ever paused, the site falls back to the HTML copy and sign-in stops working until you click **Restore** in the Supabase dashboard.
- **Files:**
  - `cms-config.js`: the connection settings
  - `cms.js`: rebuilds the editable sections from the database
  - `admin/`: the admin panel
  - `data/content.json`: the content as it was when the admin panel was added
  - `supabase/setup.sql`: the database setup
