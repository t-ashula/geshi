import { describe, test, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../HomePage';

describe('HomePage', () => {
	test('should render h1', () => {
		render(<HomePage />);
		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to TanStack');
	});
});
