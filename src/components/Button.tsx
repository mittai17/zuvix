/* src/components/Button.tsx */
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'glass' | 'neo' | 'clay' | 'dynamic';
  colorType?: 'primary' | 'secondary' | 'danger' | 'success';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'dynamic',
  colorType = 'primary',
  className = '',
  style = {},
  ...props
}) => {
  let styleClass = '';

  if (variant === 'dynamic') {
    styleClass = 'dynamic-btn';
  } else if (variant === 'glass') {
    styleClass = `glass-btn ${colorType === 'primary' ? 'glass-btn-primary' : ''}`;
  } else if (variant === 'neo') {
    styleClass = `neo-btn ${colorType === 'primary' ? 'neo-btn-primary' : ''}`;
  } else if (variant === 'clay') {
    styleClass = `clay-btn ${colorType === 'secondary' ? 'clay-btn-secondary' : ''}`;
  }

  return (
    <button 
      className={`${styleClass} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        border: 'none',
        outline: 'none',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
};
export default Button;
