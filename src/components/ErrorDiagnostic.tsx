/**
 * Error Diagnostic Component
 * Helps identify what's causing the white screen
 */

import { useEffect, useState } from 'react';

export function ErrorDiagnostic() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    // Capture console errors
    const originalError = console.error;
    console.error = (...args) => {
      setErrors(prev => [...prev, args.join(' ')]);
      originalError(...args);
    };

    // Capture unhandled errors
    const handleError = (event: ErrorEvent) => {
      setErrors(prev => [...prev, `Error: ${event.message} at ${event.filename}:${event.lineno}`]);
    };

    // Capture unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      setErrors(prev => [...prev, `Unhandled Promise Rejection: ${event.reason}`]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.error = originalError;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (errors.length === 0) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg">
        ✓ No errors detected
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Errors Detected ({errors.length})
        </h2>
        <div className="space-y-2">
          {errors.map((error, index) => (
            <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
              <pre className="text-xs text-red-800 whitespace-pre-wrap">{error}</pre>
            </div>
          ))}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
