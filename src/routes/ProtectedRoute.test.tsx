import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('../context/AuthContext', () => ({ useAuth }));

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<p>Protected content</p>} />
        </Route>
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects an anonymous visitor to login', () => {
    useAuth.mockReturnValue({ isAuthenticated: false });

    renderRoute();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the requested route for an authenticated visitor', () => {
    useAuth.mockReturnValue({ isAuthenticated: true });

    renderRoute();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
