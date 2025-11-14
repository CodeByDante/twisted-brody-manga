interface LoadingSpinnerProps {
  size?: number;
  borderWidth?: number;
  className?: string;
}

export function LoadingSpinner({ size = 40, borderWidth = 2, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className="rounded-full animate-spin"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderWidth: `${borderWidth}px`,
          borderStyle: 'solid',
          borderColor: '#bb86fc',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite',
        }}
      />
    </div>
  );
}
