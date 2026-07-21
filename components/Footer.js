export default function Footer() {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#B0AA9A]">
      <span>Powered by</span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="40" width="10" height="26" fill="#14C3B0" />
          <rect x="21" y="28" width="10" height="38" fill="#2E6F9E" />
          <rect x="36" y="14" width="10" height="52" fill="#163A5F" />
          <rect x="51" y="34" width="10" height="32" fill="#2E6F9E" />
        </svg>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }} className="text-[#6A6F76]">
          Aresa
        </span>
      </span>
    </div>
  );
}
