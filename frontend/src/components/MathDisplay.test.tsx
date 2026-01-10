import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MathDisplay } from './MathDisplay';
import { mockComposition, createMockComposition } from '../test/utils';

describe('MathDisplay', () => {
  describe('Empty State', () => {
    it('shows waiting message when composition is null', () => {
      render(<MathDisplay composition={null} />);

      expect(screen.getByText('Waiting for inspiration...')).toBeInTheDocument();
      expect(screen.getByText('Generate a composition to see the structure.')).toBeInTheDocument();
    });

    it('does not render visualization sections when composition is null', () => {
      render(<MathDisplay composition={null} />);

      expect(screen.queryByText('Pentatonic Scale Structure')).not.toBeInTheDocument();
      expect(screen.queryByText('Euclidean Rhythm Geometry')).not.toBeInTheDocument();
      expect(screen.queryByText('Musical Form')).not.toBeInTheDocument();
    });
  });

  describe('Scale Visualization', () => {
    it('renders pentatonic scale structure section', () => {
      render(<MathDisplay composition={mockComposition} />);

      expect(screen.getByText('Pentatonic Scale Structure')).toBeInTheDocument();
    });

    it('renders all scale notes', () => {
      render(<MathDisplay composition={mockComposition} />);

      // mockComposition has scale: ['C4', 'D4', 'E4', 'G4', 'A4']
      expect(screen.getByText('C4')).toBeInTheDocument();
      expect(screen.getByText('D4')).toBeInTheDocument();
      expect(screen.getByText('E4')).toBeInTheDocument();
      expect(screen.getByText('G4')).toBeInTheDocument();
      expect(screen.getByText('A4')).toBeInTheDocument();
    });

    it('renders correct number of scale notes (5 for pentatonic)', () => {
      render(<MathDisplay composition={mockComposition} />);

      // Each note is in a div with rounded-full class
      const noteElements = screen.getAllByText(/^[A-G][#b]?\d$/);
      expect(noteElements).toHaveLength(5);
    });
  });

  describe('Euclidean Rhythm Visualization', () => {
    it('renders euclidean rhythm geometry section', () => {
      render(<MathDisplay composition={mockComposition} />);

      expect(screen.getByText('Euclidean Rhythm Geometry')).toBeInTheDocument();
    });

    it('renders role labels', () => {
      render(<MathDisplay composition={mockComposition} />);

      // mockComposition has euclideanPatterns for melody and accompaniment
      // The component uses uppercase text-transform via CSS class
      expect(screen.getByText(/melody/i)).toBeInTheDocument();
      expect(screen.getByText(/accompaniment/i)).toBeInTheDocument();
    });

    it('renders SVG circles for each euclidean pattern', () => {
      const { container } = render(<MathDisplay composition={mockComposition} />);

      // Should have 2 SVG elements within the grid (melody and accompaniment patterns)
      // Note: InfoIcon also contains an SVG, so we scope to the grid container
      const svgElements = container.querySelectorAll('.grid svg');
      expect(svgElements.length).toBe(2);
    });

    it('renders correct number of dots for pattern length', () => {
      const { container } = render(<MathDisplay composition={mockComposition} />);

      // melody pattern has 8 beats: [1, 0, 0, 1, 0, 0, 1, 0]
      // accompaniment pattern has 8 beats: [1, 0, 1, 1, 0, 1, 1, 0]
      // Each pattern SVG has 1 background circle + 8 beat circles = 9
      // 2 patterns * 9 = 18 circles within the grid
      // Note: InfoIcon also has a circle, so we scope to the grid container
      const allCircles = container.querySelectorAll('.grid circle');
      expect(allCircles.length).toBe(18);
    });
  });

  describe('Musical Form Visualization', () => {
    it('renders musical form section', () => {
      render(<MathDisplay composition={mockComposition} />);

      expect(screen.getByText('Musical Form')).toBeInTheDocument();
    });

    it('renders all form sections', () => {
      render(<MathDisplay composition={mockComposition} />);

      // mockComposition has form: ['A', "A'", 'B', "A''"]
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText("A'")).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText("A''")).toBeInTheDocument();
    });

    it('renders arrows between form sections', () => {
      render(<MathDisplay composition={mockComposition} />);

      // Should have 3 arrows (form.length - 1)
      const arrows = screen.getAllByText('→');
      expect(arrows).toHaveLength(3);
    });

    it('does not render arrow after last section', () => {
      const singleSectionComposition = createMockComposition({ form: ['A'] });
      render(<MathDisplay composition={singleSectionComposition} />);

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });
  });

  describe('AnimatedEuclideanCircle Component', () => {
    it('renders larger dots for hits (value=1)', () => {
      const { container } = render(<MathDisplay composition={mockComposition} />);

      // AnimatedEuclideanCircle: Hits have r=8, rests have r=4
      const largerDots = container.querySelectorAll('circle[r="8"]');

      // melody pattern [1,0,0,1,0,0,1,0] has 3 hits
      // accompaniment pattern [1,0,1,1,0,1,1,0] has 5 hits
      // Total: 8 hits
      expect(largerDots.length).toBe(8);
    });

    it('renders smaller dots for rests (value=0)', () => {
      const { container } = render(<MathDisplay composition={mockComposition} />);

      // AnimatedEuclideanCircle: Rests have r=4
      const smallerDots = container.querySelectorAll('circle[r="4"]');

      // melody pattern [1,0,0,1,0,0,1,0] has 5 rests
      // accompaniment pattern [1,0,1,1,0,1,1,0] has 3 rests
      // Total: 8 rests
      expect(smallerDots.length).toBe(8);
    });

    it('uses different colors for melody and accompaniment', () => {
      const { container } = render(<MathDisplay composition={mockComposition} />);

      // Melody hits use #d32f2f (red)
      const redDots = container.querySelectorAll('circle[fill="#d32f2f"]');
      // melody pattern [1,0,0,1,0,0,1,0] has 3 hits
      expect(redDots.length).toBe(3);

      // Accompaniment hits use #ffbf00 (amber)
      const amberDots = container.querySelectorAll('circle[fill="#ffbf00"]');
      // accompaniment pattern [1,0,1,1,0,1,1,0] has 5 hits
      expect(amberDots.length).toBe(5);

      // Rests are filled with #e5e7eb (gray) across both patterns
      const grayDots = container.querySelectorAll('circle[fill="#e5e7eb"]');
      // 8 rest dots across both patterns
      expect(grayDots.length).toBe(8);
    });

    it('displays E(k,n) notation in circle center', () => {
      render(<MathDisplay composition={mockComposition} />);

      // melody pattern [1,0,0,1,0,0,1,0] is E(3,8)
      expect(screen.getByText('E(3,8)')).toBeInTheDocument();

      // accompaniment pattern [1,0,1,1,0,1,1,0] is E(5,8)
      expect(screen.getByText('E(5,8)')).toBeInTheDocument();
    });
  });
});
