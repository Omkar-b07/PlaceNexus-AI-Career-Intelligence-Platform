import { MongoClient } from 'mongodb';

let preparationDatabasePromise;

function configurationError(message) {
  const error = new Error(message);
  error.code = 'PREPARATION_DATABASE_CONFIGURATION_ERROR';
  error.statusCode = 503;
  return error;
}

export async function connectPreparationDatabase() {
  const uri = process.env.PREPARATION_MONGODB_URI?.trim();
  if (!uri) {
    throw configurationError('Preparation MongoDB is not configured. Set PREPARATION_MONGODB_URI in backend/.env.');
  }

  if (!preparationDatabasePromise) {
    preparationDatabasePromise = (async () => {
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
      try {
        await client.connect();
        const database = client.db(process.env.PREPARATION_MONGODB_DB_NAME?.trim() || 'PlaceNexusPreparation');
        await database.collection('dsaProblems').createIndexes([
          { key: { externalId: 1 }, name: 'unique_dsa_external_id', unique: true },
          { key: { title: 1 }, name: 'dsa_problems_by_title' },
          { key: { difficulty: 1 }, name: 'dsa_problems_by_difficulty' },
          { key: { topics: 1 }, name: 'dsa_problems_by_topic' }
        ]);
        await database.collection('dsaProgress').createIndexes([
          { key: { userId: 1 }, name: 'unique_dsa_progress_user', unique: true },
          { key: { 'solvedProblems.problemId': 1 }, name: 'dsa_progress_by_problem' }
        ]);
        return database;
      } catch (error) {
        await client.close().catch(() => {});
        throw error;
      }
    })().catch((error) => {
      preparationDatabasePromise = undefined;
      throw error;
    });
  }

  return preparationDatabasePromise;
}

export async function getDsaProblemsCollection() {
  return (await connectPreparationDatabase()).collection('dsaProblems');
}

export async function getDsaProgressCollection() {
  return (await connectPreparationDatabase()).collection('dsaProgress');
}
