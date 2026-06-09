import { DatabaseManager } from '../db.js';

/**
 * Interface for DeleteArgs object.
 */
interface DeleteArgs {
  /**
   * The ID of the record to be deleted or soft-deleted.
   */
  id: string;
  /**
   * A boolean flag indicating whether to perform a hard delete (physical purge) or a soft delete.
   */
  hard?: boolean;
}

/**
 * Executes a memory delete operation, either physically purging a record or soft-deleting it.
 *
 * @param args - An object containing the ID of the record to be deleted or soft-deleted and an optional flag for hard deletion.
 * @returns A promise resolving with an object indicating whether the operation was successful and additional information about the result.
 */
export async function executeMemoryDelete(args: DeleteArgs): Promise<any> {
  const { id, hard = false } = args;

  if (!id) {
    throw new Error('Invalid input: "id" is required');
  }

  const db = DatabaseManager.getInstance();
  let found = false;

  if (hard) {
    // Hard delete - physical purge
    const transaction = db.transaction(() => {
      // Delete any edges referencing this memory
      db.prepare('DELETE FROM edges WHERE source_id = ? OR target_id = ?').run(id, id);
      const stmt = db.prepare('DELETE FROM memory WHERE id = ?');
      return stmt.run(id);
    });

    const info = transaction();
    if (info.changes > 0) {
      found = true;
    }
  } else {
    // Soft delete - update fields to make it inactive and low importance
    const stmt = db.prepare(`
      UPDATE memory 
      SET is_active = 0, importance = 0.0 
      WHERE id = ?
    `);
    const info = stmt.run(id);
    if (info.changes > 0) {
      found = true;
    }
  }

  return {
    /**
     * A boolean flag indicating whether the operation was successful.
     */
    success: true,
    /**
     * A message describing the outcome of the operation.
     */
    message: found
      ? `Memory record '${id}' was ${hard ? 'physically purged' : 'soft-deleted'} successfully.`
      : `No memory record was found with ID '${id}'.`,
    /**
     * The ID of the record that was deleted or soft-deleted.
     */
    id: id,
    /**
     * A boolean flag indicating whether the operation resulted in a deletion.
     */
    deleted: found,
    /**
     * A string indicating the type of delete operation performed (hard or soft).
     */
    type: hard ? 'hard' : 'soft',
  };
}
