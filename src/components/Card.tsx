/* src/components/Card.tsx */
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'neo' | 'clay' | 'dynamic';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'dynamic',
  hoverable = false,
  padding = 'md',
  className = '',
  ...props
}) => {
  let styleClass = '';
  
  if (variant === 'dynamic') {
    styleClass = 'dynamic-card';
  } else if (variant === 'glass') {
    styleClass = `glass-card ${hoverable ? 'glass-card-hover' : ''}`;
  } else if (variant === 'neo') {
    styleClass = 'neo-card';
  } else if (variant === 'clay') {
    styleClass = 'clay-card';
  }

  // Inline fallback classes since we write vanilla CSS
  const combinedClassName = `${styleClass} ${className}`;

  return (
    <div 
      className={combinedClassName} 
      style={{
        padding: padding === 'sm' ? '12px' : padding === 'md' ? '20px' : padding === 'lg' ? '32px' : '0px',
        overflow: 'hidden',
        position: 'relative'
      }}
      {...props}
    >
      {children}
    </div>
  );
};
export default Card;
