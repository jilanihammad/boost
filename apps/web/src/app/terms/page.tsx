import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <Link href="/" className="mb-8 inline-block text-sm text-zinc-500 hover:text-white">&larr; Back to Boost</Link>
      <h1 className="mb-6 text-3xl font-bold text-white">Terms of Service</h1>
      <p className="mb-4 text-sm text-zinc-500">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">1. Service Overview</h2>
          <p>Boost provides a performance-based local marketing platform. Merchants create discount offers, distribute QR codes, and pay only when customers redeem offers at their location. Boost facilitates the connection between merchants and consumers but does not guarantee specific results.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">2. Merchant Accounts</h2>
          <p>Merchants are responsible for maintaining accurate account information, setting appropriate offer terms, and honoring redeemed offers. Each verified redemption incurs a per-redemption fee as configured in the offer settings.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">3. Redemptions & Billing</h2>
          <p>Merchants are billed based on verified redemptions. A redemption is verified when a staff member scans or manually enters a valid QR code at the point of sale. Daily caps are enforced per offer. Disputes must be raised within 7 days of the redemption.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">4. Consumer Use</h2>
          <p>Consumers may use QR codes distributed through advertising channels. Each QR code is subject to the offer terms, daily caps, and expiration dates set by the merchant. Boost does not guarantee offer availability.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">5. Prohibited Use</h2>
          <p>Users may not: (a) abuse the redemption system through automated or fraudulent redemptions, (b) resell or redistribute QR codes for profit, (c) attempt to circumvent daily caps or other limitations, (d) use the platform for any illegal purpose.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">6. Limitation of Liability</h2>
          <p>Boost is provided &ldquo;as is&rdquo; without warranty. We are not liable for indirect, incidental, or consequential damages. Our total liability is limited to the fees paid by the merchant in the preceding 30 days.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">7. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance. Material changes will be communicated via email to registered merchants.</p>
        </section>
      </div>
    </div>
  );
}
