import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecuteMemoryConsolidate = vi.fn();
const mockExecuteMemoryExport = vi.fn();
const mockDatabaseManagerClose = vi.fn();

vi.mock('../src/tools/consolidate.js', () => ({
  executeMemoryConsolidate: mockExecuteMemoryConsolidate,
}));

vi.mock('../src/tools/export.js', () => ({
  executeMemoryExport: mockExecuteMemoryExport,
}));

vi.mock('../src/db.js', () => ({
  DatabaseManager: {
    close: mockDatabaseManagerClose,
  },
}));

describe('Hooks Bootstrap', () => {
  let originalArgv: string[];
  let exitSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.resetModules();
    originalArgv = process.argv;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExecuteMemoryConsolidate.mockReset();
    mockExecuteMemoryExport.mockReset();
    mockDatabaseManagerClose.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should run SessionStart hooks if no argv is provided (default)', async () => {
    process.argv = ['node', 'bootstrap.js']; // event is undefined -> 'SessionStart'

    // Import dynamically so that the module evaluates with the mocked argv
    await import('../src/hooks/bootstrap.js');

    expect(mockExecuteMemoryExport).toHaveBeenCalledTimes(1);
    expect(mockExecuteMemoryConsolidate).not.toHaveBeenCalled();
    expect(mockDatabaseManagerClose).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should run PreCompact hooks if event is PreCompact', async () => {
    process.argv = ['node', 'bootstrap.js', 'PreCompact'];

    await import('../src/hooks/bootstrap.js');

    expect(mockExecuteMemoryExport).not.toHaveBeenCalled();
    expect(mockExecuteMemoryConsolidate).toHaveBeenCalledTimes(1);
    expect(mockDatabaseManagerClose).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should run both hooks if event is Stop', async () => {
    process.argv = ['node', 'bootstrap.js', 'Stop'];

    await import('../src/hooks/bootstrap.js');

    expect(mockExecuteMemoryExport).toHaveBeenCalledTimes(1);
    expect(mockExecuteMemoryConsolidate).toHaveBeenCalledTimes(1);
    expect(mockDatabaseManagerClose).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle errors gracefully and still close the DB and exit', async () => {
    process.argv = ['node', 'bootstrap.js', 'Stop'];
    mockExecuteMemoryExport.mockRejectedValueOnce(new Error('Export failed'));

    await import('../src/hooks/bootstrap.js');

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Hooks] Error running hooks:', expect.any(Error));
    expect(mockDatabaseManagerClose).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
