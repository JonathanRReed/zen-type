import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  subtle?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({
  active = false,
  subtle = false,
  className = '',
  children,
  type,
  ...rest
}) => {
  const buttonType = type ?? 'button';
  const base =
    'icon-button relative flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris/60 hover:-translate-y-0.5 active:scale-95';
  const palette = active
    ? 'bg-iris/20 border-iris/60 text-iris shadow-[0_8px_16px_-10px_rgba(196,167,231,0.45)]'
    : subtle
    ? 'border-muted/25 text-muted hover:border-iris/35 hover:text-text'
    : 'border-muted/35 text-muted hover:border-iris/45 hover:text-text';
  const finalClass = `${base} ${palette} ${className}`.trim();

  return (
    <button
      type={buttonType}
      data-active={active || undefined}
      className={finalClass}
      {...rest}
    >
      {children}
    </button>
  );
};

export default IconButton;
