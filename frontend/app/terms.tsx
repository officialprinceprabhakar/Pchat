// Terms & Conditions — reachable at /terms
import React from 'react';
import { LegalPage, H2, P, Li } from '@/src/components/LegalPage';

export default function TermsScreen() {
  return (
    <LegalPage title="Terms &amp; Conditions" updated="July 17, 2026">
      <P>
        These Terms &amp; Conditions govern your use of the Plexa mobile app operated by Prince Prabhakar
        (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;). By creating an account or using Plexa, you agree to these terms.
      </P>

      <H2>1. Eligibility</H2>
      <P>You must be at least 13 years old to use Plexa. If you are under 18, you use Plexa under the supervision of a parent or legal guardian.</P>

      <H2>2. Your Account</H2>
      <Li>You are responsible for the accuracy of information you provide.</Li>
      <Li>You are responsible for keeping your password confidential.</Li>
      <Li>You must notify us immediately if you suspect unauthorized access to your account.</Li>
      <Li>One person may not maintain more than one active account except with prior written permission.</Li>

      <H2>3. Acceptable Use</H2>
      <P>You agree not to use Plexa to:</P>
      <Li>Post or share unlawful, hateful, threatening, sexually explicit, or violent content.</Li>
      <Li>Harass, bully, dox, or impersonate other users.</Li>
      <Li>Send spam or promotional messages without consent.</Li>
      <Li>Attempt to reverse-engineer, scrape, or overload the service.</Li>
      <Li>Interfere with moderation, ban evasion, or use bots without permission.</Li>

      <H2>4. User Content</H2>
      <P>
        You retain ownership of the text, images, and stories you upload. By posting content on Plexa, you grant Plexa a
        worldwide, non-exclusive, royalty-free license to host and display that content solely to operate and improve the app.
        We may remove any content that violates these Terms or applicable law.
      </P>

      <H2>5. Moderation</H2>
      <P>
        Plexa maintains a role hierarchy inside public rooms: Owner, Admin, Moderator, VIP, Verified, Member. Owners and Admins may ban,
        kick, mute, or delete messages of members inside their room. Users identified as Developers cannot be moderated by non-developers.
        Repeated violations of these Terms may result in permanent removal from the service.
      </P>

      <H2>6. Content Deletion &amp; Account Removal</H2>
      <P>
        You may deactivate or permanently delete your account any time from Settings. Deletion is described in detail in our Privacy Policy.
        We may also suspend or delete accounts that violate these Terms.
      </P>

      <H2>7. Third-Party Services</H2>
      <P>
        Plexa uses MongoDB Atlas for storage, Emergent-managed Google authentication for optional social sign-in, and
        Firebase Cloud Messaging (via Expo) for push notifications. Your use of Plexa is also subject to those providers&apos; own terms.
      </P>

      <H2>8. Disclaimers</H2>
      <P>
        Plexa is provided &quot;as is&quot; without warranties of any kind. We do not guarantee uninterrupted or error-free operation.
        User-generated content does not reflect the views of the Plexa team.
      </P>

      <H2>9. Limitation of Liability</H2>
      <P>
        To the maximum extent permitted by law, Plexa and its operator will not be liable for indirect, incidental, or consequential damages
        arising out of your use of the app. Our total liability is limited to any fees you paid to Plexa in the preceding 12 months
        (currently zero, as Plexa is free).
      </P>

      <H2>10. Governing Law</H2>
      <P>These Terms are governed by the laws of India. Any disputes will be resolved in the competent courts of India.</P>

      <H2>11. Changes</H2>
      <P>
        We may update these Terms from time to time. Significant changes will be communicated inside the app. Continued use after an update
        constitutes acceptance of the revised Terms.
      </P>

      <H2>12. Contact</H2>
      <P>Questions? Reach us at officialprinceprabhakar@gmail.com.</P>
    </LegalPage>
  );
}
