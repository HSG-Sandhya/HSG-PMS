import React from 'react';
import LegalPage from './LegalPage';

const Privacy = () => (
  <LegalPage
    eyebrow="— Privacy policy"
    title="What we keep, and why."
    lede="A plain-language note on the information we collect when you book a stay, dine with us or send an enquiry — and how we look after it."
    lastUpdated="June 2026"
    sections={[
      {
        heading: 'What we collect',
        body: (
          <>
            <p>We collect only what we need to run the hotel honestly:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Reservation details</strong> — your name, phone, email, the city you're coming from, and dates of stay.</li>
              <li><strong>Identification</strong> — a copy of a government-issued ID at check-in (mandated by Bihar Police).</li>
              <li><strong>Payment information</strong> — handled by Razorpay; we never store your card number or CVV on our servers.</li>
              <li><strong>Communication</strong> — emails, WhatsApp messages or call notes related to your stay.</li>
              <li><strong>Site usage</strong> — basic analytics (page views, referring source). No personal profiling.</li>
            </ul>
          </>
        ),
      },
      {
        heading: 'How we use it',
        body: (
          <>
            <p>We use this information to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Confirm and prepare your reservation.</li>
              <li>Issue GST-compliant invoices and meet our statutory obligations.</li>
              <li>Reach out about your stay — pre-arrival, while you're with us, and afterward if there's a follow-up.</li>
              <li>Comply with police-station guest-registration norms in Bihar.</li>
            </ul>
            <p>
              We <strong>do not</strong> sell, rent or share your information for
              third-party marketing. Promotional emails are sent only if you have
              opted in, and you can opt out from any such message in one click.
            </p>
          </>
        ),
      },
      {
        heading: 'Who else sees it',
        body: (
          <>
            <p>A short, finite list of people and services that handle your data on our behalf:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Razorpay</strong> — for online payment processing.</li>
              <li><strong>Email & SMS providers</strong> — to deliver booking confirmations.</li>
              <li><strong>Government authorities</strong> — only where required by law (police-station register, GST returns, court orders).</li>
            </ul>
            <p>
              All third parties we work with are bound by their own data
              protection obligations. We do not transfer your data outside India
              for any other purpose.
            </p>
          </>
        ),
      },
      {
        heading: 'How long we keep it',
        body: (
          <>
            <p>
              We retain reservation, billing and GST records for the period
              required by Indian tax law (currently <strong>8 years</strong> from
              the end of the financial year). Marketing-related data is kept
              only as long as you remain opted in. Surveillance footage from
              hotel common areas is retained for <strong>15 days</strong> on a
              rolling basis.
            </p>
          </>
        ),
      },
      {
        heading: 'Your rights',
        body: (
          <>
            <p>You can write to us any time to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>See a copy of the data we hold about you.</li>
              <li>Correct any detail that's wrong or out of date.</li>
              <li>Have your details deleted from our marketing list.</li>
              <li>Request deletion of your reservation history, subject to records we're required by law to keep.</li>
            </ul>
            <p>
              Send these requests to <a className="link-underline text-ink-900" href="mailto:info@sandhyagrand.com">info@sandhyagrand.com</a>.
              We respond within seven working days.
            </p>
          </>
        ),
      },
      {
        heading: 'Cookies',
        body: (
          <>
            <p>
              Our website uses a small number of functional cookies (session,
              language, preferences). We do not run advertising or cross-site
              tracking cookies. You can clear or block cookies in your browser
              at any time; the booking flow will still work.
            </p>
          </>
        ),
      },
    ]}
  />
);

export default Privacy;
