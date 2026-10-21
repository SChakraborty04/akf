import React from 'react';

/**
 * Renders SVG geometric shape icons for loan and repayment stamps
 * Shapes: circle (1000), triangle (3000), star (5000), sun (10000), pentagon (500)
 */
export default function ShapeIcon({ shape, className = 'w-5 h-5', style }) {
  const normShape = (shape || '').toLowerCase();

  switch (normShape) {
    case 'circle':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          style={style}
          aria-label="Circle"
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      );

    case 'triangle':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          style={style}
          aria-label="Triangle"
        >
          <polygon points="12,3 22,21 2,21" />
        </svg>
      );

    case 'star':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          style={style}
          aria-label="Star"
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      );

    case 'sun':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={style}
          aria-label="Sun"
        >
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <line x1="12" y1="2" x2="12" y2="4.5" />
          <line x1="12" y1="19.5" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" />
          <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4.5" y2="12" />
          <line x1="19.5" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" />
          <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" />
        </svg>
      );

    case 'pentagon':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          style={style}
          aria-label="Pentagon"
        >
          <polygon points="12,2 22,9.25 18.18,21 5.82,21 2,9.25" />
        </svg>
      );

    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          style={style}
        >
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

/**
 * Returns color classes and styling tokens for a given shape
 */
export function getShapeMeta(shape) {
  const norm = (shape || '').toLowerCase();
  switch (norm) {
    case 'pentagon':
      return {
        name: 'Pentagon',
        color: '#0d9488',
        textColor: 'text-teal-600',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-200'
      };
    case 'circle':
      return {
        name: 'Circle',
        color: '#2563eb',
        textColor: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    case 'triangle':
      return {
        name: 'Triangle',
        color: '#d97706',
        textColor: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200'
      };
    case 'star':
      return {
        name: 'Star',
        color: '#7c3aed',
        textColor: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
      };
    case 'sun':
      return {
        name: 'Sun',
        color: '#ea580c',
        textColor: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200'
      };
    default:
      return {
        name: 'Shape',
        color: '#64748b',
        textColor: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200'
      };
  }
}
