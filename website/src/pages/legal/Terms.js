import React from 'react';
import LegalPage from './LegalPage';

const Terms = () => (
  <LegalPage
    eyebrow="— Terms & conditions"
    title="House rules, plainly written."
    lede="The agreement between you and Hotel Sandhya Grand & Marriage Hall (Munger, Bihar) when you book a room, dine with us or hold an event in our hall."
    lastUpdated="June 2026"
    sections={[
      {
        heading: 'Who we are',
        body: (
          <>
            <p>
              "Hotel Sandhya Grand" refers to <strong>Hotel Sandhya Grand &
              Marriage Hall</strong>, operating from Bari Bazaar Road, Near
              Punjab National Bank, Munger, Bihar 811201, India. Throughout
              these terms "we", "our" and "us" refer to the hotel; "you" and
              "your" refer to the guest making the reservation.
            </p>
          </>
        ),
      },
      {
        heading: 'Reservations',
        body: (
          <>
            <p>
              A reservation is confirmed once you receive a written confirmation
              from us by email or WhatsApp. Walk-in guests are welcome but
              accommodation is subject to availability.
            </p>
            <p>
              We may ask for an advance to hold a room during peak dates and
              for all event bookings. The reservation may be released if the
              advance is not paid by the agreed time.
            </p>
          </>
        ),
      },
      {
        heading: 'Check-in & check-out',
        body: (
          <>
            <p>
              Standard check-in is from <strong>12:00 PM</strong> and check-out
              by <strong>11:00 AM</strong>. Early check-in and late check-out are
              offered subject to availability — please ask the front desk.
            </p>
            <p>
              All guests must present a valid government-issued photo ID at
              check-in (Aadhaar, Passport, Voter ID or Driving Licence). This
              is required by Bihar Police's hotel registration norms.
            </p>
            <p>
              Late check-out beyond 12:00 PM is charged as an additional night.
            </p>
          </>
        ),
      },
      {
        heading: 'Payment, taxes & invoice',
        body: (
          <>
            <p>
              Quoted rates are in Indian Rupees and exclude GST. The applicable
              <strong> 5% GST</strong> on accommodation and restaurant services
              is added to your invoice. A GST-compliant tax invoice is issued at
              check-out, with our GSTIN and HSN/SAC codes on every line.
            </p>
            <p>
              We accept cash, UPI, cards, and online payment via Razorpay. If
              you pay online and your booking is later cancelled or amended,
              refunds follow the schedule on our{' '}
              <a className="link-underline text-ink-900" href="/refund-policy">Refund policy</a>{' '}
              page.
            </p>
          </>
        ),
      },
      {
        heading: 'Conduct & house rules',
        body: (
          <>
            <p>We ask all guests to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Respect quiet hours between 10:00 PM and 7:00 AM.</li>
              <li>Not smoke in non-smoking rooms — a cleaning charge applies if violated.</li>
              <li>Not bring outside food and beverages into the restaurant or hall.</li>
              <li>Take responsibility for any damage caused to hotel property; we may bill the cost of repair.</li>
              <li>Inform the front desk of any visitors; only registered guests may stay overnight.</li>
            </ul>
            <p>
              We reserve the right to refuse service or end a stay in case of
              behaviour that disrupts other guests, threatens staff safety, or
              breaches Indian law.
            </p>
          </>
        ),
      },
      {
        heading: 'Children & extra beds',
        body: (
          <>
            <p>
              Children under five years stay free of charge when using existing
              bedding. Extra beds for older children and additional adults are
              offered subject to room capacity, on a complimentary or chargeable
              basis depending on category. Please confirm with the front desk
              at the time of booking.
            </p>
          </>
        ),
      },
      {
        heading: 'Restaurant & room service',
        body: (
          <>
            <p>
              Outside food and beverages may not be brought into the restaurant
              or the wedding hall. Restaurant orders attract 5% GST and are
              added to your room folio (for in-house guests) or settled directly
              at the table.
            </p>
            <p>
              Room service operates 7:00 AM – 11:00 PM. Late-night orders may
              be available on request, with a surcharge.
            </p>
          </>
        ),
      },
      {
        heading: 'Liability',
        body: (
          <>
            <p>
              We take reasonable care of guest belongings while you are with us,
              but valuables should be kept in your room safe or handed to the
              front desk for safekeeping. We are not liable for loss of cash,
              jewellery or electronics left unattended in public areas.
            </p>
            <p>
              Use of the swimming area, gym (where available) and outdoor
              spaces is at the guest's own risk. Children must be supervised
              by an accompanying adult at all times.
            </p>
          </>
        ),
      },
      {
        heading: 'Governing law',
        body: (
          <>
            <p>
              These terms are governed by the laws of India. Any disputes are
              subject to the exclusive jurisdiction of the courts at Munger,
              Bihar.
            </p>
          </>
        ),
      },
    ]}
  />
);

export default Terms;
