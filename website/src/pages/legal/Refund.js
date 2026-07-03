import React from 'react';
import LegalPage from './LegalPage';

const Refund = () => (
  <LegalPage
    eyebrow="— Refund & cancellation"
    title="If plans change."
    lede="A short, clear note on what happens if a reservation needs to be cancelled, shortened or refunded — for both room and event bookings."
    lastUpdated="June 2026"
    sections={[
      {
        heading: 'Room cancellations',
        body: (
          <>
            <p>
              Reservations cancelled at least <strong>48 hours</strong> before the
              scheduled check-in receive a full refund of any amount paid online,
              less payment-gateway charges. Cancellations within 48 hours of
              check-in are charged for the first night; the balance is refunded.
            </p>
            <p>
              No-shows — guests who do not arrive on the booked date and do not
              inform us — are charged the full first-night tariff. Any remaining
              nights are refunded to the original payment method.
            </p>
          </>
        ),
      },
      {
        heading: 'Event & wedding-hall bookings',
        body: (
          <>
            <p>
              Hall bookings carry a non-refundable booking advance equal to{' '}
              <strong>25%</strong> of the agreed hall charges. The remaining
              balance is refundable on the following schedule:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>More than 30 days before the event — 100% of the balance refunded.</li>
              <li>15–30 days before the event — 50% of the balance refunded.</li>
              <li>Within 15 days of the event — balance non-refundable.</li>
            </ul>
            <p>
              Force-majeure situations (government restriction, natural calamity,
              bereavement) are reviewed individually; we will always try to
              reschedule before refunding.
            </p>
          </>
        ),
      },
      {
        heading: 'Early checkout',
        body: (
          <>
            <p>
              If you check out earlier than the booked date, we charge for the
              nights actually stayed plus one additional night, and refund the
              balance. Folio charges (restaurant, room service, laundry) are
              billed in full.
            </p>
          </>
        ),
      },
      {
        heading: 'How refunds are processed',
        body: (
          <>
            <p>
              Refunds are issued to the original payment method:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Razorpay / card / UPI payments — credited within <strong>5–7 working days</strong>.</li>
              <li>Cash payments made at the desk — refunded in cash on request, or by bank transfer within 3 working days.</li>
            </ul>
            <p>
              The exact date of credit depends on your bank or wallet provider.
              For UPI refunds, the credit usually appears within 24–48 hours.
            </p>
          </>
        ),
      },
      {
        heading: 'How to request a refund',
        body: (
          <>
            <p>
              Email <a className="link-underline text-ink-900" href="mailto:reservations@sandhyagrand.com">reservations@sandhyagrand.com</a> with
              your booking reference and the reason for cancellation, or call
              the front desk on <a className="link-underline text-ink-900" href="tel:+919431419196">+91 94314 19196</a>.
              We reply within one working day with a confirmation and the
              expected refund amount.
            </p>
          </>
        ),
      },
    ]}
  />
);

export default Refund;
