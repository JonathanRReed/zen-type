import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  subtle?: boolean;
  shape?: 'square' | 'pill';
  variant?: 'default' | 'subtlePill';
}

const IconButton: React.FC<IconButtonProps> = ({
  active = false,
  subtle = false,
  shape = 'square',
  variant = 'default',
  className = '',
  children,
  type,
  ...rest
}) => {
  const buttonType = type ?? 'button';
  const shapeClass = shape === 'pill'
    ? 'h-10 px-4 rounded-2xl gap-2'
    : 'h-10 w-10 rounded-xl';
  const palette = variant === 'subtlePill'
    ? 'border-muted/25 text-muted bg-transparent hover:bg-surface/60 hover:text-text hover:border-iris/35 focus-visible:ring-1 focus-visible:ring-iris/45 focus-visible:ring-offset-2 focus-visible:ring-offset-base'
    : active
    ? 'bg-iris/20 border-iris/60 text-iris shadow-[0_8px_16px_-10px_rgba(196,167,231,0.45)]'
    : subtle
    ? 'border-muted/25 text-muted bg-transparent hover:bg-iris/10 hover:border-iris/35 hover:text-text'
    : 'border-muted/35 text-muted hover:border-iris/45 hover:text-text';

  return (
    <Button
      type={buttonType}
      variant="outline"
      size={shape === 'pill' ? 'default' : 'icon'}
      data-active={active ? true : undefined}
      data-shape={shape}
      className={cn(
        'icon-button transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-95',
        shapeClass,
        palette,
        className
      )}
      {...rest}
    >
      {children}
    </Button>
  );
};

export default IconButton;
