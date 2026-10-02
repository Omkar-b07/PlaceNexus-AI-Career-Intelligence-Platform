import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createPasswordHash } from '../src/services/authService.js';
import { getUsersCollection } from '../src/services/database.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tpoRoles = new Set(['TPO', 'ADMIN']);

function resetError(message) {
  const error = new Error(message);
  error.isResetError = true;
  return error;
}

function requireDevelopmentTerminal() {
  if (process.env.NODE_ENV === 'production') {
    throw resetError('The TPO reset script is disabled when NODE_ENV is production.');
  }
  if (!input.isTTY || !output.isTTY) {
    throw resetError('Run this command from an interactive local terminal.');
  }
}

async function promptEmail() {
  const prompt = createInterface({ input, output });
  try {
    return (await prompt.question('TPO email: ')).trim().toLowerCase();
  } finally {
    prompt.close();
  }
}

function promptSecret(label) {
  const prompt = createInterface({ input, output, terminal: true });
  const writeOutput = prompt._writeToOutput.bind(prompt);
  let hideInput = false;

  // readline manages Windows CRLF as one line. Only the prompt is written;
  // every typed character is muted until the user presses Enter.
  prompt._writeToOutput = (text) => {
    if (!hideInput) writeOutput(text);
  };

  const answer = prompt.question(label);
  hideInput = true;
  return answer.finally(() => {
    prompt.close();
    output.write('\n');
  });
}

async function resetTpoPassword() {
  requireDevelopmentTerminal();

  const email = await promptEmail();
  if (!emailPattern.test(email)) throw resetError('Reset failed. Enter a valid TPO email address.');

  const password = await promptSecret('New password: ');
  const confirmation = await promptSecret('Confirm password: ');
  if (password.length < 8) throw resetError('Reset failed. Password must be at least 8 characters.');
  if (password !== confirmation) throw resetError('Reset failed. Password confirmation does not match.');

  const users = await getUsersCollection();
  const user = await users.findOne({ email }, { projection: { _id: 1, role: 1 } });
  if (!user || !tpoRoles.has(user.role)) {
    throw resetError('Reset failed. No TPO/Admin account matched that email.');
  }

  const passwordHash = await createPasswordHash(password);
  const result = await users.updateOne(
    { _id: user._id, role: { $in: [...tpoRoles] } },
    { $set: { passwordHash } }
  );
  if (result.modifiedCount !== 1) throw resetError('Reset failed. The account role changed before the password could be updated.');

  console.log('TPO password reset completed.');
}

resetTpoPassword()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.isResetError ? error.message : 'Reset failed. Check MongoDB connectivity and try again.');
    process.exit(1);
  });
