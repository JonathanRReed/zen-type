import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  subtle?: boolean;
  shape?: 'square' | 'pill';
}

const IconButton: React.FC<IconButtonProps> = ({
  active = false,
  subtle = false,
  shape = 'square',
  className = '',
  children,
  type,
  ...rest
}) => {
  const buttonType = type ?? 'button';
  const base =
    'icon-button relative inline-flex items-center justify-center border transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris/60 hover:-translate-y-0.5 active:scale-95';
  const shapeClass = shape === 'pill'
    ? 'h-10 px-4 rounded-2xl gap-2'
    : 'h-10 w-10 rounded-xl';
  const palette = active
    ? 'bg-iris/20 border-iris/60 text-iris shadow-[0_8px_16px_-10px_rgba(196,167,231,0.45)]'
    : subtle
    ? 'border-muted/25 text-muted hover:border-iris/35 hover:text-text'
    : 'border-muted/35 text-muted hover:border-iris/45 hover:text-text';
  const finalClass = `${base} ${shapeClass} ${palette} ${className}`.trim();

  return (
    <button
      type={buttonType}
      data-active={active ? true : undefined}
      data-shape={shape}
      className={finalClass}
      {...rest}
    >
      {children}
    </button>
  );
};

export default IconButton;
