/* Connection to the Supabase project that stores the editable content
   (products, product pages and job openings). See ADMIN-SETUP.md.

   Leave both values empty and the pages show the content written into their HTML.
   The anon key is safe to publish: the database only lets signed-in admins make changes. */
window.AEVA_CMS = {
  url: "",      // e.g. "https://abcdefghijkl.supabase.co"
  anonKey: ""   // Project Settings → API → anon public key
};

/* While the saved content loads, hide the editable sections so the old text doesn't flash.
   If loading takes too long, show the built-in content instead. */
if (window.AEVA_CMS.url && window.AEVA_CMS.anonKey) {
  document.documentElement.classList.add("cms-wait");
  setTimeout(() => document.documentElement.classList.remove("cms-wait"), 2500);
}
