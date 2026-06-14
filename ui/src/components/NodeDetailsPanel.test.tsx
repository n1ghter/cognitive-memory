import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NodeDetailsPanel from './NodeDetailsPanel';

describe('NodeDetailsPanel', () => {
  const mockNode = {
    id: 'test-node-1',
    name: 'Test Node',
    fullText: 'This is a test node with full text content.',
    val: 5,
    isActive: true,
    sourceDb: 'global',
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with node data', () => {
    render(<NodeDetailsPanel selectedNode={mockNode} onClose={mockOnClose} />);

    expect(screen.getByText('This is a test node with full text content.')).toBeInTheDocument();
    expect(screen.getByText('Global Node')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<NodeDetailsPanel selectedNode={mockNode} onClose={mockOnClose} />);

    const closeButtons = screen.getAllByRole('button');
    // First button is the top close button
    fireEvent.click(closeButtons[0]);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders correctly for local node', () => {
    const localNode = { ...mockNode, sourceDb: 'local' };
    render(<NodeDetailsPanel selectedNode={localNode} onClose={mockOnClose} />);

    expect(screen.getByText('Local Node')).toBeInTheDocument();
  });
});
