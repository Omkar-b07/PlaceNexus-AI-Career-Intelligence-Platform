import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { hasValidProfilePhotoSignature, profilePhotoPathFromUrl, resumePathFromId } from '../src/middleware/upload.js';
import { emptySocialLinks, normalizePartial, normalizeSocialLinks, profileCompletion, setProfileResume } from '../src/services/profileService.js';
import { resumeTextHash } from '../src/services/resumeAnalysisService.js';
import profileCatalog from '../../shared/profileCatalog.json' with { type: 'json' };

test('accepts each canonical branch value and rejects values outside the branch catalog', () => {
  for (const { value } of profileCatalog.branchOptions) {
    assert.equal(normalizePartial({ branch: value }).branch, value);
  }
  assert.throws(() => normalizePartial({ branch: 'CS' }), { code: 'INVALID_PROFILE' });
  assert.throws(() => normalizePartial({ branch: 'Computer Science and Engineering' }), { code: 'INVALID_PROFILE' });
});

test('preserves an unchanged legacy branch without including it in profile updates', () => {
  assert.deepEqual(normalizePartial({ branch: 'Information Technology' }, 'Information Technology'), {});
  assert.throws(() => normalizePartial({ branch: 'IT' }, 'Information Technology'), { code: 'INVALID_PROFILE' });
});

test('normalizes the canonical optional social links object', () => {
  const links = normalizeSocialLinks({
    github: 'https://github.com/student',
    linkedin: 'http://www.linkedin.com/in/student',
    portfolio: 'https://portfolio.example/student',
    leetcode: 'https://leetcode.com/u/student/'
  });

  assert.deepEqual(links, {
    github: 'https://github.com/student',
    linkedin: 'http://www.linkedin.com/in/student',
    portfolio: 'https://portfolio.example/student',
    leetcode: 'https://leetcode.com/u/student/'
  });
  assert.deepEqual(normalizeSocialLinks({}), emptySocialLinks);
});

test('rejects unsafe or platform-mismatched social links before persistence', () => {
  assert.throws(() => normalizeSocialLinks({ github: 'javascript:alert(1)' }), { code: 'INVALID_PROFILE' });
  assert.throws(() => normalizeSocialLinks({ github: 'https://example.com/student' }), { code: 'INVALID_PROFILE' });
  assert.throws(() => normalizeSocialLinks({ portfolio: 'data:text/html,unsafe' }), { code: 'INVALID_PROFILE' });
});

test('profile photo and social links remain optional for profile completion', () => {
  const completion = profileCompletion({
    fullName: 'Student', phone: '+919999999999', branch: 'Information Technology', college: 'PlaceNexus College',
    cgpa: 8, backlogs: 0, graduationYear: 2027, skills: ['React'], projects: [], resume: null,
    preferredRoles: ['Software Engineer'], preferredLocations: ['Bengaluru'], socialLinks: emptySocialLinks, profilePhotoUrl: null
  });

  assert.equal(completion.fields.some((field) => field.key === 'socialLinks' || field.key === 'profilePhotoUrl'), false);
  assert.equal(completion.missingMandatory.length, 0);
});

test('resolves only UUID-backed resume files within the existing resume upload directory', () => {
  const resolved = resumePathFromId('123e4567-e89b-12d3-a456-426614174000.pdf');
  assert.ok(resolved?.endsWith(path.join('uploads', 'resumes', '123e4567-e89b-12d3-a456-426614174000.pdf')));
  assert.equal(resumePathFromId('../../.env'), null);
});

test('replacing a parsed resume persists the new canonical reference and invalidates a changed analysis hash', async () => {
  const writes = [];
  const resumeText = 'Built React interfaces and Node.js APIs.';
  await setProfileResume('student-1', {
    id: '123e4567-e89b-12d3-a456-426614174000.pdf', originalName: 'resume.pdf', mimeType: 'application/pdf', fileType: 'PDF', size: 1024,
    uploadedAt: '2026-10-03T00:00:00.000Z', resumeText
  }, {
    profilesCollection: {
      async findOne() { return { resume: { sourceHash: 'previous-resume-hash' } }; },
      async updateOne(filter, update, options) { writes.push({ filter, update, options }); }
    }
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].filter.userId, 'student-1');
  assert.equal(writes[0].update.$set.resume.id, '123e4567-e89b-12d3-a456-426614174000.pdf');
  assert.equal(writes[0].update.$set.resume.resumeText, resumeText);
  assert.equal(writes[0].update.$set.resume.sourceHash, resumeTextHash(resumeText));
  assert.deepEqual(writes[0].update.$unset, { resumeAnalysis: '' });
});

test('accepts only image content that matches the claimed profile photo MIME type', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Buffer.from('RIFF1234WEBPVP8 ', 'ascii');

  assert.equal(hasValidProfilePhotoSignature({ mimetype: 'image/png' }, png), true);
  assert.equal(hasValidProfilePhotoSignature({ mimetype: 'image/jpeg' }, jpeg), true);
  assert.equal(hasValidProfilePhotoSignature({ mimetype: 'image/webp' }, webp), true);
  assert.equal(hasValidProfilePhotoSignature({ mimetype: 'image/png' }, jpeg), false);
  assert.equal(hasValidProfilePhotoSignature({ mimetype: 'image/png' }, Buffer.from('not an image')), false);
});

test('maps only generated profile photo URLs to the storage directory', () => {
  const filename = '123e4567-e89b-12d3-a456-426614174000.png';
  assert.equal(path.basename(profilePhotoPathFromUrl(`/profile-photos/${filename}`) || ''), filename);
  assert.equal(profilePhotoPathFromUrl('/profile-photos/../../secrets.txt'), null);
  assert.equal(profilePhotoPathFromUrl('https://example.com/photo.png'), null);
});
