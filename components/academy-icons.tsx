export type ToolName = 'polish' | 'builder' | 'liner' | 'swatches';

const drawings = {
  polish: <>
    <path d="M13.4 3h5.2l.6 9.4h-6.4L13.4 3Z" fill="currentColor" fillOpacity=".12" />
    <path d="M12.8 12.4h6.4v2.3c0 1.5 4.4 2.2 4.4 5v6.1c0 1.7-1.3 2.9-3 2.9h-9.2c-1.7 0-3-1.2-3-2.9v-6.1c0-2.8 4.4-3.5 4.4-5v-2.3Z" />
    <path d="M12 20h8v4h-8zM15.6 5.4l-.2 4.8" />
  </>,
  builder: <>
    <path d="m12.5 18 10-12.7c.9-1.1 2.7-1.3 3.7-.3 1 .9 1 2.4.1 3.4L15 20.4Z" fill="currentColor" fillOpacity=".12" />
    <path d="m12.5 18 2.5 2.4-2 2.1-2.3-2.1zM10.7 20.4c-3.7.6-3.9 4.6-5.8 6.1 4.1.5 7.5-.7 8.1-4.1M5.2 29h21.3" />
  </>,
  liner: <>
    <path d="m10.8 20.3 12.9-16c1-1.2 2.3-1.5 3.2-.7.9.8.7 2-.2 3.2L13.1 22.3z" fill="currentColor" fillOpacity=".12" />
    <path d="m10.8 20.3 2.3 2-2.6 2.2M10.5 24.5c-1.3 2.1-4 3.3-6.7 2.9 1.3-.7 2.3-1.6 3-2.9M19.6 23.6c2-3.2 4.2-2 3.3.3-1.2 2.8.8 3.4 3.7 1.2" />
  </>,
  swatches: <>
    <path d="M9 23V6.5a3.5 3.5 0 0 1 7 0v10M9.4 21.4l9.2-14a3.2 3.2 0 0 1 5.4 3.4l-5.6 8.5" />
    <path d="m10.2 21.5 13.5-8.1a3.1 3.1 0 1 1 3.2 5.2l-13.4 8.3a3.2 3.2 0 0 1-3.3-5.4Z" fill="currentColor" fillOpacity=".12" />
    <circle cx="11.8" cy="24.1" r=".8" />
  </>,
};

export function NailTool({ name, size = 32 }: { name: ToolName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[name]}</svg>;
}

export function Petal({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    {Array.from({ length: 8 }, (_, i) =>
      <ellipse key={i} cx="40" cy="24" rx="7.4" ry="19.2" transform={'rotate(' + i * 45 + ' 40 40)'} stroke="currentColor" strokeWidth="1.65" />
    )}
    <circle cx="40" cy="40" r="4" fill="currentColor" />
  </svg>;
}
