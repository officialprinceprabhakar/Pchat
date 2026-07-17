// Google Play required Privacy Policy — reachable at /privacy
import React from 'react';
import { Text } from 'react-native';
import { LegalPage, H2, H3, P, Li } from '@/src/components/LegalPage';

function B({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontWeight: '700', color: '#EDEDF0' }}>{children}</Text>;
}

export default function PrivacyPolicyScreen() {
  return (
    <LegalPage title="Privacy Policy" updated="July 17, 2026">
      <P>
        Plexa (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is a social chat application operated by Prince Prabhakar.
        This Privacy Policy explains what information we collect, how we use it, and the choices you have.
      </P>

      <H2>1. Information We Collect</H2>
      <H3>Information you provide</H3>
      <Li><B>Username</B> — a unique handle you choose during registration.</Li>
      <Li><B>Email address</B> — optional when you sign in with a third-party provider.</Li>
      <Li><B>Profile photo</B> — optional image you upload.</Li>
      <Li><B>Bio</B> — optional short description on your profile.</Li>
      <Li><B>Chat messages</B> — direct 1-on-1 and public room messages you send.</Li>
      <Li><B>Images</B> — photos you attach to messages, posts, or stories.</Li>
      <Li><B>Stories</B> — 24-hour ephemeral image posts you upload.</Li>
      <Li><B>Friend requests</B> — connections you send or accept.</Li>

      <H3>Information collected automatically</H3>
      <Li><B>Device information</B> — device type, OS version, unique device identifier used only for push-notification delivery.</Li>
      <Li><B>Authentication tokens</B> — a session token stored securely on your device via Expo SecureStore.</Li>
      <Li><B>Notifications</B> — a push token issued by your operating system (used only to deliver notifications).</Li>
      <Li><B>Local storage</B> — theme preference, cached lists, and other UI state stored on your device only.</Li>
      <Li><B>Analytics</B> — Plexa currently does not integrate third-party analytics. If enabled in a future release, this policy will be updated first.</Li>

      <H2>2. How We Store Your Data</H2>
      <P>Plexa uses two systems to store user data:</P>
      <Li><B>Authentication</B> — Emergent-managed Google authentication is used for optional social sign-in. Password-based sign-ins are handled by our own backend using bcrypt-hashed passwords.</Li>
      <Li><B>Database</B> — MongoDB Atlas hosts user profiles, messages, rooms, posts, stories, friendships, and notifications. Traffic to MongoDB is encrypted in transit (TLS).</Li>
      <Li><B>Note on Supabase</B> — Plexa currently does not use Supabase. If a future release integrates Supabase Authentication, this policy will be updated in advance and existing users will be notified.</Li>

      <H2>3. How We Use Your Data</H2>
      <Li>To operate core features: authentication, chats, rooms, posts, stories, friends.</Li>
      <Li>To send notifications you have opted into.</Li>
      <Li>To enforce community rules (spam prevention, moderation, ban enforcement).</Li>
      <Li>To provide developer-only support and abuse investigation.</Li>

      <H2>4. Data Security</H2>
      <P>
        Passwords are stored as bcrypt hashes. Sessions expire after 7 days. Communication with the Plexa API uses HTTPS.
        Access to internal admin dashboards is limited to verified developer accounts identified server-side.
      </P>

      <H2>5. User Rights</H2>
      <Li><B>Access</B> — you may view all your profile data inside the Plexa app.</Li>
      <Li><B>Correction</B> — edit your display name, bio, and profile photo any time from Profile → Edit.</Li>
      <Li><B>Deletion</B> — permanently delete your account from Settings → Delete account. This removes your profile, posts, stories, friendships, notifications, and sessions.</Li>
      <Li><B>Portability / questions</B> — email officialprinceprabhakar@gmail.com to request an export or ask a question.</Li>

      <H2>6. Data Retention</H2>
      <P>
        We retain your data for as long as your account exists. When you delete your account, personal profile data (name, avatar, bio, email, password hash) is removed immediately.
        Messages you sent in rooms remain visible to other participants but are attributed to &quot;Deleted user&quot;. Deactivated (not deleted) accounts are kept and can be reactivated by signing back in.
      </P>

      <H2>7. Data Sharing</H2>
      <P>We do not sell your personal data. We share data only in the following limited cases:</P>
      <Li>With MongoDB Atlas (our database provider) — encrypted storage of your account and content.</Li>
      <Li>With the Emergent Google Authentication provider — only your Google account identifier, name, and profile image, and only if you choose Google sign-in.</Li>
      <Li>With push notification providers (Firebase Cloud Messaging via Expo) — only your push token when notifications are enabled.</Li>
      <Li>When required by law, court order, or lawful government request.</Li>

      <H2>8. Children&apos;s Privacy</H2>
      <P>
        Plexa is not directed at children under 13. We do not knowingly collect personal information from anyone under 13.
        If you believe a child under 13 has an account, please email us at officialprinceprabhakar@gmail.com and we will delete the account.
      </P>

      <H2>9. Policy Updates</H2>
      <P>
        We may update this policy from time to time. The &quot;Last updated&quot; date at the top of this page will always reflect the most recent version.
        Significant changes will be communicated inside the app.
      </P>

      <H2>10. Contact Information</H2>
      <P>Questions about this policy or your data can be sent to:</P>
      <Li><B>Developer</B> — Prince Prabhakar</Li>
      <Li><B>Email</B> — officialprinceprabhakar@gmail.com</Li>
    </LegalPage>
  );
}
