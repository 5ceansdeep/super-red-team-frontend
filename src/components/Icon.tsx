const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  play: 'M7 4.5v15l12-7.5z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  report: 'M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12h5M10 16h5',
  book: 'M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM5 16.5a3 3 0 0 1 3-3h10',
  check: 'M5 12.5 10 17.5 19.5 7',
  alert: 'M12 4 21 20H3zM12 10v4.5M12 17.5h.01',
  layers: 'M12 4 21 9l-9 5-9-5zM3 14l9 5 9-5',
}

export default function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
