import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MemoryGraph from './MemoryGraph';

// Mock react-force-graph components
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(() => <div data-testid="force-graph-2d" />)
}));

vi.mock('react-force-graph-3d', () => ({
  default: vi.fn(() => <div data-testid="force-graph-3d" />)
}));

describe('MemoryGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() => new Promise(() => {})) as any; // Never resolves, so it stays in loading state
  });

  it('renders loading state initially', () => {
    render(<MemoryGraph />);
    expect(screen.getByText('RECONSTRUCTING MEMORY LINKS...')).toBeInTheDocument();
  });

  it('renders filters and controls correctly', () => {
    render(<MemoryGraph />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('🌍 Global')).toBeInTheDocument();
    expect(screen.getByText('🏠 Local')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search memories... (Ctrl+K)')).toBeInTheDocument();
    expect(screen.getByTitle('Reset View')).toBeInTheDocument();
  });

  it('allows typing in the search bar', () => {
    render(<MemoryGraph />);
    const searchInput = screen.getByPlaceholderText('Search memories... (Ctrl+K)') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    expect(searchInput.value).toBe('test search');
  });

  it('changes active filter when clicked', () => {
    render(<MemoryGraph />);
    const localFilter = screen.getByText('🏠 Local');
    const globalFilter = screen.getByText('🌍 Global');
    
    fireEvent.click(localFilter);
    expect(localFilter.style.background).toContain('rgba(59, 130, 246');
    
    fireEvent.click(globalFilter);
    expect(globalFilter.style.background).toContain('rgba(59, 130, 246');
  });
});
