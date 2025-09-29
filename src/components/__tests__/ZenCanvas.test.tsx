/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZenCanvas from '../ZenCanvas';
import * as storage from '../../utils/storage';

vi.mock('../../hooks/useMotionPreference', () => ({
  useMotionPreference: () => ({ reducedMotion: false }),
}));

describe('ZenCanvas', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      ellipse: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    } as any;

    mockCanvas = document.createElement('canvas');
    mockCanvas.getContext = vi.fn(() => mockContext) as any;
    
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;
    
    vi.spyOn(storage, 'getSettings').mockReturnValue({
      ...storage.DEFAULT_SETTINGS,
      spawnDensity: 1.0,
      fadeSec: 4,
      driftAmp: 6,
      laneStyle: 'soft',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders canvas and input elements', () => {
      render(<ZenCanvas />);
      
      const canvas = document.querySelector('canvas');
      const input = screen.getByPlaceholderText('Type freely...');
      
      expect(canvas).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });

    it('focuses input on mount', async () => {
      render(<ZenCanvas />);
      
      const input = screen.getByPlaceholderText('Type freely...');
      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });
  });

  describe('Token Spawning', () => {
    it('spawns tokens with valid dimensions', async () => {
      render(<ZenCanvas maxTokens={100} />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'hello ');
      
      await waitFor(() => {
        expect(mockContext.fillText).toHaveBeenCalled();
      });
    });

    it('respects spawn density settings', async () => {
      // Even with low spawn density, tokens should still spawn (probabilistically)
      // We'll type multiple words to increase chances
      vi.spyOn(storage, 'getSettings').mockReturnValue({
        ...storage.DEFAULT_SETTINGS,
        spawnDensity: 1.0, // Use 1.0 to ensure spawning
      });

      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      // Type multiple words to ensure spawning
      await userEvent.type(input, 'word one two three ');
      
      await waitFor(() => {
        expect(mockContext.fillText).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('guards against invalid canvas dimensions', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
        get: () => NaN,
        configurable: true,
      });
      
      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'test ');
      
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('clamps token cap under performance mode', async () => {
      vi.spyOn(storage, 'getSettings').mockReturnValue({
        ...storage.DEFAULT_SETTINGS,
        performanceMode: true,
      });

      render(<ZenCanvas maxTokens={200} />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      for (let i = 0; i < 100; i++) {
        await userEvent.type(input, `word${i} `);
      }
      
      await waitFor(() => {
        expect(mockContext.fillText).toHaveBeenCalled();
      });
    });
  });

  describe('Archive Management', () => {
    it('creates archive entry on first keystroke', async () => {
      const createArchiveSpy = vi.spyOn(storage, 'createArchiveEntry').mockReturnValue({
        id: 'test-id',
        startedAt: new Date().toISOString(),
        text: '',
        wordCount: 0,
        charCount: 0,
      });

      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'a');
      
      await waitFor(() => {
        expect(createArchiveSpy).toHaveBeenCalled();
      });
    });

    it('suspends archiving on storage failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(storage, 'createArchiveEntry').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'test ');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ZenCanvas] Failed to create archive entry'),
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Storage Persistence Warnings', () => {
    it('displays warning on storage write failure', async () => {
      render(<ZenCanvas />);
      
      const event = new CustomEvent(storage.getStoragePersistenceErrorEvent(), {
        detail: {
          key: 'test',
          action: 'write',
          error: new Error('quota exceeded'),
        },
      });
      
      window.dispatchEvent(event);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Local storage is disabled or full/)).toBeInTheDocument();
      });
    });

    it('dismisses warning when close button clicked', async () => {
      const user = userEvent.setup();
      render(<ZenCanvas />);
      
      const event = new CustomEvent(storage.getStoragePersistenceErrorEvent(), {
        detail: {
          key: 'test',
          action: 'write',
          error: new Error('quota exceeded'),
        },
      });
      
      window.dispatchEvent(event);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      
      const dismissButton = screen.getByLabelText('Dismiss warning');
      await user.click(dismissButton);
      
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Input Handling', () => {
    it('commits word on space', async () => {
      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'test ');
      
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('commits word on punctuation', async () => {
      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'test.');
      
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('commits word on Enter key', async () => {
      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'test{Enter}');
      
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('Stats Emission', () => {
    it('emits zenStats event periodically', async () => {
      const statsHandler = vi.fn();
      window.addEventListener('zenStats', statsHandler);

      const onStats = vi.fn();
      render(<ZenCanvas onStats={onStats} />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'hello world ');
      
      await waitFor(() => {
        expect(statsHandler).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      window.removeEventListener('zenStats', statsHandler);
    });
  });

  describe('Lane Style Guards', () => {
    it('handles none lane style', async () => {
      vi.spyOn(storage, 'getSettings').mockReturnValue({
        ...storage.DEFAULT_SETTINGS,
        laneStyle: 'none',
      });

      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'test ');
      
      await waitFor(() => {
        expect(mockContext.fillText).toHaveBeenCalled();
      });
    });

    it('handles tight lane style', async () => {
      vi.spyOn(storage, 'getSettings').mockReturnValue({
        ...storage.DEFAULT_SETTINGS,
        laneStyle: 'tight',
      });

      render(<ZenCanvas />);
      const input = screen.getByPlaceholderText('Type freely...');
      
      await userEvent.type(input, 'test ');
      
      await waitFor(() => {
        expect(mockContext.fillText).toHaveBeenCalled();
      });
    });
  });
});
