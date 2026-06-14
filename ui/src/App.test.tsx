import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/MemoryGraph', () => ({
  default: vi.fn(() => <div data-testid="memory-graph" />),
}));

describe('App', () => {
  it('renders MemoryGraph', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('memory-graph')).toBeInTheDocument();
  });
});
