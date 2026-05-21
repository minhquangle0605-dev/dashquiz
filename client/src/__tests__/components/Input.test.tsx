import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '@/components/ui/Input';

describe('Input component', () => {
  it('should render with label', () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should render without label', () => {
    render(<Input name="test" placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should display error message', () => {
    render(<Input name="email" label="Email" error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should set aria-invalid when error is present', () => {
    render(<Input name="email" label="Email" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should not set aria-invalid when no error', () => {
    render(<Input name="email" label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('should handle user typing', async () => {
    const user = userEvent.setup();
    render(<Input name="test" label="Test" />);

    const input = screen.getByLabelText('Test');
    await user.type(input, 'hello world');

    expect(input).toHaveValue('hello world');
  });

  it('should apply error border styles on wrapper', () => {
    render(<Input name="email" label="Email" error="Error" />);
    const input = screen.getByLabelText('Email');
    const wrapper = input.parentElement;
    expect(wrapper?.className).toContain('border-[var(--color-danger)]');
  });

  it('should apply normal border styles without error', () => {
    render(<Input name="email" label="Email" />);
    const input = screen.getByLabelText('Email');
    const wrapper = input.parentElement;
    expect(wrapper?.className).toContain('border-[var(--color-border)]');
  });

  it('should forward ref properly', () => {
    const ref = vi.fn();
    render(<Input ref={ref} name="test" />);
    expect(ref).toHaveBeenCalled();
  });
});
