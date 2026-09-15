import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELIGIBILITY_MATCH,
  ELIGIBILITY_NO_MATCH,
  ELIGIBILITY_UNKNOWN,
  evaluateEligibility,
  filterNotifications,
  getMatchedNotifications,
  getOfficialNotificationUrl,
  isCurrentNotification,
  toggleReminderId,
} from './notificationEligibility.js';

const exam = {
  qualification: 'Bachelor degree',
  degree: 'BSc',
  stream: 'Computer Science',
  age_limit: '18 to 30 years',
};

const profile = (qualification, age = 25) => ({
  age,
  qualifications: [qualification],
});

const matchingQualification = {
  highestQualification: 'Bachelor degree',
  degree: 'BSc',
  specialization: 'Computer Science',
};

test('returns MATCH when all stated education requirements match', () => {
  assert.equal(evaluateEligibility(exam, profile(matchingQualification)), ELIGIBILITY_MATCH);
});

test('uses ANY-match semantics across all profile qualifications', () => {
  const userProfile = {
    age: 25,
    qualifications: [
      { highestQualification: 'Master degree' },
      matchingQualification,
    ],
  };
  assert.equal(evaluateEligibility(exam, userProfile), ELIGIBILITY_MATCH);
});

test('returns NO_MATCH only when available profile data disproves requirements', () => {
  assert.equal(evaluateEligibility(exam, profile({
    highestQualification: 'Bachelor degree',
    degree: 'BA',
    specialization: 'Computer Science',
  })), ELIGIBILITY_NO_MATCH);
  assert.equal(evaluateEligibility(exam, profile(matchingQualification, 40)), ELIGIBILITY_NO_MATCH);
});

test('returns UNKNOWN for missing qualification or required degree data', () => {
  assert.equal(evaluateEligibility({ ...exam, qualification: null }, profile(matchingQualification)), ELIGIBILITY_UNKNOWN);
  assert.equal(evaluateEligibility(exam, profile({ highestQualification: 'Bachelor degree' })), ELIGIBILITY_UNKNOWN);
  assert.equal(evaluateEligibility(exam, { age: 25, qualifications: [] }), ELIGIBILITY_UNKNOWN);
});

test('does not reject otherwise matching qualifications for absent or unparseable age', () => {
  assert.equal(evaluateEligibility(exam, profile(matchingQualification, null)), ELIGIBILITY_MATCH);
  assert.equal(evaluateEligibility(exam, profile(matchingQualification, 'unknown')), ELIGIBILITY_MATCH);
  assert.equal(evaluateEligibility({ ...exam, age_limit: null }, profile(matchingQualification)), ELIGIBILITY_MATCH);
});

test('shows only MATCH records and keeps active records with no verified deadline', () => {
  const notifications = [
    { ...exam, id: 'match', is_active: true, application_last_date: null },
    { ...exam, id: 'unknown', qualification: null, is_active: true, application_last_date: null },
    { ...exam, id: 'no-match', degree: 'BA', is_active: true, application_last_date: null },
    { ...exam, id: 'expired', is_active: true, application_last_date: '2000-01-01' },
    { ...exam, id: 'inactive', is_active: false, application_last_date: null },
  ];
  assert.deepEqual(
    getMatchedNotifications(notifications, profile(matchingQualification)).map(({ id }) => id),
    ['match']
  );
  assert.equal(isCurrentNotification({ is_active: true, application_last_date: null }), true);
  assert.equal(isCurrentNotification({ is_active: true, application_last_date: '2000-01-01' }), false);
});

test('applies category and search filters to the supplied matched set', () => {
  const matches = [
    { category: 'SSC', exam_name: 'Combined Graduate Level', organization: 'Staff Selection Commission' },
    { category: 'Banking', exam_name: 'Probationary Officer', organization: 'State Bank of India' },
  ];
  assert.deepEqual(filterNotifications(matches, 'SSC', 'graduate'), [matches[0]]);
  assert.deepEqual(filterNotifications(matches, 'Banking', 'state bank'), [matches[1]]);
  assert.deepEqual(filterNotifications(matches, 'UPSC', ''), []);
});

test('reminder toggling and official notification link fallback are stable', () => {
  assert.deepEqual(toggleReminderId(['one'], 'two'), ['one', 'two']);
  assert.deepEqual(toggleReminderId(['one', 'two'], 'one'), ['two']);
  assert.equal(getOfficialNotificationUrl({
    official_notification_url: 'https://official.gov/notice.pdf',
    official_website_url: 'https://official.gov',
  }), 'https://official.gov/notice.pdf');
  assert.equal(getOfficialNotificationUrl({
    official_notification_url: null,
    official_website_url: 'https://official.gov',
  }), 'https://official.gov');
  assert.equal(getOfficialNotificationUrl({}), null);
});
