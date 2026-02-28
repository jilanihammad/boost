import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <Link href="/" className="mb-8 inline-block text-sm text-zinc-500 hover:text-white">&larr; Back to Boost</Link>
      <h1 className="mb-6 text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-4 text-sm text-zinc-500">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">1. Information We Collect</h2>
          <p><strong>Merchants:</strong> Email address, business name, business locations, and payment-related information for billing purposes.</p>
          <p className="mt-2"><strong>Staff:</strong> Email address and role assignment within a merchant account.</p>
          <p className="mt-2"><strong>Consumers:</strong> We do not require consumers to create accounts. When a QR code is scanned, we record the redemption location, timestamp, and method (scan vs manual entry). No personal consumer data is collected.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">2. How We Use Information</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>To provide and maintain the Boost platform</li>
            <li>To process redemptions and generate billing ledgers</li>
            <li>To authenticate users and manage role-based access</li>
            <li>To communicate service updates to merchants</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">3. Data Storage</h2>
          <p>Data is stored in Google Cloud Firestore and Firebase Authentication, hosted in the United States. We use industry-standard security measures including encryption in transit (TLS) and at rest.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">4. Data Sharing</h2>
          <p>We do not sell personal information. We may share data with: (a) service providers (Google Cloud, Firebase) necessary to operate the platform, (b) as required by law or legal process.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">5. Data Retention</h2>
          <p>Account data is retained while the account is active. Redemption records are retained for billing and audit purposes for 2 years. Deleted accounts have personal data removed within 30 days, though anonymized redemption records may be retained.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">6. Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data by contacting us. Merchants can delete staff accounts through the admin panel. Account deletion requests are processed within 30 days.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">7. Contact</h2>
          <p>For privacy inquiries, contact us at privacy@boost.app.</p>
        </section>
      </div>
    </div>
  );
}
