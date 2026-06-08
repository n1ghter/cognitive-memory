import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { DatabaseManager } from '../src/db.js';

/**
 * Run end-to-end (E2E) tests for store and search functionality.
 */
async function runE2E(): Promise<void> {
  console.log('--- E2E Test Started ---');

  try {
    // 1. Store
    console.log('Testing Store...');
    const storeRes1 = await executeMemoryStore({
      /**
       * Text to be stored in the database.
       */
      text: 'SQLite is an in-process database that is very fast.',
      /**
       * Metadata for the stored record, including its type and importance.
       */
      metadata: { type: 'semantic' },
      /**
       * Importance level of the stored record (on a scale of 0 to 1).
       */
      importance: 0.8
    });
    console.log('Store 1 Success:', storeRes1.success, storeRes1.record.id);

    const storeRes2 = await executeMemoryStore({
      /**
       * Text to be stored in the database.
       */
      text: 'SurrealDB is a cloud database and is client-server.',
      /**
       * Metadata for the stored record, including its type and importance.
       */
      metadata: { type: 'semantic' },
      /**
       * Importance level of the stored record (on a scale of 0 to 1).
       */
      importance: 0.8
    });
    console.log('Store 2 Success:', storeRes2.success, storeRes2.record.id);

    // 2. Search
    console.log('\nTesting Search...');
    const searchRes = await executeMemorySearch({
      /**
       * Query to be searched in the database.
       */
      query: 'What is SQLite?',
      /**
       * Maximum number of results to return from the search.
       */
      limit: 2,
      /**
       * Threshold for matching records (on a scale of 0 to 1).
       */
      threshold: 0.5
    });

    console.log('Search Success:', searchRes.success);
    console.log('Search Results:');
    for (const res of searchRes.results) {
      console.log(`- [${res.similarity.toFixed(3)}] ${res.text}`);
    }

  } catch (error) {
    console.error('E2E Test Failed:', error);
  } finally {
    /**
     * Close the database connection.
     */
    DatabaseManager.close();
    console.log('--- E2E Test Finished ---');
  }
}

runE2E();