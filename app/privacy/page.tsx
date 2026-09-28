import Link from "next/link";

export default function PrivacyPage() {
  return <main>
    <Link href="/">← The Humor Project</Link>
    <h1>Privacy</h1>
    <p>This is a classroom project for Designing for GenAI: The Humor Project.</p>
    <h2>Sign-in and profile information</h2>
    <p>Google verifies your identity. Supabase Auth receives your basic Google account information,
      including your account identifier, email, name, and profile photo reference. We use this
      information to create your account and keep you signed in with session cookies.</p>
    <p>The first and last names you enter are stored in your profile. Uploaded photos are stored
      as files in private Supabase Storage, with a file path stored in your profile. Temporary
      signed links let your browser display your photo.</p>
    <h2>Services that process this information</h2>
    <p>Google handles sign-in, Supabase stores account and profile information and photo files,
      and Vercel hosts the app and processes profile updates. These services may keep operational
      logs. This app requests only basic sign-in information from Google.</p>
    <h2>Your choices</h2>
    <p>You can edit your names and replace your photo in Profile, and sign out at any time.
      Account data remains stored after sign-out. For questions or an account/data deletion
      request, contact <a href="mailto:zheliguai12345@gmail.com">zheliguai12345@gmail.com</a>.</p>
  </main>;
}
