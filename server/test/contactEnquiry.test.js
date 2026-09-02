import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import ContactEnquiry from '../models/ContactEnquiry.js';

mongoose.set('bufferCommands', false); // validation is local

const here = path.dirname(fileURLToPath(import.meta.url));
const controllerSrc = fs.readFileSync(path.join(here, '..', 'controllers', 'websiteController.js'), 'utf8');

// The endpoint console.logged the request body and answered "we will get back
// to you soon". Nothing stored it, nobody was told, and the one thing it did do
// was copy a member of the public's name, email and phone into the log files.

const submitContactSrc = () => {
  const start = controllerSrc.indexOf('export const submitContact');
  assert.ok(start > -1, 'submitContact not found');
  return controllerSrc.slice(start, controllerSrc.indexOf('\nexport const', start + 10));
};

test('the request body is never written to the log', () => {
  const src = submitContactSrc();
  assert.doesNotMatch(src, /console\.(log|error|warn)\([^)]*req\.body/,
    'the body holds a stranger name, email and phone — it must not reach the logs');
  // The catch logs the error message only, not the payload.
  assert.match(src, /console\.error\('Error submitting contact form:', error\.message\)/);
});

test('the enquiry is persisted, and before the email is attempted', () => {
  const src = submitContactSrc();
  const saved = src.indexOf('ContactEnquiry.create');
  const mailed = src.indexOf('sendEmail');
  assert.ok(saved > -1, 'the enquiry must be stored, not just logged');
  assert.ok(mailed > -1, 'reception must be told');
  assert.ok(saved < mailed,
    'store first: a mail outage must not lose the enquiry');
});

test('a failed notification does not fail the request or lose the message', () => {
  const src = submitContactSrc();
  // The sendEmail call sits in its own try/catch inside the handler.
  const mailBlock = src.slice(src.indexOf('try {', src.indexOf('ContactEnquiry.create')));
  assert.match(mailBlock, /catch \(mailError\)/, 'the email must be allowed to fail on its own');
  assert.match(src, /notified = true/, 'a successful notification is recorded on the enquiry');
});

test('the guest text is escaped before it is put in an HTML email', () => {
  const src = submitContactSrc();
  for (const field of ['name', 'enquiry.email', 'enquiry.message']) {
    assert.match(src, new RegExp(`escapeHtml\\(${field.replace('.', '\\.')}`),
      `${field} is interpolated into HTML unescaped`);
  }
});

test('a submission without a name, email or message is refused', async () => {
  // Mirrors the handler's guard; the model agrees with it.
  const missing = new ContactEnquiry({ firstName: '', email: '', message: '' });
  const err = await missing.validate().then(() => null).catch((e) => e);
  assert.ok(err, 'the model must require the three fields the handler requires');
  for (const f of ['firstName', 'email', 'message']) {
    assert.ok(err.errors[f], `${f} should be required`);
  }
});

test('a valid enquiry validates and starts as new and un-notified', async () => {
  const doc = new ContactEnquiry({
    firstName: 'Asha', lastName: 'Verma', email: 'ASHA@Example.TEST',
    phone: '9000000000', subject: 'Room for October', message: 'Do you have a family room?',
  });
  assert.equal(await doc.validate().then(() => null).catch((e) => e), null);
  assert.equal(doc.status, 'new');
  assert.equal(doc.notified, false, 'notified:false is how an unreported enquiry is found');
  assert.equal(doc.email, 'asha@example.test', 'email is normalised for matching');
});

test('the sender IP is kept for abuse investigation but not selected by default', () => {
  assert.equal(ContactEnquiry.schema.path('sourceIp').options.select, false,
    'an ordinary read must not carry the IP along with the personal data');
});

test('oversized input is bounded by the schema as well as the handler', () => {
  for (const [field, max] of [['message', 5000], ['firstName', 100], ['email', 200], ['subject', 200]]) {
    assert.equal(ContactEnquiry.schema.path(field).options.maxlength, max,
      `${field} needs a length bound — this endpoint is public`);
  }
});

test('the public endpoint is rate limited', () => {
  const routes = fs.readFileSync(path.join(here, '..', 'routes', 'websiteRoutes.js'), 'utf8');
  assert.match(routes, /router\.post\('\/contact', contactLimiter, submitContact\)/,
    'a public endpoint that writes to the database and sends mail needs its own limit');
});

test('reading enquiries back requires a guest permission', () => {
  const routes = fs.readFileSync(path.join(here, '..', 'routes', 'contactEnquiryRoutes.js'), 'utf8');
  assert.match(routes, /requirePermission\(\['view_guests', 'manage_guests', 'manage_bookings'\]\)/);
  assert.match(routes, /router\.use\(authenticateToken\)/);
  // Authentication before authorization, as everywhere else.
  assert.ok(routes.indexOf('authenticateToken') < routes.indexOf('requirePermission(['));
});
