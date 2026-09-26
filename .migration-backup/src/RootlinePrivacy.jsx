import { Link } from "react-router-dom";
import { GitBranch, ArrowLeft, ShieldCheck } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Introduction",
    body: `Rootline ("we", "our", or "us") is committed to protecting your privacy and the privacy of the family members you document on our platform. This Privacy Policy explains how we collect, use, store, and protect your personal data, and what rights you have in relation to that data. By using the Rootline Service, you agree to the practices described in this Policy.`,
  },
  {
    title: "2. Data We Collect",
    subsections: [
      {
        subtitle: "2a. Account Data",
        text: `When you register, we collect your name, email address, and a securely hashed password. If you authenticate via Google OAuth, we receive your name and email address from Google's authorised response — we do not receive or store your Google password.`,
      },
      {
        subtitle: "2b. Family Record Data",
        text: `You may voluntarily provide information about family members including names, dates of birth and death, gender, biographical notes, addresses, telephone numbers, and photographs. This data is stored exclusively within your account and is not accessible to other users unless you explicitly grant sharing access.`,
      },
      {
        subtitle: "2c. Session Data",
        text: `Authentication is maintained through secure, encrypted session tokens. These tokens are protected from unauthorized third-party access and scripts to ensure your session remains private and protected.`,
      },
      {
        subtitle: "2d. Usage Data",
        text: `We may collect non-personal technical data such as browser type, operating system, and referring URLs for the purpose of maintaining and improving the Service. This data is not linked to your identity.`,
      },
    ],
  },
  {
    title: "3. How We Use Your Data",
    body: `We use your data exclusively to: (a) provide, maintain, and improve the Service; (b) authenticate your identity and protect your account; (c) respond to your requests for support; (d) comply with applicable legal obligations. We do not use your family record data for advertising, profiling, or any commercial purpose beyond the direct provision of the Service.`,
  },
  {
    title: "4. Account-Level Isolation & Privacy",
    body: `Each Rootline account maintains an independent, dedicated family tree vault. Your family members, ancestral units, and relationship records are strictly partitioned to prevent any unauthorized cross-account visibility. There is no automatic merging of records between accounts. When you share your tree with another user, only the data within that specific tree becomes visible to the invited user under the role you designate.`,
  },
  {
    title: "5. Sharing and Third-Party Access",
    body: `When you invite another registered user to access your family tree, they receive access only to the specific records within that tree under the permission level you assign (Viewer or Editor). We do not share, sell, rent, or transfer your personal data or family records to any third-party data broker, advertiser, or analytics company. We may disclose data to competent authorities only if required to do so by applicable law.`,
  },
  {
    title: "6. Data Security",
    body: `We implement modern, comprehensive security standards including: (a) encrypted session tokens with strict transport security; (b) cryptographic password protection; (c) granular role-based authorization verified on every request; (d) strict architectural partitioning between family trees. While no system can claim infallible security, we take extensive measures to safeguard your family records against unauthorized access.`,
  },
  {
    title: "7. Data Retention",
    body: `Your account data and family records are retained for as long as your account remains active. If you request deletion of your account, we will delete your personal data and associated family records within a reasonable timeframe, except where retention is required by applicable law. Anonymised, aggregated data that cannot identify you may be retained indefinitely for platform improvement purposes.`,
  },
  {
    title: "8. Your Rights",
    body: `Depending on your jurisdiction, you may have the right to: access a copy of the personal data we hold about you; correct inaccurate personal data; request deletion of your personal data; object to or restrict certain processing; and portability of your data in a machine-readable format. To exercise any of these rights, contact us at support@rootline.app.`,
  },
  {
    title: "9. Cookies",
    body: `We use essential, secure session cookies required solely for authenticating your sign-in and keeping your account secure. We do not use third-party advertising cookies or cross-site tracking pixels.`,
  },
  {
    title: "10. Children's Privacy",
    body: `The Service is not directed at children under the age of 13. We do not knowingly collect personal data from children under 13 without verifiable parental consent. If you believe a child has provided personal data to us, please contact support@rootline.app and we will take steps to delete such data promptly.`,
  },
  {
    title: "11. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date at the top of this page and, where appropriate, via email. Continued use of the Service after any change constitutes your acceptance of the updated Policy.`,
  },
  {
    title: "12. Contact Us",
    body: `If you have questions, concerns, or requests relating to this Privacy Policy or our data practices, please contact our support team at: support@rootline.app`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center px-8 lg:px-16 py-5 border-b border-[#E7E2D6] bg-[#F7F5F0]/95 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-1.5 w-fit hover:opacity-85 transition-opacity"
          aria-label="Rootline Home"
        >
          <GitBranch className="w-4 h-4 text-[#1C4B3C]" strokeWidth={2.5} />
          <span className="text-[13px] tracking-[0.2em] font-semibold text-[#1C4B3C]">ROOTLINE</span>
        </Link>
        <div />
        <div className="flex justify-self-end">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-[#1C1F1D] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-8 lg:px-16 py-16 max-w-3xl mx-auto w-full">
        {/* Page header */}
        <div className="mb-12">
          <p className="text-[11px] tracking-[0.2em] font-semibold text-[#C9A468] mb-3 uppercase">Legal</p>
          <h1 className="text-3xl lg:text-4xl font-serif font-bold text-[#1C1F1D] mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#9CA3AF]">
            Effective date: 1 September 2025 · Last updated: 18 September 2025
          </p>
        </div>

        {/* Privacy commitment card */}
        <div className="bg-[#1C4B3C] rounded-2xl px-7 py-6 mb-10 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-[#C9A468] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">Our commitment to your privacy</p>
            <p className="text-sm text-[#9BB0A6] leading-relaxed">
              Your family records belong to you. We do not sell, rent, or share your data with advertisers or data brokers — ever. Each account operates within a strictly isolated data environment.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-9">
          {SECTIONS.map(({ title, body, subsections }) => (
            <section key={title}>
              <h2 className="text-base font-semibold text-[#1C1F1D] mb-2">{title}</h2>
              {body && (
                <p className="text-sm text-[#4B5563] leading-relaxed">{body}</p>
              )}
              {subsections && (
                <div className="space-y-4 mt-3">
                  {subsections.map(({ subtitle, text }) => (
                    <div key={subtitle} className="pl-4 border-l-2 border-[#E7E2D6]">
                      <p className="text-sm font-medium text-[#374151] mb-1">{subtitle}</p>
                      <p className="text-sm text-[#4B5563] leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-14 pt-7 border-t border-[#E7E2D6]">
          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            This Privacy Policy was last updated on 18 September 2025. If you have questions about how we handle your data, please reach out to us at{" "}
            <a href="mailto:support@rootline.app" className="text-[#1C4B3C] hover:underline">
              support@rootline.app
            </a>
            .
          </p>
          <div className="flex items-center gap-6 mt-5">
            <Link to="/terms" className="text-xs font-medium text-[#1C4B3C] hover:underline">
              Terms of Service →
            </Link>
            <Link to="/" className="text-xs text-[#6B7280] hover:text-[#1C1F1D] transition-colors">
              Return to home
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 lg:px-16 py-8 border-t border-[#E7E2D6]">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-xs text-[#9CA3AF]">© {new Date().getFullYear()} Rootline. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs text-[#6B7280]">
            <Link to="/terms" className="hover:text-[#1C1F1D] transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-[#1C1F1D] transition-colors font-medium text-[#1C1F1D]">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
