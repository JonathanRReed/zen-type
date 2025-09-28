/**
 * Enhanced error handling utilities for Zen Type
 * Provides retry mechanisms, better user feedback, and graceful degradation
 */

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface ErrorContext {
  operation: string;
  component?: string;
  userMessage?: string;
  technicalMessage?: string;
  retryable?: boolean;
}

export class AppError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly timestamp: Date;
  public readonly retryable: boolean;

  constructor(context: ErrorContext, originalError?: Error | undefined) {
    const message = context.userMessage || context.technicalMessage || context.operation;
    super(message);

    this.name = 'AppError';
    this.context = context;
    if (originalError) {
      this.originalError = originalError;
    }
    this.timestamp = new Date();
    this.retryable = context.retryable ?? false;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: Array<{ error: AppError; context: any }> = [];
  private maxLogSize = 50;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Enhanced error handler with retry capability
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoffMultiplier = 2,
      shouldRetry = () => true
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Log the error
        this.logError(lastError, { attempt, maxAttempts, operation: 'withRetry' });

        // Don't retry if it's the last attempt or shouldn't retry
        if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        // Wait before retrying with exponential backoff
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Handle errors with context and user feedback
   */
  handleError(error: Error | AppError, context?: Partial<ErrorContext>): AppError {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else {
      appError = new AppError({
        operation: 'unknown',
        technicalMessage: error.message,
        userMessage: 'An unexpected error occurred',
        retryable: false,
        ...context
      }, error);
    }

    // Log the error
    this.logError(appError, { context });

    // Show user feedback for critical errors
    if (appError.retryable) {
      this.showRetryableError(appError);
    } else {
      this.showErrorNotification(appError);
    }

    return appError;
  }

  /**
   * Safe operation wrapper that handles errors gracefully
   */
  async safeOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const appError = this.handleError(error as Error, context);
      console.warn(`Operation failed, using fallback:`, appError.message);
      return fallback;
    }
  }

  /**
   * Log error with context for debugging
   */
  private logError(error: Error, context?: any): void {
    const logEntry = {
      error: error instanceof AppError ? error : new AppError({
        operation: 'unknown',
        technicalMessage: error.message
      }),
      context,
      timestamp: new Date(),
      stack: error.stack
    };

    this.errorLog.unshift(logEntry);

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error: ${error.message}`);
      console.error(error);
      if (context) console.log('Context:', context);
      console.groupEnd();
    }
  }

  /**
   * Show retryable error with user-friendly UI
   */
  private showRetryableError(error: AppError): void {
    // Create a toast notification for retryable errors
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 z-[9999] bg-love/90 text-text px-4 py-3 rounded-lg shadow-lg border border-love/40 backdrop-blur-sm max-w-sm';
    toast.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-love">⚠️</div>
        <div class="flex-1">
          <div class="font-medium text-sm">${error.context.userMessage || 'Operation failed'}</div>
          <div class="text-xs text-text/70 mt-1">${error.context.operation}</div>
        </div>
        <button class="text-text/70 hover:text-text text-sm underline" onclick="this.parentElement.parentElement.remove()">
          Retry
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  }

  /**
   * Show general error notification
   */
  private showErrorNotification(error: AppError): void {
    console.warn('Non-retryable error:', error.message);
    // For now, just log it. In a real app, you might show a subtle notification
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit = 10): Array<{ error: AppError; context: any }> {
    return this.errorLog.slice(0, limit);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions for common operations
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    errorHandler.handleError(error as Error, context);

    if (fallback !== undefined) {
      return fallback;
    }

    return undefined;
  }
}

export function createErrorBoundaryContext(
  operation: string,
  component?: string
): ErrorContext {
  return {
    operation,
    ...(component && { component }),
    userMessage: `Failed to ${operation.toLowerCase()}`,
    retryable: true
  };
}
