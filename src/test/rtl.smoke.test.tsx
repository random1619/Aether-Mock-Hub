import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>count {n}</button>;
}

describe('RTL smoke', () => {
  it('renders and responds to a user click', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    const btn = screen.getByRole('button', { name: /count 0/ });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(screen.getByRole('button', { name: /count 1/ })).toBeInTheDocument();
  });
});
