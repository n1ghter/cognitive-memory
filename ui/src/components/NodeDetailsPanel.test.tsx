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
  const mockOnNavigateToNode = vi.fn();
  const mockLinks: any[] = [];
  const mockAllNodes: any[] = [mockNode];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with node data', () => {
    render(
      <NodeDetailsPanel
        selectedNode={mockNode}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );

    expect(screen.getByText('This is a test node with full text content.')).toBeInTheDocument();
    expect(screen.getByText('Global Node')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <NodeDetailsPanel
        selectedNode={mockNode}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );

    const closeButtons = screen.getAllByRole('button');
    // First button is the top close button
    fireEvent.click(closeButtons[0]);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders correctly for local node', () => {
    const localNode = { ...mockNode, sourceDb: 'local' };
    render(
      <NodeDetailsPanel
        selectedNode={localNode}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );

    expect(screen.getByText('Local Node')).toBeInTheDocument();
  });

  it('handles copy text and copy id', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });

    render(
      <NodeDetailsPanel
        selectedNode={mockNode}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );

    const copyTextBtn = screen.getAllByRole('button')[1];
    fireEvent.click(copyTextBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'This is a test node with full text content.'
    );

    const copyIdBtn = screen.getAllByRole('button')[2];
    fireEvent.click(copyIdBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-node-1');
  });

  it('handles button hover states', () => {
    render(
      <NodeDetailsPanel
        selectedNode={mockNode}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );
    const closeButton = screen.getAllByRole('button')[0];

    fireEvent.mouseOver(closeButton);
    expect(closeButton.style.background).toBe('rgba(255, 255, 255, 0.1)');

    fireEvent.mouseOut(closeButton);
    expect(closeButton.style.background).toBe('rgba(255, 255, 255, 0.05)');

    fireEvent.focus(closeButton);
    expect(closeButton.style.background).toBe('rgba(255, 255, 255, 0.1)');

    fireEvent.blur(closeButton);
    expect(closeButton.style.background).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('renders metadata correctly when stringified JSON', () => {
    const nodeWithMeta = { ...mockNode, metadata: '{"key": "value"}' };
    render(
      <NodeDetailsPanel
        selectedNode={nodeWithMeta}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );
    expect(screen.getByText(/value/)).toBeInTheDocument();
  });

  it('renders metadata correctly when string', () => {
    const nodeWithMeta = { ...mockNode, metadata: 'plain string' };
    render(
      <NodeDetailsPanel
        selectedNode={nodeWithMeta}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );
    expect(screen.getByText(/plain string/)).toBeInTheDocument();
  });

  it('renders metadata correctly when object', () => {
    const nodeWithMeta = { ...mockNode, metadata: { key: 'object value' } };
    render(
      <NodeDetailsPanel
        selectedNode={nodeWithMeta}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );
    expect(screen.getByText(/object value/)).toBeInTheDocument();
  });
  it('renders correctly when selectedNode is null', () => {
    const { container } = render(
      <NodeDetailsPanel
        selectedNode={null}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );
    expect(container.firstChild).toHaveClass('closed');
  });

  it('renders correctly for inactive local node', () => {
    const inactiveLocalNode = { ...mockNode, sourceDb: 'local', isActive: false };
    render(
      <NodeDetailsPanel
        selectedNode={inactiveLocalNode}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );
    expect(screen.getByText('Local Node')).toBeInTheDocument();
  });

  it('renders name fallback when fullText is missing and copies name', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });

    const nodeWithoutFullText = { ...mockNode, fullText: undefined, name: 'Fallback Name' };
    render(
      <NodeDetailsPanel
        selectedNode={nodeWithoutFullText}
        onClose={mockOnClose}
        links={mockLinks}
        allNodes={mockAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );
    expect(screen.getByText('Fallback Name')).toBeInTheDocument();

    const copyTextBtn = screen.getAllByRole('button')[1];
    fireEvent.click(copyTextBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Fallback Name');
  });

  it('renders connected memories and handles navigation click', () => {
    const customLinks = [
      { source: { id: mockNode.id }, target: { id: 'other-node-1' } },
      { source: 'other-node-2', target: mockNode.id },
    ];
    const customAllNodes = [
      mockNode,
      { id: 'other-node-1', name: 'Other Node 1' },
      { id: 'other-node-2', fullText: 'Other Node 2' },
    ];
    render(
      <NodeDetailsPanel
        selectedNode={mockNode}
        onClose={mockOnClose}
        links={customLinks}
        allNodes={customAllNodes}
        onNavigateToNode={mockOnNavigateToNode}
      />
    );

    expect(screen.getByText('Other Node 1')).toBeInTheDocument();
    expect(screen.getByText('Other Node 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Other Node 1'));
    expect(mockOnNavigateToNode).toHaveBeenCalledWith(customAllNodes[1]);
  });
});
