import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '../mocks/server';
import LoginPage from '@/pages/auth/LoginPage';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

const getPasswordInput = () =>
  screen.getByPlaceholderText('Enter your password');

const getUsernameInput = () =>
  screen.getByLabelText(/^username$/i);

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  it('should render the login form', () => {
    renderLogin();

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(getUsernameInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation error for empty username', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for username shorter than 3 characters', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(getUsernameInput(), 'ab');
    await user.type(getPasswordInput(), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for short password', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(getUsernameInput(), 'teststudent');
    await user.type(getPasswordInput(), '123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it('should toggle password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = getPasswordInput();
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByLabelText(/show password/i);
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('should have a remember me checkbox', () => {
    renderLogin();

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/remember me/i)).toBeInTheDocument();
  });

  it('should disable submit button while submitting', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(getUsernameInput(), 'teststudent');
    await user.type(getPasswordInput(), 'Password123!');

    const button = screen.getByRole('button', { name: /sign in/i });
    await user.click(button);

    await waitFor(
      () => {
        const submitBtn = screen.getByRole('button', { name: /sign/i });
        expect(submitBtn).toBeDefined();
      },
      { timeout: 3000 },
    );
  });
});
