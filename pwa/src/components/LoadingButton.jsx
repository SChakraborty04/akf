import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

/**
 * Button wrapper that disables itself and displays a spinner while executing
 * click/submit handlers, and supports standardized success/error toast feedback.
 */
export default function LoadingButton({
  onClick,
  loading: controlledLoading = false,
  disabled = false,
  type = 'button',
  className = '',
  spinnerClassName = 'w-3.5 h-3.5',
  loadingText,
  iconOnly = false,
  minLoaderMs = 160,
  children,
  ...rest
}) {
  const toast = useToast();
  const [internalLoading, setInternalLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isLoading = Boolean(controlledLoading || internalLoading);
  const isDisabled = Boolean(disabled || isLoading);

  const handleClick = async (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }

    if (!onClick) return;

    setInternalLoading(true);
    const start = Date.now();

    try {
      const result = await onClick(e);
      const elapsed = Date.now() - start;
      if (minLoaderMs > 0 && elapsed < minLoaderMs) {
        await new Promise((resolve) => setTimeout(resolve, minLoaderMs - elapsed));
      }

      if (result && typeof result === 'object') {
        if (result.success === true && result.message) {
          toast.success(result.message);
        } else if (result.success === false && (result.error || result.message)) {
          toast.error(result.error || result.message);
        }
      }
    } catch (err) {
      toast.error(err?.message || 'Action failed');
    } finally {
      if (mountedRef.current) {
        setInternalLoading(false);
      }
    }
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick ? handleClick : undefined}
      aria-busy={isLoading}
      className={`${className} ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
      {...rest}
    >
      {isLoading ? (
        iconOnly ? (
          <Loader2 className={`${spinnerClassName} animate-spin shrink-0`} />
        ) : (
          <>
            <Loader2 className={`${spinnerClassName} animate-spin shrink-0`} />
            {loadingText ? <span>{loadingText}</span> : children}
          </>
        )
      ) : (
        children
      )}
    </button>
  );
}

